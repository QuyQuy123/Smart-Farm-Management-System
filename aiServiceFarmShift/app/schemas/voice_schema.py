from pydantic import BaseModel, Field
from typing import Optional, List, Dict

class SpeechTranscribeResponse(BaseModel):
    text: str = Field(..., description="Văn bản bóc tách từ giọng nói")
    provider: str = Field("GROQ_WHISPER_LARGE_V3", description="Động cơ STT đã xử lý")
    fallback: bool = Field(False, description="Đánh dấu nếu phải fallback về Web Speech")
    duration_ms: int = Field(0, description="Thời gian xử lý tính bằng mili-giây", serialization_alias="durationMs")

    model_config = {
        "populate_by_name": True
    }


class AssistantChatRequest(BaseModel):
    message: str = Field(..., description="Câu lệnh hoặc câu hỏi của người dùng")
    system_prompt: Optional[str] = Field(None, alias="systemPrompt", description="System prompt kèm ngữ cảnh trang trại")
    history: Optional[List[Dict[str, str]]] = Field(default_factory=list, description="Lịch sử hội thoại")

    model_config = {
        "populate_by_name": True
    }


class AssistantChatResponse(BaseModel):
    content: str = Field("", description="Chuỗi JSON kết quả phân tích ý định và câu trả lời từ LLM")
    provider: str = Field("GROQ_LLAMA_3_3_70B", description="Mô hình LLM đã xử lý")
    fallback: bool = Field(False, description="Đánh dấu nếu không gọi được LLM")
    duration_ms: int = Field(0, description="Thời gian xử lý tính bằng mili-giây", serialization_alias="durationMs")

    model_config = {
        "populate_by_name": True
    }
