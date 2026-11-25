"""Dataset Preparation Pipeline for FarmShift AI (Stage 4: Data Flywheel + Golden -> SFT/LoRA & Whisper STT).

Generates reproducible, leakage-free stratified splits:
1. Intent / Tool-Calling SFT JSONL (`sft_intent_{train,val,test}.jsonl`) in ChatML + tool_calls format.
2. Whisper STT Domain Adaptation Manifest (`whisper_stt_{train,val}.jsonl`) enriched with shared phonetic rules.
3. Reproducibility manifest (`dataset_manifest.json`) with SHA-256 hashes and class distributions.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import random
import re
import sys
import unicodedata
from typing import Any

AI_SERVICE_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = AI_SERVICE_ROOT.parent
if str(AI_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(AI_SERVICE_ROOT))

from app.services.voice_service import DOMAIN_PROMPT  # noqa: E402

DEFAULT_GOLDEN_PATH = AI_SERVICE_ROOT / "eval" / "eval_golden_dataset.jsonl"
DEFAULT_LEXICON_CANDIDATES = (
    AI_SERVICE_ROOT / "app" / "resources" / "phonetic_lexicon.json",
)
DEFAULT_OUT_DIR = Path(__file__).resolve().parent / "artifacts" / "datasets"

INTENT_TO_TOOL_NAME = {
    "LOG_FEED": "log_feed",
    "LOG_WEIGHT": "log_weight",
    "LOG_MORTALITY": "log_mortality",
    "LOG_EXPENSE": "log_expense",
    "PAY_PURCHASE_INVOICE": "pay_purchase_invoice",
    "CANCEL_PURCHASE_INVOICE": "cancel_purchase_invoice",
    "IMPORT_PURCHASE_STOCK": "import_purchase_stock",
    "UPDATE_BARN_INFO": "update_barn_info",
    "UPDATE_INVENTORY_ITEM": "update_inventory_item",
    "UPDATE_SUPPLIER_INFO": "update_supplier_info",
    "COMPLETE_DAILY_TASKS": "complete_daily_tasks",
    "NAVIGATE_AND_PREFILL": "navigate_screen",
    "VET_DIAGNOSIS": "vet_diagnosis",
    "QUERY_FARM_STATUS": "query_farm_status",
}


def _dedup_key(text: str, role: str) -> str:
    nfd = unicodedata.normalize("NFD", text or "")
    plain = "".join(c for c in nfd if unicodedata.category(c) != "Mn")
    plain = plain.replace("đ", "d").replace("Đ", "D").lower()
    compact = re.sub(r"\s+", " ", plain).strip()
    return f"{role.upper()}::{compact}"


def _load_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if not path.is_file():
        return rows
    with path.open("r", encoding="utf-8") as fh:
        for raw in fh:
            line = raw.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def _load_lexicon_rules() -> list[dict[str, Any]]:
    lex_path = next((p for p in DEFAULT_LEXICON_CANDIDATES if p.is_file()), None)
    if lex_path is None:
        return []
    data = json.loads(lex_path.read_text(encoding="utf-8"))
    return list(data.get("rules", []))


def _build_sft_record(
    *,
    source_id: str,
    role: str,
    user_text: str,
    intent: str,
    params: dict[str, Any],
    reply: str = "",
    source: str = "golden",
) -> dict[str, Any]:
    system_msg = (
        f"Bạn là Trợ lý AI trang trại FarmShift. Vai trò người dùng: {role}. "
        "Chỉ trích xuất tool/JSON đúng phạm vi RBAC; từ chối truy vấn vượt quyền hoặc y tế người."
    )
    tool_name = INTENT_TO_TOOL_NAME.get(intent)
    assistant_msg: dict[str, Any]
    if tool_name and intent not in {"RBAC_BLOCKED", "SECURITY_BLOCKED", "OUT_OF_SCOPE_HUMAN_MEDICAL", "CLARIFICATION_REQUIRED"}:
        assistant_msg = {
            "role": "assistant",
            "content": None,
            "tool_calls": [
                {
                    "id": f"call_{source_id}",
                    "type": "function",
                    "function": {
                        "name": tool_name,
                        "arguments": json.dumps(params or {}, ensure_ascii=False),
                    },
                }
            ],
        }
    else:
        assistant_msg = {
            "role": "assistant",
            "content": json.dumps(
                {"intent": intent, "params": params or {}, "reply": reply or ""},
                ensure_ascii=False,
            ),
        }

    clean_user = re.sub(r"^\s*<user_input>(.*)</user_input>\s*$", r"\1", user_text.strip(), flags=re.DOTALL)
    return {
        "id": source_id,
        "intent": intent,
        "role": role,
        "source": source,
        "messages": [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": f"<user_input>{clean_user}</user_input>"},
            assistant_msg,
        ],
    }


def _convert_flywheel_row(row: dict[str, Any], idx: int) -> dict[str, Any] | None:
    msgs = row.get("messages")
    meta = row.get("metadata") or {}
    if not isinstance(msgs, list) or len(msgs) < 3:
        return None
    user_text = str(msgs[1].get("content") or "").strip()
    if not user_text:
        return None
    role = str(meta.get("userRole") or "ROLE_FARM_OWNER")
    try:
        assistant_obj = json.loads(str(msgs[2].get("content") or "{}"))
    except json.JSONDecodeError:
        return None
    intent = str(assistant_obj.get("intent") or "GENERAL_QNA")
    if intent == "SECURITY_BLOCKED":
        return None
    rating = meta.get("feedbackRating")
    if isinstance(rating, (int, float)) and rating < 0 and not meta.get("hasCorrection"):
        return None
    params = assistant_obj.get("arguments") or {}
    reply = str(assistant_obj.get("reply") or "")
    return _build_sft_record(
        source_id=f"fw_{meta.get('interactionId', idx)}",
        role=role,
        user_text=user_text,
        intent=intent,
        params=params if isinstance(params, dict) else {},
        reply=reply,
        source="data_flywheel",
    )


def _stratified_split(
    records: list[dict[str, Any]],
    *,
    seed: int = 42,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    rng = random.Random(seed)
    by_label: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for rec in records:
        by_label[rec["intent"]].append(rec)

    train: list[dict[str, Any]] = []
    val: list[dict[str, Any]] = []
    test: list[dict[str, Any]] = []

    for label in sorted(by_label.keys()):
        bucket = list(by_label[label])
        rng.shuffle(bucket)
        n = len(bucket)
        if n == 1:
            train.extend(bucket)
        elif n == 2:
            train.append(bucket[0])
            test.append(bucket[1])
        else:
            n_test = max(1, round(n * test_ratio))
            n_val = max(1, round(n * val_ratio))
            while n - (n_test + n_val) < 1:
                if n_val > 1:
                    n_val -= 1
                elif n_test > 1:
                    n_test -= 1
                else:
                    n_val = 0
                    break
            test.extend(bucket[:n_test])
            val.extend(bucket[n_test : n_test + n_val])
            train.extend(bucket[n_test + n_val :])

    rng.shuffle(train)
    rng.shuffle(val)
    rng.shuffle(test)
    return train, val, test


def _build_whisper_manifest(
    golden_records: list[dict[str, Any]],
    lexicon_rules: list[dict[str, Any]],
    seed: int = 42,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    stt_items: list[dict[str, Any]] = []
    for rec in golden_records:
        if rec.get("expected_normalized"):
            stt_items.append({
                "id": f"stt_{rec['id']}",
                "audio_path": f"audio/pending/{rec['id']}.wav",
                "raw_transcript": rec["raw_input"],
                "normalized_transcript": rec["expected_normalized"],
                "language": "vi",
                "domain_prompt": DOMAIN_PROMPT[:650],
                "source": "golden_stt",
            })

    # Synthetic phonetic-anchor templates from app/resources/phonetic_lexicon.json
    templates = [
        "Kiểm tra {term} cho Nhà A1",
        "Chuẩn bị {term} tại Chuồng B2",
    ]
    for rule in lexicon_rules:
        term = str(rule.get("replacement") or "").strip()
        if not term or "{1}" in term:
            continue
        for t_idx, tmpl in enumerate(templates):
            sentence = tmpl.format(term=term)
            stt_items.append({
                "id": f"lex_{rule.get('id', 'rule')}_{t_idx}",
                "audio_path": f"audio/synthetic/{rule.get('id', 'rule')}_{t_idx}.wav",
                "raw_transcript": sentence.lower(),
                "normalized_transcript": sentence,
                "language": "vi",
                "domain_prompt": DOMAIN_PROMPT[:650],
                "category": rule.get("category", "DOMAIN"),
                "source": "phonetic_lexicon",
            })

    rng = random.Random(seed)
    rng.shuffle(stt_items)
    split_idx = max(1, int(len(stt_items) * 0.85))
    return stt_items[:split_idx], stt_items[split_idx:]


def _write_jsonl(path: Path, rows: list[dict[str, Any]]) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows)
    path.write_text(text, encoding="utf-8")
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def prepare_all_datasets(
    *,
    golden_path: Path = DEFAULT_GOLDEN_PATH,
    flywheel_path: Path | None = None,
    out_dir: Path = DEFAULT_OUT_DIR,
    seed: int = 42,
) -> dict[str, Any]:
    golden_rows = _load_jsonl(golden_path)
    flywheel_rows = _load_jsonl(flywheel_path) if flywheel_path else []
    lexicon_rules = _load_lexicon_rules()

    seen_keys: set[str] = set()
    sft_records: list[dict[str, Any]] = []

    for row in golden_rows:
        key = _dedup_key(row["raw_input"], row.get("role", "ROLE_FARM_OWNER"))
        if key in seen_keys:
            continue
        seen_keys.add(key)
        sft_records.append(
            _build_sft_record(
                source_id=row["id"],
                role=row.get("role", "ROLE_FARM_OWNER"),
                user_text=row["raw_input"],
                intent=row["expected_intent"],
                params=row.get("expected_params") or {},
                source="golden",
            )
        )

    for idx, fw_row in enumerate(flywheel_rows):
        converted = _convert_flywheel_row(fw_row, idx)
        if not converted:
            continue
        raw_user = converted["messages"][1]["content"].replace("<user_input>", "").replace("</user_input>", "")
        key = _dedup_key(raw_user, converted["role"])
        if key in seen_keys:
            continue
        seen_keys.add(key)
        sft_records.append(converted)

    train_sft, val_sft, test_sft = _stratified_split(sft_records, seed=seed)
    whisper_train, whisper_val = _build_whisper_manifest(golden_rows, lexicon_rules, seed=seed)

    out_dir.mkdir(parents=True, exist_ok=True)
    hashes = {
        "sft_intent_train.jsonl": _write_jsonl(out_dir / "sft_intent_train.jsonl", train_sft),
        "sft_intent_val.jsonl": _write_jsonl(out_dir / "sft_intent_val.jsonl", val_sft),
        "sft_intent_test.jsonl": _write_jsonl(out_dir / "sft_intent_test.jsonl", test_sft),
        "whisper_stt_train.jsonl": _write_jsonl(out_dir / "whisper_stt_train.jsonl", whisper_train),
        "whisper_stt_val.jsonl": _write_jsonl(out_dir / "whisper_stt_val.jsonl", whisper_val),
    }

    manifest = {
        "seed": seed,
        "sources": {
            "golden_count": len(golden_rows),
            "flywheel_count": len(flywheel_rows),
            "lexicon_rules_count": len(lexicon_rules),
        },
        "sft_counts": {
            "total": len(sft_records),
            "train": len(train_sft),
            "val": len(val_sft),
            "test": len(test_sft),
            "intent_distribution": dict(Counter(r["intent"] for r in sft_records)),
        },
        "whisper_counts": {
            "total": len(whisper_train) + len(whisper_val),
            "train": len(whisper_train),
            "val": len(whisper_val),
        },
        "sha256": hashes,
    }
    (out_dir / "dataset_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description="Prepare FarmShift SFT/LoRA & Whisper STT datasets")
    parser.add_argument("--golden", type=Path, default=DEFAULT_GOLDEN_PATH)
    parser.add_argument("--flywheel-jsonl", type=Path, default=None)
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    manifest = prepare_all_datasets(
        golden_path=args.golden,
        flywheel_path=args.flywheel_jsonl,
        out_dir=args.out_dir,
        seed=args.seed,
    )
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
