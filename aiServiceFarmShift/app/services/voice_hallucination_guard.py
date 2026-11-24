"""3-Layer Whisper Hallucination Guard & Audio Binary Signature Validator.

Protects the FarmShift STT pipeline against:
1. Spoofed / non-audio payloads and oversized uploads (> 10 MB) via binary magic bytes.
2. Unauthorized internal calls via constant-time X-Internal-AI-Token verification.
3. Groq whisper-large-v3 acoustic hallucinations (no_speech_prob, avg_logprob,
   compression_ratio), Vietnamese YouTube/subtitle blacklist phrases, and
   pathological token repetition loops.
"""
from __future__ import annotations

from dataclasses import dataclass
import math
import re
import secrets
from typing import Any

MAX_AUDIO_BYTES = 10 * 1024 * 1024  # 10 MB

NO_SPEECH_PROB_THRESHOLD = 0.65
AVG_LOGPROB_THRESHOLD = -1.15
COMPRESSION_RATIO_THRESHOLD = 2.4

HALLUCINATION_BLACKLIST: tuple[str, ...] = (
    "hẹn gặp lại các bạn ở video tiếp theo",
    "hẹn gặp lại các bạn trong video tiếp theo",
    "chào mừng các bạn đến với kênh",
    "hãy đăng ký kênh để ủng hộ",
    "cảm ơn các bạn đã xem video",
    "đăng ký kênh để ủng hộ",
    "cảm ơn đã xem video",
    "cảm ơn đã theo dõi",
    "hãy đăng ký kênh",
    "bản quyền thuộc về",
    "like và subscribe",
    "đăng ký kênh",
    "ghiền mì gõ",
    "la la school",
    "người dịch",
    "amara.org",
    "subscribe",
    "sub by",
)

_BLACKLIST_COMBINED_PATTERN: re.Pattern[str] = re.compile(
    r"(?:(?:"
    + "|".join(re.escape(phrase) for phrase in sorted(HALLUCINATION_BLACKLIST, key=len, reverse=True))
    + r")[\s.!?,…:-]*)+",
    re.IGNORECASE | re.UNICODE,
)

_REPETITION_PATTERN = re.compile(
    r"(?iu)(?:^|(?<=[\s,;.\"'!?]))([^\s,;.\"'!?]+(?:\s+[^\s,;.\"'!?]+){0,5})"
    r"(?:\s*[,;.]*\s+\1(?=$|[\s,;.\"'!?])){2,}"
)


@dataclass
class HallucinationGuardResult:
    raw_text: str
    filtered_text: str
    confidence: float
    duration_sec: float
    rejected_reason: str | None
    segments_filtered: int


def verify_internal_token(
    provided: str | None,
    expected: str | None,
    *,
    allow_empty: bool = False,
) -> bool:
    """Constant-time validation for X-Internal-AI-Token (fail-closed unless allow_empty=True)."""
    exp = (expected or "").strip()
    if not exp:
        return bool(allow_empty)
    prov = (provided or "").strip()
    return bool(prov) and secrets.compare_digest(prov, exp)


def validate_audio_magic_bytes(file_bytes: bytes, filename: str = "") -> tuple[bool, str]:
    """Verify binary audio header signature before calling Groq Whisper."""
    if not file_bytes or len(file_bytes) < 4:
        return False, "Tệp âm thanh rỗng hoặc quá ngắn."
    if len(file_bytes) > MAX_AUDIO_BYTES:
        return False, "Tệp âm thanh vượt quá dung lượng tối đa 10 MB."

    head4 = file_bytes[:4]
    if head4 == b"\x1a\x45\xdf\xa3":
        return True, "audio/webm"
    if len(file_bytes) >= 8 and file_bytes[4:8] == b"ftyp":
        return True, "audio/mp4"
    if head4 == b"OggS":
        return True, "audio/ogg"
    if len(file_bytes) >= 12 and head4 == b"RIFF" and file_bytes[8:12] == b"WAVE":
        return True, "audio/wav"
    if file_bytes[:3] == b"ID3" or (file_bytes[0] == 0xFF and file_bytes[1] in (0xFB, 0xFA, 0xF3, 0xF2, 0xE3, 0xE2)):
        return True, "audio/mpeg"
    if file_bytes[0] == 0xFF and (file_bytes[1] & 0xF6) == 0xF0:
        return True, "audio/aac"

    safe_name = re.sub(r"[^a-zA-Z0-9._-]", "_", (filename or "unknown"))[:64]
    return (
        False,
        f"Định dạng âm thanh không hợp lệ ({safe_name}): magic bytes không khớp WebM/MP4/OGG/WAV/MP3.",
    )


