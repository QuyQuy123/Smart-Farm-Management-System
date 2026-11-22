import asyncio
import logging
from pathlib import Path
import time
from typing import Any

import httpx

from app.core.config import settings
from app.core.http_client import get_shared_http_client
from app.core.observability import ProviderCircuitBreaker, extract_token_usage, log_ai_event
from app.schemas.voice_schema import (
    AssistantChatRequest,
    AssistantChatResponse,
    SpeechTranscribeResponse,
)
from app.services.phonetic_postprocess import postprocess_vietnamese_phonetic
from app.services.voice_hallucination_guard import filter_whisper_verbose_json

logger = logging.getLogger("aiServiceFarmShift.voice")

MAX_HISTORY_TURNS = 6
MAX_HISTORY_TURN_CHARS = 500

groq_stt_breaker = ProviderCircuitBreaker(
    "groq_stt", failure_threshold=3, reset_timeout_sec=30.0
)
groq_chat_breaker = ProviderCircuitBreaker(
    "groq_chat", failure_threshold=3, reset_timeout_sec=30.0
)
openai_chat_breaker = ProviderCircuitBreaker(
    "openai_chat", failure_threshold=3, reset_timeout_sec=30.0
)

DOMAIN_PROMPT = (
    "FarmShift, trang trại gà thịt thương phẩm. Khu Mía Thịt, Khu J Thịt, Khu đông tảo, "
    "Nhà A1, Nhà A2, Nhà B1, Nhà B2, chuồng nuôi, lứa nuôi. "
    "Ghi nhật ký cho ăn, Cám Higro 01, Cám Higro 02, Cám CP 511, bao cám, cân mẫu, trọng lượng trung bình, "
    "hao hụt, gà chết, thải loại, xuất bán, thu hoạch. Việc hôm nay, Phân công công việc, "
    "Xuất nhập nội bộ, Quản lý đơn nhập hàng, Hóa đơn bán hàng, Kho hàng, Công nợ, Nhà cung cấp, "
    "Báo cáo lãi lỗ, Hiệu suất chăn nuôi, FCR. Dabaco, CP Việt Nam, Cargill, Hanvet, Lasota, Gumboro, "
    "Newcastle, Men tiêu hóa, Điện giải Gluco-K-C, NH000001, NH000002, XNB000001."
)

GROQ_STT_ENDPOINT = "https://api.groq.com/openai/v1/audio/transcriptions"
GROQ_CHAT_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"

GROQ_STT_TIMEOUT_SEC = 20.0
GROQ_CHAT_TIMEOUT_SEC = 12.0
OPENAI_CHAT_TIMEOUT_SEC = 10.0

_MIME_TO_EXT = {
    "audio/webm": ".webm",
    "audio/mp4": ".m4a",
    "audio/x-m4a": ".m4a",
    "audio/ogg": ".ogg",
    "audio/wav": ".wav",
    "audio/mpeg": ".mp3",
    "audio/aac": ".aac",
}


def _resolve_upload_filename(filename: str | None, mime_type: str | None) -> str:
    raw_name = (filename or "voice.webm").strip()
    suffix = Path(raw_name).suffix.lower()
    if suffix in (".webm", ".m4a", ".mp4", ".ogg", ".wav", ".mp3", ".aac"):
        return raw_name
    ext = _MIME_TO_EXT.get((mime_type or "").lower(), ".webm")
    return f"voice{ext}"


def _extract_choice_content(payload: dict[str, Any]) -> str | None:
    choices = payload.get("choices") or []
    if not choices or not isinstance(choices, list):
        return None
    first = choices[0] if isinstance(choices[0], dict) else {}
    message = first.get("message") or {}
    if not isinstance(message, dict):
        return None
    content = message.get("content")
    return content if isinstance(content, str) else None


def _wants_json_mode(req: AssistantChatRequest) -> bool:
    combined = f"{req.system_prompt or ''}\n{req.message or ''}"
    return "json" in combined.lower()


