import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from eval.run_eval import (  # noqa: E402
    DEFAULT_DATASET_PATH,
    load_golden_dataset,
    run_evaluation,
    score_intent_and_params,
)


class EvalPipelineTests(unittest.TestCase):
    def test_golden_dataset_has_valid_records_and_100pct_stt_normalization(self):
        records = load_golden_dataset(DEFAULT_DATASET_PATH)
        self.assertGreaterEqual(len(records), 40)
        categories = {r["category"] for r in records}
        self.assertTrue(
            {"INTENT_SLOTS", "STT_PHONETIC", "RBAC_SECURITY", "SAFETY_GUARD", "IOT_TELEMETRY", "VET_RAG"}.issubset(
                categories
            )
        )

        report = run_evaluation(DEFAULT_DATASET_PATH)
        stt = report["stt_phonetic_eval"]
        self.assertGreaterEqual(stt["total"], 15)
        self.assertEqual(1.0, stt["accuracy"], msg=f"STT failures: {stt['failures']}")
        rag = report["vet_rag_eval"]
        self.assertTrue(rag["evaluated"])
        self.assertGreaterEqual(rag["recall_at_3"], 0.80, msg=f"RAG failures: {rag['failures']}")

    def test_score_intent_and_params_computes_composite_and_safety_metrics(self):
        records = load_golden_dataset(DEFAULT_DATASET_PATH)[:5]
        perfect_preds = [
            {
                "id": r["id"],
                "actionType": r["expected_intent"],
                "params": r.get("expected_params", {}),
            }
            for r in records
        ]
        score = score_intent_and_params(perfect_preds, records)
        self.assertEqual(1.0, score["intent_accuracy"])
        self.assertEqual(1.0, score["param_accuracy"])
        self.assertEqual(1.0, score["composite_score"])

    def test_score_intent_and_params_resolves_backend_payload_slot_aliases(self):
        records = [
            {
                "id": "ALIAS-1",
                "expected_intent": "LOG_FEED",
                "expected_params": {"targetBarnName": "Nhà A1", "feedName": "Higro 01", "feedKg": 50.0},
            },
            {
                "id": "ALIAS-2",
                "expected_intent": "COMPOUND_LOG_FEED",
                "expected_params": {"barnCount": 2},
            },
        ]
        preds = [
            {
                "id": "ALIAS-1",
                "actionType": "LOG_FEED",
                "params": {"barnName": "Nhà A1", "feedName": "Cám Higro 01", "totalKg": 50.0},
            },
            {
                "id": "ALIAS-2",
                "actionType": "COMPOUND_LOG_FEED",
                "params": {"items": [{"barnId": 1}, {"barnId": 2}]},
            },
        ]
        score = score_intent_and_params(preds, records)
        self.assertEqual(1.0, score["intent_accuracy"])
        self.assertEqual(1.0, score["param_accuracy"])
        self.assertEqual(1.0, score["composite_score"])


if __name__ == "__main__":
    unittest.main()
