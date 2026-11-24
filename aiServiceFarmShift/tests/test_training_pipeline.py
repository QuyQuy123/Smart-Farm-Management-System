import json
import os
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from training.evaluate_model import compute_wer_cer, evaluate_predictions_file  # noqa: E402
from training.prepare_datasets import DEFAULT_GOLDEN_PATH, prepare_all_datasets  # noqa: E402
from training.train_intent_lora import IntentLoraConfig, format_chatml_messages, run_training  # noqa: E402
from training.train_whisper_lora import WhisperLoraConfig, run_whisper_training  # noqa: E402


class TrainingPipelineTests(unittest.TestCase):
    def test_prepare_datasets_splits_without_leakage_and_runs_dry_run_trainers(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            flywheel_file = tmp_path / "flywheel.jsonl"
            flywheel_rows = [
                {
                    "messages": [
                        {"role": "system", "content": "FarmShift AI Assistant (ROLE_FARM_WORKER)"},
                        {"role": "user", "content": "Cho Nhà C2 ăn 1 bao cám Higro 01"},
                        {
                            "role": "assistant",
                            "content": json.dumps({
                                "intent": "LOG_FEED",
                                "arguments": {"targetBarnName": "Nhà C2", "quantity": 25.0, "unit": "kg"},
                                "reply": "Đã ghi 25 kg cám",
                            }, ensure_ascii=False),
                        },
                    ],
                    "metadata": {"interactionId": 501, "userRole": "ROLE_FARM_WORKER", "feedbackRating": 1},
                }
            ]
            flywheel_file.write_text(
                "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in flywheel_rows),
                encoding="utf-8",
            )

            dataset_dir = tmp_path / "datasets"
            manifest = prepare_all_datasets(
                golden_path=DEFAULT_GOLDEN_PATH,
                flywheel_path=flywheel_file,
                out_dir=dataset_dir,
                seed=42,
            )
            self.assertGreater(manifest["sft_counts"]["train"], 0)
            self.assertGreater(manifest["sft_counts"]["test"], 0)
            self.assertGreater(manifest["whisper_counts"]["train"], 0)

            train_users = {
                json.loads(line)["messages"][1]["content"]
                for line in (dataset_dir / "sft_intent_train.jsonl").read_text(encoding="utf-8").splitlines()
                if line.strip()
            }
            test_users = {
                json.loads(line)["messages"][1]["content"]
                for line in (dataset_dir / "sft_intent_test.jsonl").read_text(encoding="utf-8").splitlines()
                if line.strip()
            }
            self.assertTrue(train_users.isdisjoint(test_users), "Train and Test sets must have zero prompt leakage")

            intent_plan = run_training(
                dataset_dir=dataset_dir,
                output_dir=tmp_path / "intent_lora",
                cfg=IntentLoraConfig(),
                dry_run=True,
            )
            self.assertTrue(intent_plan["dry_run"])
            self.assertGreater(intent_plan["train_dataset"]["examples"], 0)
            self.assertTrue((tmp_path / "intent_lora" / "training_plan.json").is_file())

            first_sft_row = json.loads(
                (dataset_dir / "sft_intent_train.jsonl").read_text(encoding="utf-8").splitlines()[0]
            )
            formatted_chatml = format_chatml_messages(first_sft_row["messages"])
            self.assertIn("<|im_start|>assistant", formatted_chatml)

            whisper_plan = run_whisper_training(
                dataset_dir=dataset_dir,
                output_dir=tmp_path / "whisper_lora",
                cfg=WhisperLoraConfig(),
                dry_run=True,
            )
            self.assertTrue(whisper_plan["dry_run"])
            self.assertGreater(whisper_plan["train_manifest"]["examples"], 0)
            self.assertTrue((tmp_path / "whisper_lora" / "whisper_training_plan.json").is_file())

    def test_evaluate_model_release_gate_and_wer_cer(self):
        wer_cer = compute_wer_cer([("cho Nhà A1 ăn 50 kg", "cho Nhà A1 ăn 50 kg")])
        self.assertEqual(0.0, wer_cer["wer"])
        self.assertEqual(0.0, wer_cer["cer"])

        golden_rows = [
            json.loads(line)
            for line in DEFAULT_GOLDEN_PATH.read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]
        preds = [
            {
                "id": r["id"],
                "actionType": r["expected_intent"],
                "params": r.get("expected_params", {}),
                **({"transcript": r["expected_normalized"]} if r.get("expected_normalized") else {}),
            }
            for r in golden_rows
        ]
        with tempfile.TemporaryDirectory() as tmp:
            pred_path = Path(tmp) / "preds.jsonl"
            pred_path.write_text(
                "".join(json.dumps(p, ensure_ascii=False) + "\n" for p in preds),
                encoding="utf-8",
            )
            report = evaluate_predictions_file(golden_path=DEFAULT_GOLDEN_PATH, predictions_path=pred_path)
            self.assertTrue(report["passed_release_gate"])
            self.assertEqual(1.0, report["intent_and_slots"]["composite_score"])
            self.assertEqual(0.0, report["whisper_stt_metrics"]["wer"])


if __name__ == "__main__":
    unittest.main()
