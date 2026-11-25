"""Dynamic Vietnamese Poultry Phonetic & Colloquial STT Post-Processor.

Normalizes Groq whisper-large-v3 transcripts using:
1. Curated agricultural / poultry phonetic dictionary (Higro, J-Dabaco, Lasota, Gumboro, FCR, ...).
2. Colloquial Vietnamese spoken numbers, half-quantities, decimals, and poultry units.
3. Dynamic accent-folded Levenshtein fuzzy alignment against live DB entities passed via entities_json.
"""
from __future__ import annotations

import json
from pathlib import Path
import re
import unicodedata
from typing import Any

_UNITS: dict[str, int] = {
    "một": 1,
    "hai": 2,
    "ba": 3,
    "bốn": 4,
    "tư": 4,
    "năm": 5,
    "lăm": 5,
    "sáu": 6,
    "bảy": 7,
    "tám": 8,
    "chín": 9,
    "mười": 10,
}

_SPOKEN_DIGITS: dict[str, str] = {
    "không": "0",
    "linh": "0",
    "lẻ": "0",
    "một": "1",
    "mốt": "1",
    "hai": "2",
    "ba": "3",
    "bốn": "4",
    "tư": "4",
    "năm": "5",
    "lăm": "5",
    "sáu": "6",
    "bảy": "7",
    "tám": "8",
    "chín": "9",
}

_NUM_WORDS = "một|hai|ba|bốn|tư|năm|lăm|sáu|bảy|tám|chín|mười"
_DIGIT_WORD_SEQ = r"(?:không|linh|lẻ|một|mốt|hai|ba|bốn|tư|năm|lăm|sáu|bảy|tám|chín)"

_FLAGS = re.IGNORECASE | re.UNICODE
_B = r"(?<![^\W\d_])"
_E = r"(?![^\W\d_])"

_STOP_ENTITY_KEYS = frozenset({
    "cam", "thuoc", "nha", "chuong", "kho", "khu", "ga", "bao", "con", "kg", "vac", "xin",
})

_PROTECTED_PHRASES = frozenset({
    "cho an", "can mau", "hao hut", "nhap kho", "xuat ban", "hoa don", "cong no",
    "nha cung cap", "thuc an", "nhat ky", "bao cao", "viec hom nay",
})

_GRAMMAR_BOUNDARY_WORDS = frozenset({
    "cho", "an", "va", "cua", "tu", "den", "la", "duoc", "thanh", "het", "chet",
    "bao", "kg", "g", "con", "lo", "lieu", "sang", "o", "tai", "voi",
})

_ADJACENT_UNIT_TRIGGERS = frozenset({
    "bao", "kg", "ky", "ki", "can", "con", "lo", "lieu", "chuc", "tram", "nghin",
    "ngan", "trieu", "lang", "ruoi", "phay", "cham", "m2", "ngay", "tuan", "tuoi",
    "kilo", "gam", "gram",
})

_PRECEDING_UNIT_TRIGGERS = frozenset({
    "phay", "cham", "can", "ky", "ki", "con", "chet", "an", "do", "ghi", "them",
    "duoc", "nang", "tam", "khoang", "hon", "xuat", "ban", "nhap", "sua", "thanh",
})


def remove_vietnamese_diacritics(text: str) -> str:
    if not text:
        return ""
    nfd = unicodedata.normalize("NFD", text)
    plain = "".join(ch for ch in nfd if unicodedata.category(ch) != "Mn")
    return plain.replace("đ", "d").replace("Đ", "D").lower()


