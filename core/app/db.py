
import base64
import hashlib
import hmac
import json
import secrets
import sqlite3
import time
from contextlib import contextmanager
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Generator
from uuid import uuid4


def base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('utf-8')


def base64url_decode(data: str) -> bytes:
    padding = '=' * (4 - len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def create_jwt(payload: dict[str, Any], secret: str) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    header_b64 = base64url_encode(json.dumps(header).encode('utf-8'))
    payload_b64 = base64url_encode(json.dumps(payload).encode('utf-8'))
    message = f"{header_b64}.{payload_b64}".encode('utf-8')
    sig = hmac.new(secret.encode('utf-8'), message, hashlib.sha256).digest()
    sig_b64 = base64url_encode(sig)
    return f"{header_b64}.{payload_b64}.{sig_b64}"


def verify_jwt(token: str, secret: str) -> dict[str, Any] | None:
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts
        message = f"{header_b64}.{payload_b64}".encode('utf-8')
        expected_sig = hmac.new(secret.encode('utf-8'), message, hashlib.sha256).digest()
        expected_sig_b64 = base64url_encode(expected_sig)
        if not hmac.compare_digest(sig_b64, expected_sig_b64):
            return None
        payload = json.loads(base64url_decode(payload_b64).decode('utf-8'))
        if "exp" in payload and payload["exp"] < time.time():
            return None
        return payload
    except Exception:
        return None


def utc_now() -> str:
    # Helper to get current UTC timestamp in ISO format
    return datetime.now(timezone.utc).isoformat()


def hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
    # PBKDF2-HMAC password hashing with built-in standard library
    if salt is None:
        salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000
    ).hex()
    return hashed, salt


