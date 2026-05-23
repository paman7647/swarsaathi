from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .config import Settings, get_settings
from .conversation import clean_text, updated_memory
from .db import ConversationStore
from .gemini import GeminiReplyService
from .schemas import (
    ChatRequest,
    ChatResponse,
    MemorySnapshot,
    SessionLogsResponse,
    UserSignup,
    UserLogin,
    AuthResponse,
    UserSnapshot,
)

security = HTTPBearer()


def create_app(overrides: Settings | None = None) -> FastAPI:
    settings = overrides or get_settings()
    store = ConversationStore(settings.sqlite_path, settings.jwt_secret)
    reply_service = GeminiReplyService(settings.gemini_api_key, settings.gemini_model)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        store.initialize()
        yield

    app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["*"],
    )

    app.state.store = store

    # Security dependency to extract current user
    def get_current_user(
        credentials: HTTPAuthorizationCredentials = Depends(security),
        request: Request = None,
    ) -> dict[str, Any]:
        token = credentials.credentials
        user = request.app.state.store.verify_token(token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid session token.")
        return user

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "app": settings.app_name}

    # --- AUTHENTICATION ROUTES ---
    @app.post("/api/auth/signup")
    def signup(payload: UserSignup, request: Request) -> dict[str, str]:
        try:
            request.app.state.store.create_user(payload.username, payload.password)
            return {"status": "ok", "message": "User registered successfully"}
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    @app.post("/api/auth/login", response_model=AuthResponse)
    def login(payload: UserLogin, request: Request) -> AuthResponse:
        user = request.app.state.store.verify_user(payload.username, payload.password)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid username or password.")
        token = request.app.state.store.create_token(user["id"])
        return AuthResponse(token=token, username=user["username"])

    @app.post("/api/auth/logout")
    def logout(
        credentials: HTTPAuthorizationCredentials = Depends(security),
        request: Request = None,
    ) -> dict[str, str]:
        token = credentials.credentials
        request.app.state.store.delete_token(token)
        return {"status": "ok", "message": "Logged out successfully"}

    @app.get("/api/auth/me", response_model=UserSnapshot)
    def me(user: dict[str, Any] = Depends(get_current_user)) -> UserSnapshot:
        return UserSnapshot(id=user["id"], username=user["username"])

    # --- PROTECTED CHAT & HISTORY ROUTES ---
    @app.post("/api/chat", response_model=ChatResponse)
    def chat(
        payload: ChatRequest,
        request: Request,
        user: dict[str, Any] = Depends(get_current_user),
    ) -> ChatResponse:
        transcript = clean_text(payload.transcript)
        if not transcript:
            raise HTTPException(status_code=422, detail="Transcript cannot be empty.")

        session_id = payload.session_id or str(uuid4())
        
        # Verify user owns the session (Authorization)
        if not request.app.state.store.is_session_owner(session_id, user["id"]):
            raise HTTPException(
                status_code=403, detail="Forbidden: You do not own this session."
            )

        memory = request.app.state.store.ensure_session(session_id, user["id"])
        memory = updated_memory(memory, transcript)
        history = request.app.state.store.recent_history(
            session_id, settings.max_history_turns
        )
        reply, reply_source = reply_service.generate(
            transcript, memory, history, payload.response_script
        )

        created_at = request.app.state.store.add_turn(
            session_id, transcript, reply, reply_source
        )
        request.app.state.store.update_memory(session_id, memory)
        turns = request.app.state.store.count_turns(session_id)

        return ChatResponse(
            session_id=session_id,
            reply=reply,
            reply_source=reply_source,
            created_at=datetime.fromisoformat(created_at),
            memory=MemorySnapshot(
                user_name=memory.get("user_name"),
                last_intent=memory.get("last_intent"),
                turns=turns,
            ),
        )

    @app.get("/api/sessions/{session_id}/logs", response_model=SessionLogsResponse)
    def session_logs(
        session_id: str,
        request: Request,
        user: dict[str, Any] = Depends(get_current_user),
    ) -> SessionLogsResponse:
        # Verify user owns the session (Authorization)
        if not request.app.state.store.is_session_owner(session_id, user["id"]):
            raise HTTPException(
                status_code=403, detail="Forbidden: You do not own this session."
            )

        turns = request.app.state.store.session_turns(session_id)
        if not turns:
            raise HTTPException(status_code=404, detail="Session logs not found.")
        return SessionLogsResponse(session_id=session_id, turns=turns)

    @app.delete("/api/sessions/{session_id}")
    def delete_session(
        session_id: str,
        request: Request,
        user: dict[str, Any] = Depends(get_current_user),
    ) -> dict[str, str]:
        # Verify user owns the session (Authorization)
        if not request.app.state.store.is_session_owner(session_id, user["id"]):
            raise HTTPException(
                status_code=403, detail="Forbidden: You do not own this session."
            )

        deleted = request.app.state.store.delete_session(session_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Session not found.")
        return {"status": "ok", "message": f"Session {session_id} deleted successfully."}

    return app


app = create_app()