def _strip_blacklist_artifacts(text: str) -> str:
    cleaned = re.sub(r"\s+", " ", (text or "")).strip()
    cleaned = _BLACKLIST_COMBINED_PATTERN.sub(" ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" \t\r\n.,;!?-")
    return cleaned


def _collapse_repetitions(text: str) -> tuple[str, bool]:
    if not text:
        return "", False
    had_rep = False

    def _repl(match: re.Match[str]) -> str:
        nonlocal had_rep
        had_rep = True
        return match.group(1)

    collapsed = _REPETITION_PATTERN.sub(_repl, text)
    collapsed = re.sub(r"\s+", " ", collapsed).strip()
    return collapsed, had_rep


def _meaningful_char_count(text: str) -> int:
    return sum(1 for ch in (text or "") if ch.isalnum())


def _safe_float(value: Any, default: float) -> float:
    if value is None:
        return default
    try:
        num = float(value)
    except (TypeError, ValueError):
        return default
    return num if math.isfinite(num) else default


def filter_whisper_verbose_json(payload: dict[str, Any] | None) -> HallucinationGuardResult:
    """Run the 3-layer Whisper hallucination & silence filter over verbose_json output."""
    if not isinstance(payload, dict):
        return HallucinationGuardResult(
            raw_text="",
            filtered_text="",
            confidence=0.0,
            duration_sec=0.0,
            rejected_reason="NO_SPEECH_OR_HALLUCINATION",
            segments_filtered=0,
        )

    raw_text = re.sub(r"\s+", " ", str(payload.get("text") or "")).strip()
    duration_sec = max(0.0, _safe_float(payload.get("duration"), 0.0))

    raw_segments = payload.get("segments")
    segments_filtered = 0
    kept_texts: list[str] = []
    logprobs: list[float] = []
    no_speeches: list[float] = []

    if isinstance(raw_segments, list) and len(raw_segments) > 0:
        for seg in raw_segments:
            if not isinstance(seg, dict):
                segments_filtered += 1
                continue

            no_speech = _safe_float(seg.get("no_speech_prob"), 0.05)
            avg_logprob = _safe_float(seg.get("avg_logprob"), -0.35)
            comp_ratio = _safe_float(seg.get("compression_ratio"), 1.0)

            # Layer 1: Acoustic quality gating
            if (
                no_speech > NO_SPEECH_PROB_THRESHOLD
                or avg_logprob < AVG_LOGPROB_THRESHOLD
                or comp_ratio > COMPRESSION_RATIO_THRESHOLD
            ):
                segments_filtered += 1
                continue

            # Layer 2: Per-segment Vietnamese Whisper blacklist check
            seg_text = _strip_blacklist_artifacts(str(seg.get("text") or ""))
            if _meaningful_char_count(seg_text) < 2:
                segments_filtered += 1
                continue

            kept_texts.append(seg_text)
            logprobs.append(avg_logprob)
            no_speeches.append(no_speech)

        if not kept_texts:
            return HallucinationGuardResult(
                raw_text=raw_text,
                filtered_text="",
                confidence=0.0,
                duration_sec=duration_sec,
                rejected_reason="NO_SPEECH_OR_HALLUCINATION",
                segments_filtered=segments_filtered,
            )

        candidate_text = " ".join(kept_texts)
    else:
        candidate_text = raw_text

    # Layer 2 (full-transcript pass) & Layer 3 (repetition collapse)
    candidate_text = _strip_blacklist_artifacts(candidate_text)
    cleaned_text, had_repetition = _collapse_repetitions(candidate_text)

    if _meaningful_char_count(cleaned_text) < 2:
        return HallucinationGuardResult(
            raw_text=raw_text,
            filtered_text="",
            confidence=0.0,
            duration_sec=duration_sec,
            rejected_reason="NO_SPEECH_OR_HALLUCINATION",
            segments_filtered=segments_filtered + (1 if raw_text and segments_filtered == 0 else 0),
        )

    if logprobs:
        mean_logprob = sum(logprobs) / len(logprobs)
        mean_no_speech = sum(no_speeches) / len(no_speeches)
        confidence = math.exp(mean_logprob) * (1.0 - mean_no_speech)
        if had_repetition:
            confidence *= 0.75
    else:
        confidence = 0.65 if had_repetition else 0.78

    confidence = round(max(0.0, min(1.0, confidence)), 4)

    return HallucinationGuardResult(
        raw_text=raw_text,
        filtered_text=cleaned_text,
        confidence=confidence,
        duration_sec=duration_sec,
        rejected_reason=None,
        segments_filtered=segments_filtered,
    )