def _entity_key(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", remove_vietnamese_diacritics(text)).strip()


def _levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ch_a in enumerate(a, start=1):
        cur = [i]
        for j, ch_b in enumerate(b, start=1):
            cost = 0 if ch_a == ch_b else 1
            cur.append(min(cur[-1] + 1, prev[j] + 1, prev[j - 1] + cost))
        prev = cur
    return prev[-1]


def _similarity(a: str, b: str) -> float:
    max_len = max(len(a), len(b))
    if max_len == 0:
        return 0.0
    return 1.0 - (_levenshtein(a, b) / max_len)


def _extract_digit_signature(plain_text: str) -> tuple[str, ...]:
    return tuple(tok.lstrip("0") or "0" for tok in re.findall(r"\d+", plain_text))


def _record_correction(corrections: list[dict[str, str]], src: str, dst: str) -> None:
    s = (src or "").strip()
    d = (dst or "").strip()
    if not s or not d or s == d:
        return
    entry = {"from": s, "to": d}
    if entry not in corrections:
        corrections.append(entry)


def _sub_tracked(
    pattern: re.Pattern[str],
    text: str,
    repl_fn,
    corrections: list[dict[str, str]],
) -> str:
    def _wrapper(match: re.Match[str]) -> str:
        orig = match.group(0)
        rep = repl_fn(match) if callable(repl_fn) else match.expand(repl_fn)
        _record_correction(corrections, orig, rep)
        return rep

    return pattern.sub(_wrapper, text)


def _spoken_digits_to_str(raw_seq: str) -> str:
    digits = []
    for tok in re.split(r"\s+", raw_seq.strip().lower()):
        if tok.isdigit():
            digits.append(tok)
        elif tok in _SPOKEN_DIGITS:
            digits.append(_SPOKEN_DIGITS[tok])
    return "".join(digits)


# Phonetic patterns ordered from most specific to general
_HIGRO_SPOKEN_DIGITS = re.compile(
    _B + r"(?:hai|hi|hy)\s*(?:gờ\s*|gơ\s*)?(?:rô|grô|gro)\s+((?:"
    + _DIGIT_WORD_SEQ
    + r"(?:\s+"
    + _DIGIT_WORD_SEQ
    + r"){1,2}))"
    + _E,
    _FLAGS,
)
_HIGRO_NUMERIC = re.compile(
    _B + r"(?:(?:hai|hi|hy)\s*(?:gờ\s*|gơ\s*)?(?:rô|grô|gro)|higro)\s*(\d{2,4})" + _E,
    _FLAGS,
)
_HIGRO_01_02 = re.compile(
    _B + r"(?:(?:hai|hi|hy)\s*(?:gờ\s*|gơ\s*)?(?:rô|grô|gro)|higro)\s*(0?[12]|một|hai)" + _E,
    _FLAGS,
)
_HIGRO_BASE = re.compile(
    _B + r"(?:hai|hi|hy)\s*(?:gờ\s*|gơ\s*)?(?:rô|grô|gro)" + _E,
    _FLAGS,
)

_SHARED_LEXICON_CANDIDATES = (
    Path(__file__).resolve().parents[1] / "resources" / "phonetic_lexicon.json",
)


def _load_shared_phonetic_rules() -> list[tuple[re.Pattern[str], str]]:
    lexicon_path = next((p for p in _SHARED_LEXICON_CANDIDATES if p.is_file()), None)
    if lexicon_path is None:
        return []
    with lexicon_path.open("r", encoding="utf-8") as fh:
        payload = json.load(fh)
    compiled: list[tuple[re.Pattern[str], str]] = []
    for entry in payload.get("rules", []):
        raw_pat = entry.get("pattern", "")
        repl = entry.get("replacement", "")
        boundary = str(entry.get("boundary", "LETTER")).upper()
        if not raw_pat:
            continue
        if boundary == "ALNUM":
            wrapped = r"(?<!\w)" + raw_pat + r"(?!\w)"
        else:
            wrapped = _B + raw_pat + _E
        py_repl = re.sub(r"\{(\d+)\}", r"\\\1", repl)
        compiled.append((re.compile(wrapped, _FLAGS), py_repl))
    return compiled


_STATIC_PHONETIC_RULES: list[tuple[re.Pattern[str], str]] = _load_shared_phonetic_rules()

_BARN_PHONETIC = re.compile(
    _B
    + r"(nhà|nha|chuồng|chuong|khu)\s+(?:"
    + r"(a|bê|be|b|xê|xe|cê|ce|c|đê|de|dê|d)\s*[-_]?\s*(\d{1,2}|"
    + _NUM_WORDS
    + r")"
    + r"|([a-z])\s*[-_]?\s*(\d{1,2})"
    + r")"
    + _E,
    _FLAGS,
)

_HALF_HUNDRED = re.compile(
    _B + r"(?:(\d+|" + _NUM_WORDS + r")\s+)?trăm\s+rưỡi" + _E,
    _FLAGS,
)

_CHUC = re.compile(
    _B + r"(?:(\d+|một|hai|ba|bốn|tư|năm|sáu|bảy|tám|chín)\s+)?chục" + _E,
    _FLAGS,
)

_MILLION_HALF = re.compile(
    _B + r"(?:(\d+(?:[.,]\d+)?|" + _NUM_WORDS + r")\s+)?triệu\s+rưỡi" + _E,
    _FLAGS,
)
_MILLION_PLAIN = re.compile(
    _B + r"(\d+(?:[.,]\d+)?|" + _NUM_WORDS + r")\s*(?:triệu|trieu)" + _E,
    _FLAGS,
)
_INVOICE_SPLIT = re.compile(
    _B + r"n\s*h\s*[-_]?\s*(\d(?:\s\d)+)" + _E,
    _FLAGS,
)

_HALF_BAG = re.compile(_B + r"nửa\s+bao" + _E, _FLAGS)
_HALF_WEIGHT = re.compile(_B + r"nửa\s+(?:kg|ký|kí|cân)" + _E, _FLAGS)
_BAG_HALF = re.compile(r"(?<![\w.,])(\d+(?:[.,]\d+)?)\s*bao\s+rưỡi" + _E, _FLAGS)
_WEIGHT_HALF = re.compile(r"(?<![\w.,])(\d+(?:[.,]\d+)?)\s*(?:kg|ký|kí|cân)\s+rưỡi" + _E, _FLAGS)
_WEIGHT_MINOR = re.compile(
    r"(?<![\w.,])(\d+)\s*(?:ký|kí|cân)\s+(\d)" + _E + r"(?!\s*(?:con|bao|kg|ký|kí|cân|lô|gam|gram|lạng|triệu|nghìn|ngàn|k))",
    _FLAGS,
)
_DECIMAL_WORD = re.compile(r"(?<![\w.,])(\d+)\s*(?:phẩy|chấm|phảy)\s*(\d+)" + _E, _FLAGS)
_LANG_UNIT = re.compile(r"(?<![\w.,])(\d+(?:[.,]\d+)?)\s*lạng" + _E, _FLAGS)
_KG_UNIT = re.compile(
    r"(?<![\w.,])(\d+(?:[.,]\d+)?)\s*(?:kg|kilogam|kilôgam|kilo|ki\s+lô|kí\s+lô|ký|kí|cân)" + _E,
    _FLAGS,
)
_LO_UNIT = re.compile(
    r"(?<![\w.,])(\d+(?:[.,]\d+)?)\s*lô" + _E + r"(?!\s*(?:hàng|nhập|cám|thuốc|vắc|mới|cũ|gà|đàn|giống|xuất|bán|sản))",
    _FLAGS,
)
_GRAM_UNIT = re.compile(r"(?<![\w.,])(\d+(?:[.,]\d+)?)\s*(?:gam|gram)" + _E, _FLAGS)
_PUNCT_SPLIT = re.compile(r"^([^\w\d]*)(.*?)([^\w\d]*)$", re.UNICODE)


def _format_num(val: float) -> str:
    rounded = round(val, 4)
    if float(rounded).is_integer():
        return str(int(rounded))
    return f"{rounded:g}"


def _letter_map(raw_letter: str) -> str:
    plain = remove_vietnamese_diacritics(raw_letter).strip().lower()
    if plain in ("be", "b"):
        return "B"
    if plain in ("xe", "ce", "xay", "c"):
        return "C"
    if plain in ("de", "d"):
        return "D"
    if len(plain) == 1 and "a" <= plain <= "z":
        return plain.upper()
    return "A"


def _token_key(tokens: list[str], idx: int) -> str | None:
    if idx < 0 or idx >= len(tokens):
        return None
    m = _PUNCT_SPLIT.match(tokens[idx])
    core = m.group(2) if m else tokens[idx]
    return core.lower()


def _parse_tens(tokens: list[str], idx: int) -> tuple[int, int] | None:
    t = _token_key(tokens, idx)
    if not t:
        return None
    nxt = _token_key(tokens, idx + 1)
    if t == "mười":
        if nxt == "lăm":
            return 15, 2
        if nxt in _UNITS and nxt not in ("mười", "lăm", "tư"):
            return 10 + _UNITS[nxt], 2
        return 10, 1
    if t not in ("một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"):
        return None
    u = _UNITS[t]
    if nxt == "mươi":
        v = u * 10
        third = _token_key(tokens, idx + 2)
        if third == "mốt":
            return v + 1, 3
        if third in ("tư", "bốn"):
            return v + 4, 3
        if third in ("lăm", "năm"):
            return v + 5, 3
        if third in _UNITS and third not in ("mười",):
            return v + _UNITS[third], 3
        return v, 2
    if u >= 2 and nxt in ("lăm", "mốt", "tư"):
        tail = 5 if nxt == "lăm" else (1 if nxt == "mốt" else 4)
        return u * 10 + tail, 2
    return u, 1


def _parse_word_number(tokens: list[str], idx: int) -> tuple[int, int] | None:
    t = _token_key(tokens, idx)
    if not t:
        return None
    nxt = _token_key(tokens, idx + 1)
    if t == "trăm" and nxt in ("nghìn", "ngàn", "triệu"):
        return 100, 1
    if t in ("một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín") and nxt == "trăm":
        total = _UNITS[t] * 100
        pos = idx + 2
        mid = _token_key(tokens, pos)
        after = _token_key(tokens, pos + 1)
        if mid in ("linh", "lẻ") and after in _UNITS:
            total += _UNITS[after]
            pos += 2
        else:
            tens = _parse_tens(tokens, pos)
            if tens:
                total += tens[0]
                pos += tens[1]
        return total, pos - idx
    return _parse_tens(tokens, idx)


def _word_numbers_to_digits(text: str) -> str:
    tokens = text.split(" ")
    out: list[str] = []
    i = 0
    while i < len(tokens):
        parsed = _parse_word_number(tokens, i)
        if not parsed:
            out.append(tokens[i])
            i += 1
            continue

        val, span = parsed
        # For single-word numbers ("một", "năm", ...), only convert when numerically meaningful
        if span == 1:
            next_plain = remove_vietnamese_diacritics(_token_key(tokens, i + 1) or "")
            prev_plain = remove_vietnamese_diacritics(_token_key(tokens, i - 1) or "")
            if next_plain not in _ADJACENT_UNIT_TRIGGERS and prev_plain not in _PRECEDING_UNIT_TRIGGERS:
                out.append(tokens[i])
                i += 1
                continue

        lead = _PUNCT_SPLIT.match(tokens[i]).group(1) if _PUNCT_SPLIT.match(tokens[i]) else ""
        last_tok = tokens[i + span - 1]
        trail = _PUNCT_SPLIT.match(last_tok).group(3) if _PUNCT_SPLIT.match(last_tok) else ""
        out.append(f"{lead}{val}{trail}")
        i += span
    return " ".join(out)


MAX_DYNAMIC_ENTITIES = 300


def _match_dynamic_entities(
    text: str,
    entities: dict[str, Any] | None,
    corrections: list[dict[str, str]],
) -> str:
    if not text or not isinstance(entities, dict) or not entities:
        return text

    candidates: list[tuple[str, str, list[str], tuple[str, ...]]] = []
    seen_canon: set[str] = set()
    for val_list in entities.values():
        if not isinstance(val_list, (list, tuple)):
            continue
        for item in val_list:
            if len(candidates) >= MAX_DYNAMIC_ENTITIES:
                break
            canon = str(item or "").strip()
            if not canon or len(canon) > 120 or canon in seen_canon:
                continue
            plain = _entity_key(canon)
            if not plain or plain in _STOP_ENTITY_KEYS:
                continue
            c_words = plain.split()
            if len(c_words) == 1 and len(plain) < 4:
                continue
            seen_canon.add(canon)
            candidates.append((canon, plain, c_words, _extract_digit_signature(plain)))
        if len(candidates) >= MAX_DYNAMIC_ENTITIES:
            break

    if not candidates:
        return text

    candidates.sort(key=lambda item: (-len(item[2]), -len(item[1])))

    tokens = text.split()
    out: list[str] = []
    i = 0
    while i < len(tokens):
        best_choice: tuple[float, int, int, str, str] | None = None
        for canon, cand_plain, c_words, cand_digits in candidates:
            base_len = len(c_words)
            span_lengths = [base_len]
            if base_len >= 2:
                if base_len - 1 >= 1:
                    span_lengths.append(base_len - 1)
                span_lengths.append(base_len + 1)

            for slen in span_lengths:
                if i + slen > len(tokens):
                    continue
                first_tok = tokens[i]
                last_tok = tokens[i + slen - 1]
                first_plain = _entity_key(first_tok)
                last_plain = _entity_key(last_tok)

                if slen != base_len and (first_plain in _GRAMMAR_BOUNDARY_WORDS or last_plain in _GRAMMAR_BOUNDARY_WORDS):
                    continue

                raw_span = " ".join(tokens[i : i + slen])
                lead_m = _PUNCT_SPLIT.match(first_tok)
                trail_m = _PUNCT_SPLIT.match(last_tok)
                lead = lead_m.group(1) if lead_m else ""
                trail = trail_m.group(3) if trail_m else ""

                inner_tokens = tokens[i : i + slen]
                inner_clean = raw_span
                if lead and inner_clean.startswith(lead):
                    inner_clean = inner_clean[len(lead):]
                if trail and inner_clean.endswith(trail):
                    inner_clean = inner_clean[: -len(trail)]
                inner_clean = inner_clean.strip()

                win_plain = _entity_key(inner_clean)
                if not win_plain or win_plain in _STOP_ENTITY_KEYS or win_plain in _PROTECTED_PHRASES:
                    continue

                win_digits = _extract_digit_signature(win_plain)
                if (win_digits or cand_digits) and win_digits != cand_digits:
                    continue

                if win_plain == cand_plain:
                    sim = 1.0
                else:
                    if len(win_plain) < 5 or len(cand_plain) < 5:
                        continue
                    sim_spaced = _similarity(win_plain, cand_plain)
                    sim_compact = _similarity(win_plain.replace(" ", ""), cand_plain.replace(" ", ""))
                    sim = max(sim_spaced, sim_compact)

                if sim >= 0.78:
                    cand_tuple = (sim, len(cand_plain), slen, canon, f"{lead}{canon}{trail}")
                    if best_choice is None or (cand_tuple[0], cand_tuple[1]) > (best_choice[0], best_choice[1]):
                        best_choice = cand_tuple
                    if sim == 1.0 and slen == base_len:
                        break
            if best_choice and best_choice[0] == 1.0:
                break

        if best_choice is not None:
            _, _, chosen_len, canon, replacement_tok = best_choice
            orig_span = " ".join(tokens[i : i + chosen_len]).strip(".,;!?")
            if orig_span != canon:
                _record_correction(corrections, orig_span, canon)
            out.append(replacement_tok)
            i += chosen_len
        else:
            out.append(tokens[i])
            i += 1

    return " ".join(out)


def postprocess_vietnamese_phonetic(
    text: str,
    entities: dict[str, Any] | None = None,
) -> tuple[str, list[dict[str, str]]]:
    """Normalize phonetic poultry terms, colloquial Vietnamese numbers, and DB entities."""
    if not text:
        return text or "", []

    corrections: list[dict[str, str]] = []
    out = re.sub(r"\s+", " ", unicodedata.normalize("NFC", text)).strip()

    # 1. Higro spoken multi-digit product codes & variants
    out = _sub_tracked(
        _HIGRO_SPOKEN_DIGITS,
        out,
        lambda m: f"Higro {_spoken_digits_to_str(m.group(1))}",
        corrections,
    )
    out = _sub_tracked(_HIGRO_NUMERIC, out, lambda m: f"Higro {m.group(1)}", corrections)
    out = _sub_tracked(
        _HIGRO_01_02,
        out,
        lambda m: "Higro " + (
            "01" if m.group(1).lower() in ("1", "01", "một")
            else ("02" if m.group(1).lower() in ("2", "02", "hai") else m.group(1))
        ),
        corrections,
    )
    out = _sub_tracked(_HIGRO_BASE, out, "Higro", corrections)

    # 2. Static agricultural phonetics & spelling homophones
    for pattern, repl in _STATIC_PHONETIC_RULES:
        out = _sub_tracked(pattern, out, repl, corrections)

    # 3. Barn & Area codes ("nhà a một" -> "Nhà A1", "chuồng bê hai" -> "Chuồng B2", "nhà e2" -> "Nhà E2")
    def _barn_repl(m: re.Match[str]) -> str:
        raw_prefix = remove_vietnamese_diacritics(m.group(1)).lower()
        prefix = "Nhà" if raw_prefix == "nha" else ("Chuồng" if raw_prefix == "chuong" else "Khu")
        raw_letter = m.group(2) if m.group(2) is not None else m.group(4)
        raw_num = (m.group(3) if m.group(3) is not None else m.group(5)).lower()
        letter = _letter_map(raw_letter)
        num = str(_UNITS[raw_num]) if raw_num in _UNITS else raw_num
        return f"{prefix} {letter}{num}"

    out = _sub_tracked(_BARN_PHONETIC, out, _barn_repl, corrections)

    # 4. Colloquial hundreds & tens ("một trăm rưỡi" -> 150, "chết chục con" -> "chết 10 con")
    def _half_hundred_repl(m: re.Match[str]) -> str:
        base_tok = (m.group(1) or "1").lower()
        base = _UNITS[base_tok] if base_tok in _UNITS else int(base_tok)
        return str(base * 100 + 50)

    out = _sub_tracked(_HALF_HUNDRED, out, _half_hundred_repl, corrections)

    def _chuc_repl(m: re.Match[str]) -> str:
        base_tok = (m.group(1) or "1").lower()
        base = _UNITS[base_tok] if base_tok in _UNITS else int(base_tok)
        return str(base * 10)

    out = _sub_tracked(_CHUC, out, _chuc_repl, corrections)

    # 5. Half million & million amounts ("triệu rưỡi" -> 1500000, "5 triệu" -> 5000000) & split invoice codes
    out = _sub_tracked(
        _INVOICE_SPLIT,
        out,
        lambda m: f"NH{int(re.sub(r'\s+', '', m.group(1))):06d}",
        corrections,
    )

    def _million_half_repl(m: re.Match[str]) -> str:
        raw = m.group(1)
        if not raw:
            base = 1.0
        elif raw.lower() in _UNITS:
            base = float(_UNITS[raw.lower()])
        else:
            base = float(raw.replace(",", "."))
        return str(int(round(base * 1_000_000 + 500_000)))

    out = _sub_tracked(_MILLION_HALF, out, _million_half_repl, corrections)

    def _million_plain_repl(m: re.Match[str]) -> str:
        raw = m.group(1)
        base = float(_UNITS[raw.lower()]) if raw.lower() in _UNITS else float(raw.replace(",", "."))
        return str(int(round(base * 1_000_000)))

    out = _sub_tracked(_MILLION_PLAIN, out, _million_plain_repl, corrections)

    # 6. Spoken numbers -> digits ("bốn bao rưỡi" -> "4 bao rưỡi", "một cân hai" -> "1 cân 2")
    out = _word_numbers_to_digits(out)

    # Preserve fractional decimals & quantities
    out = _sub_tracked(_DECIMAL_WORD, out, lambda m: f"{m.group(1)}.{m.group(2)}", corrections)
    out = _sub_tracked(_HALF_BAG, out, "0.5 bao", corrections)
    out = _sub_tracked(_HALF_WEIGHT, out, "0.5 kg", corrections)
    out = _sub_tracked(_BAG_HALF, out, lambda m: f"{_format_num(float(m.group(1).replace(',', '.')) + 0.5)} bao", corrections)
    out = _sub_tracked(_WEIGHT_HALF, out, lambda m: f"{_format_num(float(m.group(1).replace(',', '.')) + 0.5)} kg", corrections)
    out = _sub_tracked(_WEIGHT_MINOR, out, lambda m: f"{m.group(1)}.{m.group(2)} kg", corrections)
    out = _sub_tracked(_LANG_UNIT, out, lambda m: f"{_format_num(float(m.group(1).replace(',', '.')) / 10.0)} kg", corrections)
    out = _sub_tracked(_KG_UNIT, out, lambda m: f"{m.group(1).replace(',', '.')} kg", corrections)
    out = _sub_tracked(_LO_UNIT, out, lambda m: f"{m.group(1).replace(',', '.')} kg", corrections)
    out = _sub_tracked(_GRAM_UNIT, out, lambda m: f"{m.group(1).replace(',', '.')} g", corrections)

    # 7. Dynamic fuzzy entity alignment from entities_json (if provided)
    out = _match_dynamic_entities(out, entities, corrections)

    return re.sub(r"\s+", " ", out).strip(), corrections