async def _post_multipart(
    url: str,
    *,
    headers: dict[str, str],
    files: dict[str, Any],
    data: dict[str, Any],
    timeout_sec: float,
) -> httpx.Response:
    shared = get_shared_http_client()
    if shared is not None:
        return await shared.post(
            url, headers=headers, files=files, data=data, timeout=timeout_sec
        )
    async with httpx.AsyncClient(timeout=timeout_sec) as client:
        return await client.post(url, headers=headers, files=files, data=data)


async def _post_json(
    url: str,
    *,
    headers: dict[str, str],
    payload: dict[str, Any],
    timeout_sec: float,
) -> httpx.Response:
    shared = get_shared_http_client()
    if shared is not None:
        return await shared.post(url, headers=headers, json=payload, timeout=timeout_sec)
    async with httpx.AsyncClient(timeout=timeout_sec) as client:
        return await client.post(url, headers=headers, json=payload)


class VoiceService:
    @staticmethod
    def reset_circuit_breakers() -> None:
        groq_stt_breaker.reset()
        groq_chat_breaker.reset()
        openai_chat_breaker.reset()

    @staticmethod
    async def transcribe_audio(
        file_bytes: bytes,
        filename: str = "voice.webm",
        context_prompt: str | None = None,
        entities: dict[str, Any] | None = None,
        mime_type: str | None = None,
    ) -> SpeechTranscribeResponse:
        start_time = time.time()

        if not file_bytes:
            return SpeechTranscribeResponse(
                text="",
                raw_text="",
                normalized_text="",
                confidence=0.0,
                duration_sec=0.0,
                rejected_reason="NO_SPEECH_OR_HALLUCINATION",
                corrections=[],
                segments_filtered=0,
                provider="WEB_SPEECH_FALLBACK",
                fallback=True,
                duration_ms=0,
            )

        api_key = settings.GROQ_API_KEY.strip() if settings.GROQ_API_KEY else ""
        if not api_key:
            logger.info("Chưa cấu hình GROQ_API_KEY trong aiService. Fallback sang Web Speech API.")
            duration_ms = int((time.time() - start_time) * 1000)
            return SpeechTranscribeResponse(
                text="",
                raw_text="",
                normalized_text="",
                confidence=0.0,
                duration_sec=0.0,
                rejected_reason=None,
                corrections=[],
                segments_filtered=0,
                provider="WEB_SPEECH_FALLBACK",
                fallback=True,
                duration_ms=duration_ms,
            )

        if not groq_stt_breaker.allow_request():
            duration_ms = int((time.time() - start_time) * 1000)
            log_ai_event(
                logger,
                "groq_stt_circuit_open",
                level=logging.WARNING,
                circuit_state=groq_stt_breaker.state,
                duration_ms=duration_ms,
            )
            return SpeechTranscribeResponse(
                text="",
                raw_text="",
                normalized_text="",
                confidence=0.0,
                duration_sec=0.0,
                rejected_reason=None,
                corrections=[],
                segments_filtered=0,
                provider="WEB_SPEECH_FALLBACK",
                fallback=True,
                duration_ms=duration_ms,
            )

        upload_name = _resolve_upload_filename(filename, mime_type)
        effective_prompt = (
            context_prompt.strip() if context_prompt and context_prompt.strip() else DOMAIN_PROMPT
        )[:650]

        try:
            headers = {"Authorization": f"Bearer {api_key}"}
            files = {
                "file": (upload_name, file_bytes, mime_type or "application/octet-stream")
            }
            data = {
                "model": settings.GROQ_STT_MODEL or "whisper-large-v3",
                "language": "vi",
                "temperature": "0",
                "response_format": "verbose_json",
                "prompt": effective_prompt,
            }

            response = await _post_multipart(
                GROQ_STT_ENDPOINT,
                headers=headers,
                files=files,
                data=data,
                timeout_sec=GROQ_STT_TIMEOUT_SEC,
            )

            duration_ms = int((time.time() - start_time) * 1000)

            if response.status_code == 200:
                groq_stt_breaker.record_success()
                result = response.json()
                guard = filter_whisper_verbose_json(result)
                if guard.rejected_reason is not None:
                    log_ai_event(
                        logger,
                        "voice_stt_rejected_hallucination",
                        provider="GROQ_WHISPER_LARGE_V3",
                        duration_ms=duration_ms,
                        rejected_reason=guard.rejected_reason,
                        segments_filtered=guard.segments_filtered,
                        raw_len=len(guard.raw_text),
                    )
                    return SpeechTranscribeResponse(
                        text="",
                        raw_text=guard.raw_text,
                        normalized_text="",
                        confidence=0.0,
                        duration_sec=guard.duration_sec,
                        rejected_reason=guard.rejected_reason,
                        corrections=[],
                        segments_filtered=guard.segments_filtered,
                        provider="GROQ_WHISPER_LARGE_V3",
                        fallback=False,
                        duration_ms=duration_ms,
                    )

                normalized_text, corrections = await asyncio.to_thread(
                    postprocess_vietnamese_phonetic,
                    guard.filtered_text,
                    entities,
                )
                log_ai_event(
                    logger,
                    "voice_stt_completed",
                    provider="GROQ_WHISPER_LARGE_V3",
                    duration_ms=duration_ms,
                    confidence=round(guard.confidence, 4),
                    chars=len(normalized_text),
                    corrections_count=len(corrections),
                    segments_filtered=guard.segments_filtered,
                )
                logger.debug("Groq Whisper STT transcript: '%s'", normalized_text)
                return SpeechTranscribeResponse(
                    text=normalized_text,
                    raw_text=guard.raw_text,
                    normalized_text=normalized_text,
                    confidence=guard.confidence,
                    duration_sec=guard.duration_sec,
                    rejected_reason=None,
                    corrections=corrections,
                    segments_filtered=guard.segments_filtered,
                    provider="GROQ_WHISPER_LARGE_V3",
                    fallback=False,
                    duration_ms=duration_ms,
                )
            if response.status_code == 429 or response.status_code >= 500:
                groq_stt_breaker.record_failure()
            logger.warning("Groq Whisper returned HTTP %s", response.status_code)
        except Exception as ex:
            groq_stt_breaker.record_failure()
            logger.warning(
                "Error calling Groq Whisper API (fallback to Web Speech): %s",
                type(ex).__name__,
            )

        duration_ms = int((time.time() - start_time) * 1000)
        return SpeechTranscribeResponse(
            text="",
            raw_text="",
            normalized_text="",
            confidence=0.0,
            duration_sec=0.0,
            rejected_reason=None,
            corrections=[],
            segments_filtered=0,
            provider="WEB_SPEECH_FALLBACK",
            fallback=True,
            duration_ms=duration_ms,
        )

    @staticmethod
    async def chat_completion(req: AssistantChatRequest) -> AssistantChatResponse:
        start_time = time.time()
        messages: list[dict[str, str]] = []
        if req.system_prompt:
            messages.append({"role": "system", "content": req.system_prompt})
        if req.history:
            for item in req.history[-MAX_HISTORY_TURNS:]:
                if isinstance(item, dict):
                    raw_role = str(item.get("role", "user"))
                    raw_content = str(item.get("content", ""))
                else:
                    raw_role = str(item.role or "user")
                    raw_content = str(item.content or "")
                clean_content = raw_content.strip()[:MAX_HISTORY_TURN_CHARS]
                if clean_content:
                    mapped_role = (
                        "assistant" if raw_role.lower() in ("assistant", "bot") else "user"
                    )
                    messages.append({"role": mapped_role, "content": clean_content})
        messages.append({"role": "user", "content": req.message})

        use_json_mode = _wants_json_mode(req)

        groq_key = settings.GROQ_API_KEY.strip() if settings.GROQ_API_KEY else ""
        if groq_key:
            if groq_chat_breaker.allow_request():
                try:
                    headers = {
                        "Authorization": f"Bearer {groq_key}",
                        "Content-Type": "application/json",
                    }
                    payload: dict[str, Any] = {
                        "model": settings.GROQ_CHAT_MODEL or "llama-3.3-70b-versatile",
                        "temperature": 0.1,
                        "messages": messages,
                    }
                    if use_json_mode:
                        payload["response_format"] = {"type": "json_object"}

                    response = await _post_json(
                        GROQ_CHAT_ENDPOINT,
                        headers=headers,
                        payload=payload,
                        timeout_sec=GROQ_CHAT_TIMEOUT_SEC,
                    )

                    duration_ms = int((time.time() - start_time) * 1000)
                    if response.status_code == 200:
                        data = response.json()
                        content = _extract_choice_content(data)
                        if content is not None:
                            groq_chat_breaker.record_success()
                            provider_name = settings.GROQ_CHAT_MODEL or "llama-3.3-70b-versatile"
                            log_ai_event(
                                logger,
                                "voice_chat_completed",
                                provider=provider_name,
                                duration_ms=duration_ms,
                                json_mode=use_json_mode,
                                history_turns=max(0, len(messages) - 2),
                                **extract_token_usage(data),
                            )
                            return AssistantChatResponse(
                                content=content,
                                provider=provider_name,
                                fallback=False,
                                duration_ms=duration_ms,
                            )
                        groq_chat_breaker.record_failure()
                        logger.warning("Groq Chat LLM returned 200 with empty choices")
                    else:
                        if response.status_code == 429 or response.status_code >= 500:
                            groq_chat_breaker.record_failure()
                        logger.warning("Groq Chat LLM returned HTTP %s", response.status_code)
                except Exception as ex:
                    groq_chat_breaker.record_failure()
                    logger.warning("Groq Chat LLM request failed: %s", type(ex).__name__)
            else:
                log_ai_event(
                    logger,
                    "groq_chat_circuit_open",
                    level=logging.WARNING,
                    circuit_state=groq_chat_breaker.state,
                )

        openai_key = settings.OPENAI_API_KEY.strip() if settings.OPENAI_API_KEY else ""
        if openai_key:
            if openai_chat_breaker.allow_request():
                try:
                    headers = {
                        "Authorization": f"Bearer {openai_key}",
                        "Content-Type": "application/json",
                    }
                    payload = {
                        "model": settings.OPENAI_MODEL or "gpt-4o-mini",
                        "temperature": 0.1,
                        "messages": messages,
                    }
                    if use_json_mode:
                        payload["response_format"] = {"type": "json_object"}

                    response = await _post_json(
                        settings.OPENAI_API_URL,
                        headers=headers,
                        payload=payload,
                        timeout_sec=OPENAI_CHAT_TIMEOUT_SEC,
                    )

                    duration_ms = int((time.time() - start_time) * 1000)
                    if response.status_code == 200:
                        data = response.json()
                        content = _extract_choice_content(data)
                        if content is not None:
                            openai_chat_breaker.record_success()
                            provider_name = settings.OPENAI_MODEL or "gpt-4o-mini"
                            log_ai_event(
                                logger,
                                "voice_chat_completed",
                                provider=provider_name,
                                fallback_from="groq",
                                duration_ms=duration_ms,
                                json_mode=use_json_mode,
                                history_turns=max(0, len(messages) - 2),
                                **extract_token_usage(data),
                            )
                            return AssistantChatResponse(
                                content=content,
                                provider=provider_name,
                                fallback=False,
                                duration_ms=duration_ms,
                            )
                        openai_chat_breaker.record_failure()
                        logger.warning("OpenAI Chat fallback returned 200 with empty choices")
                    else:
                        if response.status_code == 429 or response.status_code >= 500:
                            openai_chat_breaker.record_failure()
                        logger.warning(
                            "OpenAI Chat fallback returned HTTP %s", response.status_code
                        )
                except Exception as ex:
                    openai_chat_breaker.record_failure()
                    logger.warning("OpenAI Chat fallback failed: %s", type(ex).__name__)
            else:
                log_ai_event(
                    logger,
                    "openai_chat_circuit_open",
                    level=logging.WARNING,
                    circuit_state=openai_chat_breaker.state,
                )

        duration_ms = int((time.time() - start_time) * 1000)
        return AssistantChatResponse(
            content="",
            provider="LOCAL_FALLBACK",
            fallback=True,
            duration_ms=duration_ms,
        )


voice_service = VoiceService()
