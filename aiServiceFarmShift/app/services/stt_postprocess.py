"""Hậu xử lý văn bản STT tiếng Việt cho lĩnh vực chăn nuôi (FarmShift).

Whisper / Web Speech thường nhận nhầm các từ đồng âm: "nhật kí", "sổ quỷ", "nhà a một"...
Module này chuẩn hóa chúng trước khi trả văn bản về Backend (AiAssistantService).
"""
import re

_UNITS = {
    "một": 1, "hai": 2, "ba": 3, "bốn": 4, "năm": 5,
    "sáu": 6, "bảy": 7, "tám": 8, "chín": 9, "mười": 10,
}
_NUM_WORDS = "|".join(_UNITS.keys())
KG_PER_BAG = 25

_FLAGS = re.IGNORECASE | re.UNICODE
_B = r"(?<![^\W\d_])"  # không đứng sau chữ cái

_RULES = [
    # chính tả đồng âm
    (re.compile(_B + r"nhật\s+(?:kí|kỉ|kỹ|ky|kì|kỷ)(?![^\W\d_])", _FLAGS), "nhật ký"),
    (re.compile(_B + r"(?:sổ|số|xổ)\s+(?:quỷ|quĩ|quý|quỹ|qũy|quỳ)(?![^\W\d_])", _FLAGS), "sổ quỹ"),
    # tên thương hiệu / thuốc nói tách âm
    (re.compile(_B + r"(?:hai|hi|hy)\s*(?:gờ\s*)?(?:rô|grô|gro)(?![^\W\d_])", _FLAGS), "Higro"),
    (re.compile(_B + r"đa\s+ba\s+cô(?![^\W\d_])", _FLAGS), "Dabaco"),
    (re.compile(_B + r"han\s+vét(?![^\W\d_])", _FLAGS), "Hanvet"),
    (re.compile(_B + r"la\s+sô\s+ta(?![^\W\d_])", _FLAGS), "Lasota"),
    (re.compile(_B + r"gum\s+bô\s+rô(?![^\W\d_])", _FLAGS), "Gumboro"),
    (re.compile(_B + r"niu\s+cát\s+xơ(?![^\W\d_])", _FLAGS), "Newcastle"),
]

# "nhà a một" -> "Nhà A1", "chuồng b hai" -> "Chuồng B2"
_BARN_WORD = re.compile(
    _B + r"(nhà|chuồng)\s+([a-d])\s+(" + _NUM_WORDS + r")(?![^\W\d_])", _FLAGS)
_BARN_DIGIT = re.compile(_B + r"(nhà|chuồng)\s+([a-d])\s*[-_]?\s*(\d{1,2})(?![\d\w])", _FLAGS)

# "triệu rưỡi" (không có số đứng trước) -> "1500000"; "hai triệu rưỡi" -> "2500000"
_MILLION_HALF = re.compile(
    r"(?<![\w.,])(?:(\d+(?:[.,]\d+)?|" + _NUM_WORDS + r")\s+)?triệu\s+rưỡi(?!\w)", _FLAGS)

# "hai bao" -> "50 kg" (STT hay rớt chữ "cám"); chỉ áp dụng khi không nói về vật tư khác
_BAG = re.compile(r"(?<![\w.,])(\d+(?:[.,]\d+)?|" + _NUM_WORDS + r")\s+bao(?!\w)", _FLAGS)
_BAG_BLOCKERS = ("vắc xin", "vắc-xin", "thuốc", "trấu", "dùng", "hóa đơn")


def _to_number(token: str) -> float:
    t = token.lower()
    if t in _UNITS:
        return float(_UNITS[t])
    return float(t.replace(",", "."))


def _format(value: float) -> str:
    return str(int(value)) if float(value).is_integer() else str(value)


def _barn_word(m: re.Match) -> str:
    return f"{m.group(1).capitalize()} {m.group(2).upper()}{_UNITS[m.group(3).lower()]}"


def _barn_digit(m: re.Match) -> str:
    return f"{m.group(1).capitalize()} {m.group(2).upper()}{m.group(3)}"


def _million_half(m: re.Match) -> str:
    base = _to_number(m.group(1)) if m.group(1) else 1.0
    return str(int(round(base * 1_000_000 + 500_000)))


def postprocess_vietnamese_stt(text: str) -> str:
    if not text:
        return text
    out = re.sub(r"\s+", " ", text).strip()
    for pattern, replacement in _RULES:
        out = pattern.sub(replacement, out)
    out = _BARN_WORD.sub(_barn_word, out)
    out = _BARN_DIGIT.sub(_barn_digit, out)
    out = _MILLION_HALF.sub(_million_half, out)
    lowered = out.lower()
    if not any(b in lowered for b in _BAG_BLOCKERS):
        out = _BAG.sub(lambda m: f"{_format(_to_number(m.group(1)) * KG_PER_BAG)} kg", out)
    return out
