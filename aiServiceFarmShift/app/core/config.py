from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import os

class Settings(BaseSettings):
    APP_NAME: str = "FarmShift AI Service"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    PORT: int = 8000
    HOST: str = "0.0.0.0"

    # OCR & Vision AI
    OCR_ENGINE: str = "hybrid"
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_API_URL: str = "https://api.openai.com/v1/chat/completions"

    # Groq STT / LLM
    GROQ_API_KEY: str = ""
    GROQ_STT_MODEL: str = "whisper-large-v3"
    GROQ_CHAT_MODEL: str = "llama-3.3-70b-versatile"

    # Internal service-to-service shared token (enforced when non-empty)
    AI_INTERNAL_TOKEN: str = ""

    # CORS (server-to-server internal service)
    CORS_ORIGINS: List[str] = [
        "http://localhost:8080",
        "http://127.0.0.1:8080"
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
