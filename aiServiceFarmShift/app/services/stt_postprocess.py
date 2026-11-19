"""Backward-compatible wrapper delegating to phonetic_postprocess."""
from app.services.phonetic_postprocess import postprocess_vietnamese_phonetic


def postprocess_vietnamese_stt(text: str, entities: dict | None = None) -> str:
    normalized, _ = postprocess_vietnamese_phonetic(text, entities=entities)
    return normalized
