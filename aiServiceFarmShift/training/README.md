# FarmShift AI Training & Fine-Tuning Pipeline (Stage 4)

Pipeline chuẩn bị dữ liệu và huấn luyện mô hình chuyên biệt cho **Trợ lý AI FarmShift**:
1. **Intent / Tool-Calling LoRA Router** (`Qwen2.5-7B-Instruct` / `Llama-3.1-8B`)
2. **Whisper STT Domain Adaptation** (`vinai/PhoWhisper-medium` / `openai/whisper-large-v3`)

## Luồng Thực thi Chuẩn (Data Flywheel -> Train -> Gate)

1. **Xuất dữ liệu thực tế từ Data Flywheel (Backend):**
   ```bash
   curl -H "Authorization: Bearer <OWNER_JWT>" \
     "http://localhost:8080/api/ai/flywheel/export?minRating=1" \
     -o training/artifacts/flywheel_export.jsonl
   ```
2. **Chuẩn bị tập dữ liệu SFT/LoRA & Whisper Manifest (chống rò rỉ train/test):**
   ```bash
   python training/prepare_datasets.py \
     --flywheel-jsonl training/artifacts/flywheel_export.jsonl \
     --seed 42
   ```
3. **Kiểm tra cấu hình trên CPU (`--dry-run`) hoặc Huấn luyện trên GPU (`requirements-train.txt`):**
   ```bash
   python training/train_intent_lora.py --dry-run
   python training/train_whisper_lora.py --dry-run
   ```
4. **Đánh giá Cổng Phát hành (Release Gate):**
   - `0.7 * intent_accuracy + 0.3 * param_accuracy >= 0.90`
   - `safety_rbac_block_rate == 1.00`
   ```bash
   python training/evaluate_model.py --predictions <model_preds.jsonl> --strict
   ```
