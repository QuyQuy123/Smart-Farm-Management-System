from fastapi import APIRouter, UploadFile, File, HTTPException
import logging
from app.services.voice_service import voice_service
from app.schemas.voice_schema import (
    SpeechTranscribeResponse,
    AssistantChatRequest,
    AssistantChatResponse,
)

logger = logging.getLogger("aiServiceFarmShift.endpoints.voice")

router = APIRouter()

MAX_AUDIO_BYTES = int(19.5 * 1024 * 1024)

@router.post("/transcribe", response_model=SpeechTranscribeResponse, summary="Chuyển đổi âm thanh giọng nói tiếng Việt sang văn bản (STT)")
async def transcribe_voice(file: UploadFile = File(...)):
    """
    Nhận file âm thanh (.webm, .mp4, .wav, .mp3, .m4a) từ microphone,
    gọi Groq Whisper STT với từ điển chuyên biệt cho chăn nuôi FarmShift
    và trả về văn bản nhận diện được.
    """
    if not file:
        raise HTTPException(status_code=400, detail="Không tìm thấy file âm thanh gửi lên")

    try:
        file_bytes = await file.read(MAX_AUDIO_BYTES + 1)
        if not file_bytes or len(file_bytes) > MAX_AUDIO_BYTES:
            return SpeechTranscribeResponse(
                text="",
                provider="WEB_SPEECH_FALLBACK",
                fallback=True,
                duration_ms=0
            )
        filename = file.filename or "recording.webm"
        response = await voice_service.transcribe_audio(file_bytes, filename)
        return response
    finally:
        await file.close()


@router.post("/chat", response_model=AssistantChatResponse, summary="Phân tích ý định NLU & Trả lời câu hỏi chăn nuôi qua LLM")
async def assistant_chat(request: AssistantChatRequest):
    """
    Nhận câu hỏi/câu lệnh và System Prompt từ Backend, gọi Groq Llama / OpenAI LLM
    in-house tại aiServiceFarmShift và trả về JSON kết quả.
    """
    return await voice_service.chat_completion(request)
