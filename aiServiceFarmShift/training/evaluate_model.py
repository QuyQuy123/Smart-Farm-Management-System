"""Post-Training Release Gate Evaluator for Fine-Tuned Intent/Slot & Whisper Models.

Computes:
- Tool/Intent Accuracy + Parameter Accuracy (`0.7 * intent + 0.3 * params >= 0.90`)
- Adversarial RBAC / Security Block Rate (`== 1.00`)
- Word Error Rate (WER) & Character Error Rate (CER) for Whisper STT predictions.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
from typing import Any

AI_SERVICE_ROOT = Path(__file__).resolve().parents[1]
if str(AI_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(AI_SERVICE_ROOT))

from eval.run_eval import load_golden_dataset, score_intent_and_params  # noqa: E402


def levenshtein_seq(seq_a: list[str] | str, seq_b: list[str] | str) -> int:
    if seq_a == seq_b:
        return 0
    if not seq_a:
        return len(seq_b)
    if not seq_b:
        return len(seq_a)
    prev = list(range(len(seq_b) + 1))
    for i, item_a in enumerate(seq_a, start=1):
        cur = [i]
        for j, item_b in enumerate(seq_b, start=1):
            cost = 0 if item_a == item_b else 1
            cur.append(min(cur[-1] + 1, prev[j] + 1, prev[j - 1] + cost))
        prev = cur
    return prev[-1]


def compute_wer_cer(pairs: list[tuple[str, str]]) -> dict[str, float]:
    total_words = 0
    word_edits = 0
    total_chars = 0
    char_edits = 0
    for ref, hyp in pairs:
        ref_clean = (ref or "").strip()
        hyp_clean = (hyp or "").strip()
        ref_words = ref_clean.split()
        hyp_words = hyp_clean.split()
        total_words += max(1, len(ref_words))
        word_edits += levenshtein_seq(ref_words, hyp_words)
        total_chars += max(1, len(ref_clean))
        char_edits += levenshtein_seq(ref_clean, hyp_clean)
    return {
        "wer": round(word_edits / total_words, 4) if total_words else 0.0,
        "cer": round(char_edits / total_chars, 4) if total_chars else 0.0,
    }


def evaluate_predictions_file(
    *,
    golden_path: Path,
    predictions_path: Path,
) -> dict[str, Any]:
    records = load_golden_dataset(golden_path)
    preds = [
        json.loads(line)
        for line in predictions_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    intent_report = score_intent_and_params(preds, records)

    pred_by_id = {p["id"]: p for p in preds if "id" in p}
    stt_pairs = [
        (r["expected_normalized"], pred_by_id[r["id"]].get("transcript", ""))
        for r in records
        if r.get("expected_normalized") and r["id"] in pred_by_id and "transcript" in pred_by_id[r["id"]]
    ]
    stt_metrics = compute_wer_cer(stt_pairs) if stt_pairs else None
    passed_gate = (
        intent_report["composite_score"] >= 0.90
        and intent_report["safety_rbac_block_rate"] >= 1.0
    )
    return {
        "passed_release_gate": passed_gate,
        "intent_and_slots": intent_report,
        "whisper_stt_metrics": stt_metrics,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate fine-tuned FarmShift model predictions")
    parser.add_argument("--golden", type=Path, default=AI_SERVICE_ROOT / "eval" / "eval_golden_dataset.jsonl")
    parser.add_argument("--predictions", type=Path, required=True)
    parser.add_argument("--strict", action="store_true")
    args = parser.parse_args()

    report = evaluate_predictions_file(golden_path=args.golden, predictions_path=args.predictions)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if args.strict and not report["passed_release_gate"]:
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
