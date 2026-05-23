from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "core/.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "SwarSaathi Voice Bot"
    environment: str = "development"
    database_url: str = "sqlite:///./data/voice_bot.db"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.5-flash"
    max_history_turns: int = 8
    jwt_secret: str = "swarsaathi-super-secret-key-123456789"

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def sqlite_path(self) -> Path:
        prefix = "sqlite:///"
        if not self.database_url.startswith(prefix):
            raise ValueError("Only sqlite DATABASE_URL values are supported by this build.")
        return Path(self.database_url.removeprefix(prefix)).expanduser()


@lru_cache
def get_settings() -> Settings:
    return Settings()
