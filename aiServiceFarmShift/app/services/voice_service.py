import time
import logging
import httpx
from app.core.config import settings
from app.schemas.voice_schema import SpeechTranscribeResponse
from app.services.stt_postprocess import postprocess_vietnamese_stt

logger = logging.getLogger("aiServiceFarmShift.voice")

DOMAIN_PROMPT = (
    "Hệ thống quản lý trang trại gà thịt FarmShift: Chuồng A1, Nhà A2, Nhà B1, cám Higro 01, Higro 02, "
    "C.P. Việt Nam, Dabaco, Hanvet, vắc-xin Lasota, Gumboro, Newcastle, cân mẫu, hao hụt, nhập kho, NH000001."
)

GROQ_STT_ENDPOINT = "https://api.groq.com/openai/v1/audio/transcriptions"

class VoiceService:
    @staticmethod
    async def transcribe_audio(file_bytes: bytes, filename: str = "voice_command.webm") -> SpeechTranscribeResponse:
        start_time = time.time()

        if not file_bytes:
            return SpeechTranscribeResponse(
                text="",
                provider="WEB_SPEECH_FALLBACK",
                fallback=True,
                duration_ms=0
            )

        api_key = settings.GROQ_API_KEY.strip() if settings.GROQ_API_KEY else ""
        if not api_key:
            logger.info("Chưa cấu hình GROQ_API_KEY trong aiService. Fallback sang Web Speech API.")
            duration_ms = int((time.time() - start_time) * 1000)
            return SpeechTranscribeResponse(
                text="",
                provider="WEB_SPEECH_FALLBACK",
                fallback=True,
                duration_ms=duration_ms
            )

        try:
            headers = {
                "Authorization": f"Bearer {api_key}"
            }
            files = {
                "file": (filename or "voice_command.webm", file_bytes, "application/octet-stream")
            }
            data = {
                "model": settings.GROQ_STT_MODEL or "whisper-large-v3",
                "language": "vi",
                "temperature": "0",
                "response_format": "verbose_json",
                "prompt": DOMAIN_PROMPT
            }

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(GROQ_STT_ENDPOINT, headers=headers, files=files, data=data)

            duration_ms = int((time.time() - start_time) * 1000)

            if response.status_code == 200:
                result = response.json()
                transcribed_text = postprocess_vietnamese_stt(result.get("text", "").strip())
                logger.info(f"Groq Whisper STT thành công trong {duration_ms}ms: '{transcribed_text}'")
                return SpeechTranscribeResponse(
                    text=transcribed_text,
                    provider="GROQ_WHISPER_LARGE_V3",
                    fallback=False,
                    duration_ms=duration_ms
                )
            else:
                logger.warning(f"Groq Whisper trả về mã lỗi {response.status_code}: {response.text}")
        except Exception as ex:
            logger.warning(f"Lỗi khi gọi Groq Whisper API (fallback sang Web Speech): {ex}")

        duration_ms = int((time.time() - start_time) * 1000)
        return SpeechTranscribeResponse(
            text="",
            provider="WEB_SPEECH_FALLBACK",
            fallback=True,
            duration_ms=duration_ms
        )

voice_service = VoiceService()
