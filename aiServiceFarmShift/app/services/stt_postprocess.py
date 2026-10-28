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
    # chính tả đồng âm nghiệp vụ chăn nuôi
    (re.compile(_B + r"nhật\s+(?:kí|kỉ|kỹ|ky|kì|kỷ)(?![^\W\d_])", _FLAGS), "nhật ký"),
    (re.compile(_B + r"(?:sổ|số|xổ)\s+(?:quỷ|quĩ|quý|quỹ|qũy|quỳ)(?![^\W\d_])", _FLAGS), "sổ quỹ"),
    (re.compile(_B + r"(?:cần\s+mẫu|cân\s+mẩu)(?![^\W\d_])", _FLAGS), "cân mẫu"),
    (re.compile(_B + r"hao\s+hục(?![^\W\d_])", _FLAGS), "hao hụt"),
    (re.compile(_B + r"thải\s+lọai(?![^\W\d_])", _FLAGS), "thải loại"),
    # tên thương hiệu / cám / thuốc nói tách âm
    (re.compile(_B + r"(?:hai|hi|hy)\s*(?:gờ\s*|gơ\s*)?(?:rô|grô|gro)\s*0?1(?![^\W\d_])", _FLAGS), "Higro 01"),
    (re.compile(_B + r"cám\s+số\s+1(?![^\W\d_])", _FLAGS), "Higro 01"),
    (re.compile(_B + r"(?:hai|hi|hy)\s*(?:gờ\s*|gơ\s*)?(?:rô|grô|gro)\s*0?2(?![^\W\d_])", _FLAGS), "Higro 02"),
    (re.compile(_B + r"cám\s+số\s+2(?![^\W\d_])", _FLAGS), "Higro 02"),
    (re.compile(_B + r"(?:hai|hi|hy)\s*(?:gờ\s*|gơ\s*)?(?:rô|grô|gro)(?![^\W\d_])", _FLAGS), "Higro"),
    (re.compile(_B + r"(?:xi\s*pi|si\s*pi|cp)\s*511(?![^\W\d_])", _FLAGS), "CP 511"),
    (re.compile(_B + r"cám\s+(?:xi\s*pi|si\s*pi|cp)(?![^\W\d_])", _FLAGS), "Cám CP 511"),
    (re.compile(_B + r"(?:đa\s+ba\s+cô|da\s+ba\s+co|đabacô)(?![^\W\d_])", _FLAGS), "Dabaco"),
    (re.compile(_B + r"(?:ca\s+giu|ca\s+gin|các\s+giu)(?![^\W\d_])", _FLAGS), "Cargill"),
    (re.compile(_B + r"(?:han\s+vét|hàn\s+vét)(?![^\W\d_])", _FLAGS), "Hanvet"),
    (re.compile(_B + r"(?:la\s+sô\s+ta|la\s+xô\s+ta|lasôta)(?![^\W\d_])", _FLAGS), "Lasota"),
    (re.compile(_B + r"(?:gum\s+bô\s+rô|găm\s+bô\s+rô)(?![^\W\d_])", _FLAGS), "Gumboro"),
    (re.compile(_B + r"(?:niu\s+cát\s+xơ|niu\s+cát\s+xơn|niu\s+cat\s+xon)(?![^\W\d_])", _FLAGS), "Newcastle"),
    (re.compile(_B + r"(?:ép\s+xê\s+rờ|ép\s+cờ\s+rờ|f\s+c\s+r|hệ\s+số\s+ép)(?![^\W\d_])", _FLAGS), "FCR"),
    # khu vực & chuồng đọc chữ cái tiếng Việt ("nhà bê một" -> "Nhà B1", "khu di thịt" -> "Khu J Thịt")
    (re.compile(_B + r"khu\s+(?:di|gi|j)\s+thịt(?![^\W\d_])", _FLAGS), "Khu J Thịt"),
    (re.compile(_B + r"khu\s+mía(?:\s+thịt)?(?![^\W\d_])", _FLAGS), "Khu Mía Thịt"),
    (re.compile(_B + r"nhà\s+bê\s+(?:một|1)(?![^\W\d_])", _FLAGS), "Nhà B1"),
    (re.compile(_B + r"nhà\s+bê\s+(?:hai|2)(?![^\W\d_])", _FLAGS), "Nhà B2"),
    (re.compile(_B + r"chuồng\s+bê\s+(?:một|1)(?![^\W\d_])", _FLAGS), "Chuồng B1"),
    (re.compile(_B + r"chuồng\s+bê\s+(?:hai|2)(?![^\W\d_])", _FLAGS), "Chuồng B2"),
    # mã đơn nhập / phiếu xuất nhập nội bộ đọc rời
    (re.compile(_B + r"(?:n\s*h|nh)\s*(\d{3,8})(?![^\W\d_])", _FLAGS), r"NH\1"),
    (re.compile(_B + r"(?:x\s*n\s*b|xnb)\s*(\d{3,8})(?![^\W\d_])", _FLAGS), r"XNB\1"),
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
