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
from app.services.agent_tools import DEFAULT_LLM_FIRST_SYSTEM_PROMPT, get_core_tools_for_role
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


def _extract_choice_tool_calls(payload: dict[str, Any]) -> list[dict[str, Any]] | None:
    choices = payload.get("choices") or []
    if not choices or not isinstance(choices, list):
        return None
    first = choices[0] if isinstance(choices[0], dict) else {}
    message = first.get("message") or {}
    if not isinstance(message, dict):
        return None
    raw_calls = message.get("tool_calls")
    if not isinstance(raw_calls, list) or not raw_calls:
        return None
    normalized_calls: list[dict[str, Any]] = []
    for call in raw_calls:
        if not isinstance(call, dict):
            continue
        fn = call.get("function") if isinstance(call.get("function"), dict) else {}
        name = str(fn.get("name") or call.get("name") or "").strip()
        if not name:
            continue
        raw_args = fn.get("arguments") if "arguments" in fn else call.get("arguments")
        normalized_calls.append({
            "id": str(call.get("id") or f"call_{len(normalized_calls) + 1}"),
            "type": str(call.get("type") or "function"),
            "function": {
                "name": name,
                "arguments": raw_args if isinstance(raw_args, (str, dict)) else "{}",
            },
        })
    return normalized_calls or None


def _wants_json_mode(req: AssistantChatRequest) -> bool:
    if req.tools or req.use_default_tools or req.tool_messages:
        return False
    combined = f"{req.system_prompt or ''}\n{req.message or ''}"
    return "json" in combined.lower()


def _extract_error_message(response: httpx.Response) -> str:
    """Safely extract provider error details (without leaking secrets) for diagnostic logging."""
    try:
        payload = response.json()
        if isinstance(payload, dict):
            err = payload.get("error")
            if isinstance(err, dict):
                msg = str(err.get("message") or err.get("code") or err)
                return msg[:600]
            if err is not None:
                return str(err)[:600]
            if "detail" in payload:
                return str(payload["detail"])[:600]
    except Exception:
        pass
    try:
        raw_text = getattr(response, "text", None)
        if isinstance(raw_text, str) and raw_text.strip():
            return raw_text.strip()[:600]
    except Exception:
        pass
    return "no_error_body"


