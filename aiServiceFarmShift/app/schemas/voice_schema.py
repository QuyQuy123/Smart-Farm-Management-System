from pydantic import BaseModel, Field
from typing import Optional

class SpeechTranscribeResponse(BaseModel):
    text: str = Field(..., description="Văn bản bóc tách từ giọng nói")
    provider: str = Field("GROQ_WHISPER_LARGE_V3", description="Động cơ STT đã xử lý")
    fallback: bool = Field(False, description="Đánh dấu nếu phải fallback về Web Speech")
    duration_ms: int = Field(0, description="Thời gian xử lý tính bằng mili-giây", serialization_alias="durationMs")

    model_config = {
        "populate_by_name": True
    }
