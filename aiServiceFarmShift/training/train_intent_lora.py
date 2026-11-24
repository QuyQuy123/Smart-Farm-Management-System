"""Reproducible QLoRA / LoRA Fine-Tuning Pipeline for FarmShift Intent & Tool-Calling Router.

Supports:
- `--dry-run`: Validates dataset schemas, ChatML turns, token budget, LoRA hyperparameters,
  and outputs a reproducible `training_plan.json` without requiring GPU/torch.
- Full GPU run: Trains LoRA adapter (`r=16, lora_alpha=32`) via HuggingFace `transformers` + `peft` + `trl`.
"""
from __future__ import annotations

import argparse
from dataclasses import asdict, dataclass
import json
from pathlib import Path
from typing import Any

DEFAULT_DATASET_DIR = Path(__file__).resolve().parent / "artifacts" / "datasets"
DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent / "artifacts" / "intent_lora"


@dataclass
class IntentLoraConfig:
    base_model: str = "Qwen/Qwen2.5-7B-Instruct"
    lora_r: int = 16
    lora_alpha: int = 32
    lora_dropout: float = 0.05
    target_modules: tuple[str, ...] = (
        "q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"
    )
    learning_rate: float = 2e-4
    num_train_epochs: int = 3
    per_device_train_batch_size: int = 4
    gradient_accumulation_steps: int = 4
    max_seq_length: int = 1024
    warmup_ratio: float = 0.05
    seed: int = 42


def format_chatml_messages(messages: list[dict[str, Any]], tokenizer: Any = None) -> str:
    """Formats ChatML turns (including assistant tool_calls) into a single SFT text string."""
    if tokenizer is not None and hasattr(tokenizer, "apply_chat_template"):
        try:
            return tokenizer.apply_chat_template(
                messages, tokenize=False, add_generation_prompt=False
            )
        except Exception:
            pass
    parts: list[str] = []
    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content")
        tool_calls = msg.get("tool_calls")
        if tool_calls:
            body = json.dumps({"tool_calls": tool_calls}, ensure_ascii=False)
        else:
            body = "" if content is None else str(content)
        parts.append(f"<|im_start|>{role}\n{body}<|im_end|>")
    return "\n".join(parts)


def validate_sft_dataset(jsonl_path: Path) -> dict[str, Any]:
    if not jsonl_path.is_file():
        raise FileNotFoundError(f"Missing SFT dataset file: {jsonl_path}")
    count = 0
    max_chars = 0
    tool_call_rows = 0
    for line_no, raw in enumerate(jsonl_path.read_text(encoding="utf-8").splitlines(), start=1):
        if not raw.strip():
            continue
        row = json.loads(raw)
        msgs = row.get("messages")
        if not isinstance(msgs, list) or len(msgs) != 3:
            raise ValueError(f"Line {line_no}: expected 3 ChatML messages")
        if msgs[0].get("role") != "system" or msgs[1].get("role") != "user" or msgs[2].get("role") != "assistant":
            raise ValueError(f"Line {line_no}: invalid ChatML role sequence")
        if msgs[2].get("tool_calls"):
            tool_call_rows += 1
        total_chars = sum(len(json.dumps(m, ensure_ascii=False)) for m in msgs)
        max_chars = max(max_chars, total_chars)
        count += 1
    if count == 0:
        raise ValueError(f"Empty SFT dataset: {jsonl_path}")
    return {
        "path": str(jsonl_path),
        "examples": count,
        "tool_call_examples": tool_call_rows,
        "max_record_chars": max_chars,
        "estimated_max_tokens": max(1, max_chars // 3),
    }


def run_training(
    *,
    dataset_dir: Path,
    output_dir: Path,
    cfg: IntentLoraConfig,
    dry_run: bool = False,
) -> dict[str, Any]:
    train_stats = validate_sft_dataset(dataset_dir / "sft_intent_train.jsonl")
    val_stats = validate_sft_dataset(dataset_dir / "sft_intent_val.jsonl")

    output_dir.mkdir(parents=True, exist_ok=True)
    plan = {
        "pipeline": "farmshift_intent_lora",
        "dry_run": dry_run,
        "config": asdict(cfg),
        "train_dataset": train_stats,
        "val_dataset": val_stats,
    }
    (output_dir / "training_plan.json").write_text(
        json.dumps(plan, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    if dry_run:
        return plan

    import torch
    from datasets import load_dataset
    from peft import LoraConfig
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig, TrainingArguments
    from trl import SFTTrainer

    torch.manual_seed(cfg.seed)
    tokenizer = AutoTokenizer.from_pretrained(cfg.base_model, use_fast=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16,
    )
    model = AutoModelForCausalLM.from_pretrained(
        cfg.base_model,
        quantization_config=bnb_config,
        device_map="auto",
    )
    peft_config = LoraConfig(
        r=cfg.lora_r,
        lora_alpha=cfg.lora_alpha,
        lora_dropout=cfg.lora_dropout,
        target_modules=list(cfg.target_modules),
        bias="none",
        task_type="CAUSAL_LM",
    )
    ds = load_dataset(
        "json",
        data_files={
            "train": str(dataset_dir / "sft_intent_train.jsonl"),
            "validation": str(dataset_dir / "sft_intent_val.jsonl"),
        },
    )
    ds = ds.map(
        lambda row: {"text": format_chatml_messages(row["messages"], tokenizer)},
        remove_columns=ds["train"].column_names,
    )
    args = TrainingArguments(
        output_dir=str(output_dir),
        learning_rate=cfg.learning_rate,
        num_train_epochs=cfg.num_train_epochs,
        per_device_train_batch_size=cfg.per_device_train_batch_size,
        gradient_accumulation_steps=cfg.gradient_accumulation_steps,
        warmup_ratio=cfg.warmup_ratio,
        eval_strategy="epoch",
        save_strategy="epoch",
        logging_steps=10,
        seed=cfg.seed,
        fp16=not torch.cuda.is_bf16_supported(),
        bf16=torch.cuda.is_bf16_supported(),
        report_to="none",
    )
    trainer = SFTTrainer(
        model=model,
        args=args,
        train_dataset=ds["train"],
        eval_dataset=ds["validation"],
        peft_config=peft_config,
        processing_class=tokenizer,
        dataset_text_field="text",
        max_seq_length=cfg.max_seq_length,
    )
    trainer.train()
    trainer.save_model(str(output_dir / "adapter"))
    return plan


def main() -> int:
    parser = argparse.ArgumentParser(description="FarmShift Intent/Slot LoRA Trainer")
    parser.add_argument("--dataset-dir", type=Path, default=DEFAULT_DATASET_DIR)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--base-model", default="Qwen/Qwen2.5-7B-Instruct")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    cfg = IntentLoraConfig(
        base_model=args.base_model,
        num_train_epochs=args.epochs,
        seed=args.seed,
    )
    result = run_training(
        dataset_dir=args.dataset_dir,
        output_dir=args.output_dir,
        cfg=cfg,
        dry_run=args.dry_run,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