def _sanitize_tool_messages(raw_messages: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    """Validate and normalize Turn-2 assistant(tool_calls) and tool(result) messages."""
    if not raw_messages:
        return []
    out: list[dict[str, Any]] = []
    for item in raw_messages:
        if not isinstance(item, dict):
            continue
        role = str(item.get("role") or "").strip().lower()
        if role == "assistant":
            msg: dict[str, Any] = {"role": "assistant"}
            content = item.get("content")
            msg["content"] = str(content) if isinstance(content, str) and content else None
            tool_calls = item.get("tool_calls") or item.get("toolCalls")
            if isinstance(tool_calls, list) and tool_calls:
                msg["tool_calls"] = tool_calls
            out.append(msg)
        elif role == "tool":
            tool_call_id = str(item.get("tool_call_id") or item.get("toolCallId") or "").strip()
            name = str(item.get("name") or "").strip()
            content = str(item.get("content") or "{}")[:12000]
            if tool_call_id:
                tool_msg: dict[str, Any] = {
                    "role": "tool",
                    "tool_call_id": tool_call_id,
                    "content": content,
                }
                if name:
                    tool_msg["name"] = name
                out.append(tool_msg)
    return out


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
            if response.status_code in (401, 403, 429) or response.status_code >= 500:
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
        messages: list[dict[str, Any]] = []
        effective_system_prompt = req.system_prompt
        if not effective_system_prompt and req.use_default_tools:
            role_label = (req.user_role or "ROLE_FARM_OWNER").strip().upper()
            ctx_lines = [f"- Vai trò người dùng (user_role): {role_label}"]
            if req.current_route and req.current_route.strip():
                ctx_lines.append(f"- Màn hình đang mở (current_route): {req.current_route.strip()}")
            effective_system_prompt = (
                DEFAULT_LLM_FIRST_SYSTEM_PROMPT
                + "\nNGỮ CẢNH PHIÊN HIỆN TẠI:\n"
                + "\n".join(ctx_lines)
            )
        if effective_system_prompt:
            messages.append({"role": "system", "content": effective_system_prompt})
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

        tool_messages = _sanitize_tool_messages(req.tool_messages)
        if tool_messages:
            messages.extend(tool_messages)

        effective_tools: list[dict[str, Any]] | None = None
        if not tool_messages:
            if req.tools:
                effective_tools = req.tools
            elif req.use_default_tools:
                effective_tools = get_core_tools_for_role(req.user_role)

        use_json_mode = _wants_json_mode(req)
        effective_temp = (
            req.temperature
            if req.temperature is not None
            else (0.25 if tool_messages else 0.1)
        )

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
                        "temperature": effective_temp,
                        "messages": messages,
                    }
                    if effective_tools:
                        payload["tools"] = effective_tools
                        payload["tool_choice"] = req.tool_choice or "auto"
                    elif use_json_mode:
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
                        tool_calls = _extract_choice_tool_calls(data)
                        if content is not None or tool_calls is not None:
                            groq_chat_breaker.record_success()
                            provider_name = settings.GROQ_CHAT_MODEL or "llama-3.3-70b-versatile"
                            log_ai_event(
                                logger,
                                "voice_chat_completed",
                                provider=provider_name,
                                duration_ms=duration_ms,
                                json_mode=use_json_mode,
                                tool_calls_count=len(tool_calls) if tool_calls else 0,
                                synthesis_turn=bool(tool_messages),
                                history_turns=max(0, len(messages) - 2 - len(tool_messages)),
                                **extract_token_usage(data),
                            )
                            return AssistantChatResponse(
                                content=content or "",
                                tool_calls=tool_calls,
                                provider=provider_name,
                                fallback=False,
                                duration_ms=duration_ms,
                            )
                        groq_chat_breaker.record_failure()
                        logger.warning(
                            "Groq Chat LLM returned HTTP 200 with empty choices (model=%s)",
                            payload["model"],
                        )
                    else:
                        err_msg = _extract_error_message(response)
                        if response.status_code in (401, 403, 404, 429) or response.status_code >= 500:
                            groq_chat_breaker.record_failure()
                        logger.error(
                            "Groq Chat LLM failed: status_code=%s error_message=%s",
                            response.status_code,
                            err_msg,
                        )
                        log_ai_event(
                            logger,
                            "groq_chat_http_error",
                            level=logging.ERROR,
                            status_code=response.status_code,
                            error_message=err_msg,
                            duration_ms=duration_ms,
                        )
                except Exception as ex:
                    groq_chat_breaker.record_failure()
                    logger.error(
                        "Groq Chat LLM request exception: type=%s error_message=%s",
                        type(ex).__name__,
                        str(ex)[:600],
                    )
                    log_ai_event(
                        logger,
                        "groq_chat_exception",
                        level=logging.ERROR,
                        error_type=type(ex).__name__,
                        error_message=str(ex)[:600],
                    )
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
                        "temperature": effective_temp,
                        "messages": messages,
                    }
                    if effective_tools:
                        payload["tools"] = effective_tools
                        payload["tool_choice"] = req.tool_choice or "auto"
                    elif use_json_mode:
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
                        tool_calls = _extract_choice_tool_calls(data)
                        if content is not None or tool_calls is not None:
                            openai_chat_breaker.record_success()
                            provider_name = settings.OPENAI_MODEL or "gpt-4o-mini"
                            log_ai_event(
                                logger,
                                "voice_chat_completed",
                                provider=provider_name,
                                fallback_from="groq",
                                duration_ms=duration_ms,
                                json_mode=use_json_mode,
                                tool_calls_count=len(tool_calls) if tool_calls else 0,
                                synthesis_turn=bool(tool_messages),
                                history_turns=max(0, len(messages) - 2 - len(tool_messages)),
                                **extract_token_usage(data),
                            )
                            return AssistantChatResponse(
                                content=content or "",
                                tool_calls=tool_calls,
                                provider=provider_name,
                                fallback=False,
                                duration_ms=duration_ms,
                            )
                        openai_chat_breaker.record_failure()
                        logger.warning(
                            "OpenAI Chat fallback returned HTTP 200 with empty choices (model=%s)",
                            payload["model"],
                        )
                    else:
                        err_msg = _extract_error_message(response)
                        if response.status_code in (401, 403, 404, 429) or response.status_code >= 500:
                            openai_chat_breaker.record_failure()
                        logger.error(
                            "OpenAI Chat fallback failed: status_code=%s error_message=%s",
                            response.status_code,
                            err_msg,
                        )
                        log_ai_event(
                            logger,
                            "openai_chat_http_error",
                            level=logging.ERROR,
                            status_code=response.status_code,
                            error_message=err_msg,
                            duration_ms=duration_ms,
                        )
                except Exception as ex:
                    openai_chat_breaker.record_failure()
                    logger.error(
                        "OpenAI Chat fallback exception: type=%s error_message=%s",
                        type(ex).__name__,
                        str(ex)[:600],
                    )
                    log_ai_event(
                        logger,
                        "openai_chat_exception",
                        level=logging.ERROR,
                        error_type=type(ex).__name__,
                        error_message=str(ex)[:600],
                    )
            else:
                log_ai_event(
                    logger,
                    "openai_chat_circuit_open",
                    level=logging.WARNING,
                    circuit_state=openai_chat_breaker.state,
                )

        duration_ms = int((time.time() - start_time) * 1000)
        logger.warning(
            "All LLM providers unavailable (groq_configured=%s, openai_configured=%s) — falling back to LOCAL_FALLBACK",
            bool(groq_key),
            bool(openai_key),
        )
        return AssistantChatResponse(
            content="",
            provider="LOCAL_FALLBACK",
            fallback=True,
            duration_ms=duration_ms,
        )


voice_service = VoiceService()
