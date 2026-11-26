import json
import logging
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.schemas.voice_schema import (
    AssistantChatRequest,
    AssistantChatResponse,
    SpeechTranscribeResponse,
)
from app.services.voice_hallucination_guard import (
    MAX_AUDIO_BYTES,
    validate_audio_magic_bytes,
)
from app.services.voice_service import voice_service

logger = logging.getLogger("aiServiceFarmShift.endpoints.voice")

MAX_ENTITIES_JSON_CHARS = 32_768
MAX_CONTEXT_PROMPT_CHARS = 650

router = APIRouter()


@router.post(
    "/transcribe",
    response_model=SpeechTranscribeResponse,
    summary="Chuyển đổi âm thanh giọng nói tiếng Việt sang văn bản (STT)",
)
async def transcribe_voice(
    file: UploadFile = File(...),
    context_prompt: Optional[str] = Form(default=None),
    entities_json: Optional[str] = Form(default=None),
):
    """
    Nhận file âm thanh (.webm, .m4a, .mp4, .wav, .mp3, .ogg) từ microphone,
    kiểm tra magic bytes, gọi Groq Whisper STT với context_prompt động và bộ lọc ảo giác 3 lớp.
    """
    if not file:
        raise HTTPException(status_code=400, detail="Không tìm thấy file âm thanh gửi lên.")

    try:
        file_bytes = await file.read(MAX_AUDIO_BYTES + 1)
        if not file_bytes:
            raise HTTPException(status_code=400, detail="Tệp âm thanh rỗng.")
        if len(file_bytes) > MAX_AUDIO_BYTES:
            raise HTTPException(
                status_code=400, detail="Tệp âm thanh vượt quá giới hạn tối đa 10 MB."
            )

        filename = file.filename or "voice.webm"
        is_valid_audio, detected_or_error = validate_audio_magic_bytes(
            file_bytes, filename
        )
        if not is_valid_audio:
            raise HTTPException(status_code=400, detail=detected_or_error)

        effective_context = (
            context_prompt.strip()[:MAX_CONTEXT_PROMPT_CHARS]
            if context_prompt and context_prompt.strip()
            else None
        )

        entities = None
        if entities_json and entities_json.strip():
            if len(entities_json) > MAX_ENTITIES_JSON_CHARS:
                logger.warning(
                    "Ignoring oversized entities_json payload (%d chars > %d)",
                    len(entities_json),
                    MAX_ENTITIES_JSON_CHARS,
                )
            else:
                try:
                    parsed = json.loads(entities_json)
                    if isinstance(parsed, dict):
                        entities = parsed
                except json.JSONDecodeError:
                    logger.warning("Ignoring malformed entities_json payload")

        response = await voice_service.transcribe_audio(
            file_bytes=file_bytes,
            filename=filename,
            context_prompt=effective_context,
            entities=entities,
            mime_type=detected_or_error,
        )
        return response
    except HTTPException:
        raise
    except Exception as error:
        logger.error("Error transcribing voice: %s", type(error).__name__, exc_info=True)
        raise HTTPException(status_code=500, detail="Lỗi hệ thống khi nhận diện giọng nói.")
    finally:
        await file.close()


@router.post(
    "/chat",
    response_model=AssistantChatResponse,
    summary="Phân tích ý định NLU & Trả lời câu hỏi chăn nuôi qua LLM",
)
async def assistant_chat(request: AssistantChatRequest):
    """
    Nhận câu hỏi/câu lệnh và System Prompt từ Backend, gọi Groq Llama / OpenAI LLM
    in-house tại aiServiceFarmShift và trả về JSON kết quả.
    """
    return await voice_service.chat_completion(request)
