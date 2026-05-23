from pathlib import Path

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.conversation import detect_intent, extract_name


def build_client(tmp_path: Path) -> TestClient:
    settings = Settings(
        database_url=f"sqlite:///{tmp_path / 'test.db'}",
        cors_origins="http://localhost:5173",
        gemini_api_key="",
    )
    app = create_app(settings)
    app.state.store.initialize()
    client = TestClient(app)
    # Register and log in a default test user to authorize all integration requests
    client.post("/api/auth/signup", json={"username": "testuser", "password": "password123"})
    login_resp = client.post("/api/auth/login", json={"username": "testuser", "password": "password123"})
    token = login_resp.json()["token"]
    client.headers = {"Authorization": f"Bearer {token}"}
    return client


def test_chat_remembers_name_and_persists_logs(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        first = client.post("/api/chat", json={"transcript": "Namaste, naa peru Raju"})
        assert first.status_code == 200
        first_body = first.json()
        assert first_body["memory"]["user_name"] == "Raju"
        assert first_body["reply_source"] == "rule"

        second = client.post(
            "/api/chat",
            json={
                "session_id": first_body["session_id"],
                "transcript": "Mujhe software demo kavali",
            },
        )
        assert second.status_code == 200
        assert "Raju" in second.json()["reply"]
        assert second.json()["memory"]["turns"] == 2

        logs = client.get(f"/api/sessions/{first_body['session_id']}/logs")
        assert logs.status_code == 200
        assert [turn["user_text"] for turn in logs.json()["turns"]] == [
            "Namaste, naa peru Raju",
            "Mujhe software demo kavali",
        ]

        text_log = (tmp_path / "chat_history.txt").read_text(encoding="utf-8")
        assert "User: Namaste, naa peru Raju" in text_log
        assert "Bot: Namaste Raju garu, meeku emi sahayam kavali?" in text_log
        assert "User: Mujhe software demo kavali" in text_log



def test_rejects_blank_transcript(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        response = client.post("/api/chat", json={"transcript": " "})
        assert response.status_code == 422


def test_precise_intent_detection() -> None:
    # 1. Verify "this" doesn't falsely trigger "greeting" (substring match bug fix)
    assert detect_intent("this is Raju") == "general"
    
    # 2. Verify exact greetings trigger correctly
    assert detect_intent("Namaste") == "greeting"
    assert detect_intent("hi") == "greeting"
    assert detect_intent("Hey") == "greeting"
    
    # 3. Verify other specific intents
    assert detect_intent("Mujhe ek software demo kavali") == "demo"
    assert detect_intent("What is the cost of subscription?") == "pricing"
    assert detect_intent("సమస్య undi help cheyandi") == "support"
    assert detect_intent("Meeting book cheyyi tomorrow") == "scheduling"


def test_multilingual_name_extraction() -> None:
    # 1. English names with various triggers
    assert extract_name("My name is Suresh") == "Suresh"
    assert extract_name("i am aravind") == "Aravind"
    assert extract_name("i'm Raju") == "Raju"
    
    # 2. Hindi names
    assert extract_name("mera naam Amit") == "Amit"
    assert extract_name("मेरा नाम अमित") == "अमित"
    
    # 3. Telugu names and mixed scripts
    assert extract_name("naa peru అman") == "అman"
    assert extract_name("నా పేరు రాజు") == "రాజు"
    
    # 4. No name
    assert extract_name("Mujhe ek demo chahiye") is None


def test_session_deletion_endpoint(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        # Create a session
        first = client.post("/api/chat", json={"transcript": "Namaste, naa peru Raju"})
        assert first.status_code == 200
        session_id = first.json()["session_id"]
        
        # Verify turns exist
        logs = client.get(f"/api/sessions/{session_id}/logs")
        assert logs.status_code == 200
        
        # Delete session
        delete_resp = client.delete(f"/api/sessions/{session_id}")
        assert delete_resp.status_code == 200
        assert delete_resp.json()["status"] == "ok"
        
        # Verify turns are cascade deleted
        logs_after = client.get(f"/api/sessions/{session_id}/logs")
        assert logs_after.status_code == 404
        
        # Verify deleting non-existent session returns 404
        delete_again = client.delete(f"/api/sessions/{session_id}")
        assert delete_again.status_code == 404


def test_language_and_script_alignment(tmp_path: Path) -> None:
    from app.conversation import detect_language, local_reply

    # 1. Verify language detection including English
    assert detect_language("నా పేరు రాజు") == "telugu"
    assert detect_language("मेरा नाम अमित") == "hindi"
    assert detect_language("hello, my name is Raju") == "english"
    assert detect_language("what is the price?") == "english"

    # 2. Verify local_reply correctly aligns script & language
    memory = {"user_name": "Raju", "last_intent": "greeting"}
    
    # Hindi Native vs Roman
    assert "नमस्ते" in local_reply("मेरा नाम अमित", memory, response_script="native")
    assert "Namaste" in local_reply("mera naam Amit", memory, response_script="roman")
    
    # Telugu Native vs Roman
    assert "నమస్తే" in local_reply("నా పేరు రాజు", memory, response_script="native")
    assert "Namaste" in local_reply("naa peru Raju", memory, response_script="roman")
    
    # English Native vs Roman (identical since English is inherently Roman)
    assert "Hello" in local_reply("hello, my name is Raju", memory, response_script="native")
    assert "Hello" in local_reply("hello, my name is Raju", memory, response_script="roman")


def test_chat_api_respects_script_preference(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        # Native script query
        res_native = client.post(
            "/api/chat",
            json={
                "transcript": "నా పేరు రాజు",
                "response_script": "native"
            }
        )
        assert res_native.status_code == 200
        # The local rules backup should trigger Native Telugu response
        assert "నమస్తే" in res_native.json()["reply"]
        
        # Roman script query
        res_roman = client.post(
            "/api/chat",
            json={
                "transcript": "నా పేరు రాజు",
                "response_script": "roman"
            }
        )
        assert res_roman.status_code == 200
        assert "Namaste" in res_roman.json()["reply"]


def test_jwt_auth_workflow(tmp_path: Path) -> None:
    settings = Settings(
        database_url=f"sqlite:///{tmp_path / 'test.db'}",
        cors_origins="http://localhost:5173",
        gemini_api_key="",
    )
    app = create_app(settings)
    app.state.store.initialize()
    with TestClient(app) as client:
        # 1. Register a new user
        signup_resp = client.post("/api/auth/signup", json={"username": "alice", "password": "securepassword"})
        assert signup_resp.status_code == 200
        assert signup_resp.json()["status"] == "ok"
        
        # Try duplicate username
        dup_resp = client.post("/api/auth/signup", json={"username": "alice", "password": "differentpassword"})
        assert dup_resp.status_code == 400
        assert "already exists" in dup_resp.json()["detail"]
        
        # 2. Login
        login_resp = client.post("/api/auth/login", json={"username": "alice", "password": "securepassword"})
        assert login_resp.status_code == 200
        token = login_resp.json()["token"]
        assert "token" in login_resp.json()
        assert login_resp.json()["username"] == "alice"
        
        # 3. Access protected "/api/auth/me" endpoint
        me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me_resp.status_code == 200
        assert me_resp.json()["username"] == "alice"
        
        # 4. Access with invalid token
        bad_me = client.get("/api/auth/me", headers={"Authorization": "Bearer invalidtoken"})
        assert bad_me.status_code == 401
        
        # 5. Logout
        logout_resp = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
        assert logout_resp.status_code == 200
        
        # Try accessing after logout (revocation verification)
        revoked_me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert revoked_me.status_code == 401


