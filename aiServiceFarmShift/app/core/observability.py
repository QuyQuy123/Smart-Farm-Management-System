"""Structured logging, W3C correlation ID propagation, and Provider Circuit Breaker."""
from __future__ import annotations

from contextvars import ContextVar, Token
from datetime import datetime, timezone
import json
import logging
import threading
import time
from typing import Any

_correlation_id_var: ContextVar[str] = ContextVar("correlation_id", default="-")


def get_correlation_id() -> str:
    return _correlation_id_var.get()


def set_correlation_id(cid: str | None) -> Token[str]:
    clean = (cid or "").strip()
    return _correlation_id_var.set(clean[:128] if clean else "-")


def reset_correlation_id(token: Token[str]) -> None:
    _correlation_id_var.reset(token)


def extract_token_usage(payload: dict[str, Any] | None) -> dict[str, int]:
    """Extract prompt/completion/total tokens from OpenAI or Groq chat/vision responses."""
    if not isinstance(payload, dict):
        return {"tokens_in": 0, "tokens_out": 0, "tokens_total": 0}
    usage = payload.get("usage")
    if not isinstance(usage, dict):
        return {"tokens_in": 0, "tokens_out": 0, "tokens_total": 0}
    tokens_in = int(usage.get("prompt_tokens") or usage.get("input_tokens") or 0)
    tokens_out = int(usage.get("completion_tokens") or usage.get("output_tokens") or 0)
    tokens_total = int(usage.get("total_tokens") or (tokens_in + tokens_out))
    return {
        "tokens_in": max(0, tokens_in),
        "tokens_out": max(0, tokens_out),
        "tokens_total": max(0, tokens_total),
    }


def log_ai_event(
    logger: logging.Logger,
    event: str,
    level: int = logging.INFO,
    **fields: Any,
) -> None:
    """Emit a single-line structured JSON log with correlation_id and non-sensitive metrics."""
    record: dict[str, Any] = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "level": logging.getLevelName(level),
        "service": "aiServiceFarmShift",
        "correlation_id": get_correlation_id(),
        "event": event,
    }
    for key, value in fields.items():
        if value is not None:
            record[key] = value
    logger.log(level, json.dumps(record, ensure_ascii=False, default=str))


class ProviderCircuitBreaker:
    """Thread-safe 3-state circuit breaker (CLOSED -> OPEN -> HALF_OPEN) for AI upstreams."""

    def __init__(
        self,
        name: str,
        *,
        failure_threshold: int = 3,
        reset_timeout_sec: float = 30.0,
    ) -> None:
        self.name = name
        self.failure_threshold = max(1, failure_threshold)
        self.reset_timeout_sec = max(0.1, reset_timeout_sec)
        self._lock = threading.Lock()
        self._state = "CLOSED"
        self._failure_count = 0
        self._opened_at = 0.0

    @property
    def state(self) -> str:
        with self._lock:
            if (
                self._state == "OPEN"
                and (time.monotonic() - self._opened_at) >= self.reset_timeout_sec
            ):
                self._state = "HALF_OPEN"
            return self._state

    @property
    def failure_count(self) -> int:
        with self._lock:
            return self._failure_count

    def allow_request(self) -> bool:
        with self._lock:
            if self._state == "CLOSED":
                return True
            if self._state == "OPEN":
                if (time.monotonic() - self._opened_at) >= self.reset_timeout_sec:
                    self._state = "HALF_OPEN"
                    return True
                return False
            return True

    def record_success(self) -> None:
        with self._lock:
            self._failure_count = 0
            self._state = "CLOSED"
            self._opened_at = 0.0

    def record_failure(self) -> None:
        with self._lock:
            self._failure_count += 1
            if self._state == "HALF_OPEN" or self._failure_count >= self.failure_threshold:
                self._state = "OPEN"
                self._opened_at = time.monotonic()

    def reset(self) -> None:
        with self._lock:
            self._state = "CLOSED"
            self._failure_count = 0
            self._opened_at = 0.0