class ConversationStore:
    def __init__(self, db_path: Path, jwt_secret: str = "swarsaathi-super-secret-key-123456789"):
        self.db_path = db_path
        self.jwt_secret = jwt_secret
        # Text log file is saved in the same directory as the database
        self.text_log_path = db_path.parent / "chat_history.txt"

    @contextmanager
    def connect_scope(self) -> Generator[sqlite3.Connection, None, None]:
        # Using a context manager here to make sure connections are always closed.
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.db_path, check_same_thread=False)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        try:
            yield connection
        finally:
            connection.close()

    def initialize(self) -> None:
        # Create tables if they don't exist yet
        with self.connect_scope() as connection:
            with connection:
                connection.executescript(
                    """
                    CREATE TABLE IF NOT EXISTS users (
                        id TEXT PRIMARY KEY,
                        username TEXT UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        salt TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    );
                    CREATE TABLE IF NOT EXISTS tokens (
                        token TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        expires_at TEXT NOT NULL
                    );
                    CREATE TABLE IF NOT EXISTS sessions (
                        id TEXT PRIMARY KEY,
                        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL,
                        memory_json TEXT NOT NULL DEFAULT '{}'
                    );
                    CREATE TABLE IF NOT EXISTS turns (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                        timestamp TEXT NOT NULL,
                        user_text TEXT NOT NULL,
                        bot_response TEXT NOT NULL,
                        reply_source TEXT NOT NULL DEFAULT 'rule'
                    );
                    CREATE INDEX IF NOT EXISTS idx_turns_session_time
                        ON turns(session_id, timestamp DESC);
                    """
                )
                # Ensure the reply_source column exists (for backward compatibility if schema is old)
                columns_turns = {
                    row["name"]
                    for row in connection.execute("PRAGMA table_info(turns)").fetchall()
                }
                if "reply_source" not in columns_turns:
                    connection.execute(
                        "ALTER TABLE turns ADD COLUMN reply_source TEXT NOT NULL DEFAULT 'rule'"
                    )
                # Ensure user_id column exists in sessions table
                columns_sessions = {
                    row["name"]
                    for row in connection.execute("PRAGMA table_info(sessions)").fetchall()
                }
                if "user_id" not in columns_sessions:
                    connection.execute(
                        "ALTER TABLE sessions ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE"
                    )

    # --- AUTHENTICATION METHODS ---
    def create_user(self, username: str, password: str) -> str:
        hashed, salt = hash_password(password)
        user_id = str(uuid4())
        now = utc_now()
        with self.connect_scope() as connection:
            try:
                with connection:
                    connection.execute(
                        """
                        INSERT INTO users (id, username, password_hash, salt, created_at)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                        (user_id, username, hashed, salt, now),
                    )
                return user_id
            except sqlite3.IntegrityError:
                raise ValueError("Username already exists")

    def verify_user(self, username: str, password: str) -> dict[str, Any] | None:
        with self.connect_scope() as connection:
            row = connection.execute(
                "SELECT id, username, password_hash, salt FROM users WHERE username = ?",
                (username,),
            ).fetchone()
            if row is None:
                return None
            
            hashed_check, _ = hash_password(password, row["salt"])
            if hashed_check == row["password_hash"]:
                return {"id": row["id"], "username": row["username"]}
            return None

    def create_token(self, user_id: str) -> str:
        # Fetch username to encode in the JWT payload
        with self.connect_scope() as connection:
            row = connection.execute("SELECT username FROM users WHERE id = ?", (user_id,)).fetchone()
            username = row["username"] if row else ""

        # Create JWT payload (valid for 7 days)
        exp = int((datetime.now(timezone.utc) + timedelta(days=7)).timestamp())
        payload = {
            "sub": user_id,
            "username": username,
            "exp": exp,
            "jti": secrets.token_hex(16)
        }
        token = create_jwt(payload, self.jwt_secret)
        
        # Save token to db to support state-based revocation (logout)
        expires_at = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        with self.connect_scope() as connection:
            with connection:
                connection.execute(
                    "INSERT INTO tokens (token, user_id, expires_at) VALUES (?, ?, ?)",
                    (token, user_id, expires_at),
                )
        return token

    def verify_token(self, token: str) -> dict[str, Any] | None:
        # Verify the JWT signature and expiration
        payload = verify_jwt(token, self.jwt_secret)
        if not payload:
            return None
            
        # Verify the token is active (not deleted or expired) in our database
        now = utc_now()
        with self.connect_scope() as connection:
            row = connection.execute(
                """
                SELECT u.id, u.username, t.expires_at 
                FROM tokens t
                JOIN users u ON t.user_id = u.id
                WHERE t.token = ? AND t.expires_at > ?
                """,
                (token, now),
            ).fetchone()
            if row:
                return {"id": row["id"], "username": row["username"]}
            return None

    def delete_token(self, token: str) -> None:
        with self.connect_scope() as connection:
            with connection:
                connection.execute("DELETE FROM tokens WHERE token = ?", (token,))

    # --- SESSION AUTHORIZATION METHODS ---
    def is_session_owner(self, session_id: str, user_id: str) -> bool:
        with self.connect_scope() as connection:
            row = connection.execute(
                "SELECT user_id FROM sessions WHERE id = ?", (session_id,)
            ).fetchone()
            if row is None:
                return True  # If session doesn't exist yet, it's claimable
            # If the session is unclaimed (user_id is None), let the active user claim it
            if row["user_id"] is None:
                with connection:
                    connection.execute(
                        "UPDATE sessions SET user_id = ? WHERE id = ?", (user_id, session_id)
                    )
                return True
            # If session is owned by someone else, return False
            return row["user_id"] == user_id

    def ensure_session(self, session_id: str, user_id: str | None = None) -> dict[str, Any]:
        # Fetch or create a session. Returns session memory dictionary.
        with self.connect_scope() as connection:
            row = connection.execute(
                "SELECT id, memory_json, user_id FROM sessions WHERE id = ?", (session_id,)
            ).fetchone()
            if row is None:
                now = utc_now()
                with connection:
                    connection.execute(
                        "INSERT INTO sessions (id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?)",
                        (session_id, user_id, now, now),
                    )
                return {}
            return json.loads(row["memory_json"])

    def update_memory(self, session_id: str, memory: dict[str, Any]) -> None:
        # Update session memory in the database
        with self.connect_scope() as connection:
            with connection:
                connection.execute(
                    "UPDATE sessions SET memory_json = ?, updated_at = ? WHERE id = ?",
                    (json.dumps(memory, ensure_ascii=False), utc_now(), session_id),
                )

    def add_turn(
        self, session_id: str, user_text: str, reply: str, reply_source: str
    ) -> str:
        # Add a conversation turn to the database and also log it in the text file
        timestamp = utc_now()
        with self.connect_scope() as connection:
            with connection:
                connection.execute(
                    """
                    INSERT INTO turns (session_id, timestamp, user_text, bot_response, reply_source)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (session_id, timestamp, user_text, reply, reply_source),
                )
                connection.execute(
                    "UPDATE sessions SET updated_at = ? WHERE id = ?", (timestamp, session_id)
                )
        self.append_text_log(session_id, timestamp, user_text, reply)
        return timestamp

    def append_text_log(
        self, session_id: str, timestamp: str, user_text: str, reply: str
    ) -> None:
        # Append turn to the readable chat_history.txt log file
        self.text_log_path.parent.mkdir(parents=True, exist_ok=True)
        with self.text_log_path.open("a", encoding="utf-8") as text_log:
            text_log.write(
                f"Session: {session_id}\n"
                f"Timestamp: {timestamp}\n"
                f"User: {user_text}\n"
                f"Bot: {reply}\n\n"
            )

    def delete_session(self, session_id: str) -> bool:
        # Delete a session and cascade delete all its turns
        with self.connect_scope() as connection:
            row = connection.execute(
                "SELECT id FROM sessions WHERE id = ?", (session_id,)
            ).fetchone()
            if row is None:
                return False
            with connection:
                connection.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
            return True

    def recent_history(self, session_id: str, limit: int) -> list[dict[str, str]]:
        # Fetch the most recent turns for Gemini context
        with self.connect_scope() as connection:
            rows = connection.execute(
                """
                SELECT user_text, bot_response
                FROM turns
                WHERE session_id = ?
                ORDER BY id DESC
                LIMIT ?
                """,
                (session_id, limit),
            ).fetchall()
        return [
            {"user": row["user_text"], "bot": row["bot_response"]}
            for row in reversed(rows)
        ]

    def session_turns(self, session_id: str, limit: int = 100) -> list[dict[str, Any]]:
        # Fetch all turns for logs API
        with self.connect_scope() as connection:
            rows = connection.execute(
                """
                SELECT id, session_id, timestamp, user_text, bot_response, reply_source
                FROM turns
                WHERE session_id = ?
                ORDER BY id ASC
                LIMIT ?
                """,
                (session_id, limit),
            ).fetchall()
        return [dict(row) for row in rows]

    def count_turns(self, session_id: str) -> int:
        # Count the number of turns in this session
        with self.connect_scope() as connection:
            row = connection.execute(
                "SELECT COUNT(*) AS count FROM turns WHERE session_id = ?", (session_id,)
            ).fetchone()
        return int(row["count"])



