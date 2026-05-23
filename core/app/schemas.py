from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class UserSignup(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=50)


class UserLogin(BaseModel):
    username: str
    password: str


class AuthResponse(BaseModel):
    token: str
    username: str


class UserSnapshot(BaseModel):
    id: str
    username: str



class ChatRequest(BaseModel):
    transcript: str = Field(min_length=1, max_length=4000)
    session_id: str | None = Field(default=None, max_length=80)
    speech_locale: Literal["mixed", "hi-IN", "te-IN", "en-IN"] = "mixed"
    response_script: Literal["native", "roman"] = "roman"




class MemorySnapshot(BaseModel):
    user_name: str | None = None
    last_intent: str | None = None
    turns: int = 0


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    reply_source: Literal["gemini", "rule"]
    created_at: datetime
    memory: MemorySnapshot


class TurnLog(BaseModel):
    id: int
    session_id: str
    timestamp: datetime
    user_text: str
    bot_response: str
    reply_source: str


class SessionLogsResponse(BaseModel):
    session_id: str
    turns: list[TurnLog]
