from fastapi import APIRouter, UploadFile, File, HTTPException
import logging
from app.services.voice_service import voice_service
from app.schemas.voice_schema import SpeechTranscribeResponse

logger = logging.getLogger("aiServiceFarmShift.endpoints.voice")

router = APIRouter()

@router.post("/transcribe", response_model=SpeechTranscribeResponse, summary="Chuyển đổi âm thanh giọng nói tiếng Việt sang văn bản (STT)")
async def transcribe_voice(file: UploadFile = File(...)):
    """
    Nhận file âm thanh (.webm, .mp4, .wav, .mp3, .m4a) từ microphone,
    gọi Groq Whisper STT với từ điển chuyên biệt cho chăn nuôi FarmShift
    và trả về văn bản nhận diện được.
    """
    if not file:
        raise HTTPException(status_code=400, detail="Không tìm thấy file âm thanh gửi lên")

    file_bytes = await file.read()
    filename = file.filename or "recording.webm"

    response = await voice_service.transcribe_audio(file_bytes, filename)
    return response
