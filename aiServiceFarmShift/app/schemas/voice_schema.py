from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class SpeechTranscribeResponse(BaseModel):
    text: str = Field(..., description="Văn bản bóc tách từ giọng nói (đã chuẩn hóa)")
    raw_text: str = Field("", description="Văn bản thô trả về từ Whisper trước khi hậu xử lý")
    normalized_text: str = Field("", description="Văn bản đã chuẩn hóa số khẩu ngữ & thực thể trang trại")
    confidence: float = Field(0.0, description="Độ tự tin ước lượng từ avg_logprob và no_speech_prob [0.0..1.0]")
    duration_sec: float = Field(0.0, description="Thời lượng đoạn âm thanh (giây)")
    rejected_reason: Optional[str] = Field(None, description="Lý do từ chối nếu là im lặng hoặc ảo giác Whisper")
    corrections: List[Dict[str, str]] = Field(default_factory=list, description="Danh sách cụm từ đã chuẩn hóa")
    segments_filtered: int = Field(0, description="Số segment ảo giác / tiếng ồn bị loại bỏ")
    provider: str = Field("GROQ_WHISPER_LARGE_V3", description="Động cơ STT đã xử lý")
    fallback: bool = Field(False, description="Đánh dấu nếu phải fallback về Web Speech")
    duration_ms: int = Field(0, description="Thời gian xử lý tính bằng mili-giây", serialization_alias="durationMs")

    model_config = {
        "populate_by_name": True
    }


class ChatHistoryMessage(BaseModel):
    role: str = Field("user", max_length=20)
    content: str = Field("", max_length=8000)


class AssistantChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=8000, description="Câu lệnh hoặc câu hỏi của người dùng")
    system_prompt: Optional[str] = Field(
        None,
        alias="systemPrompt",
        max_length=24000,
        description="System prompt kèm ngữ cảnh trang trại",
    )
    history: Optional[List[ChatHistoryMessage]] = Field(
        default_factory=list,
        max_length=30,
        description="Lịch sử hội thoại",
    )

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
