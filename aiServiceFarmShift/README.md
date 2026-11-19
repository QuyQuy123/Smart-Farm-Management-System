# aiServiceFarmShift - Dịch vụ Trí tuệ Nhân tạo FarmShift

Phân hệ Microservice xử lý AI OCR bóc tách chứng từ hóa đơn & phiếu cân xuất bán, nhận diện giọng nói (Voice-to-Data STT) và trợ lý NLU/kỹ thuật chăn nuôi cho Nền tảng Quản lý Trang trại FarmShift.

---

## 🛠️ Công nghệ Sử dụng
- **Ngôn ngữ**: Python 3.11+
- **Web Framework**: FastAPI, Uvicorn
- **Thư viện xử lý ảnh & PDF**: OpenCV (`opencv-python-headless`), Pillow, NumPy, PyMuPDF
- **Mô hình AI**:
  - Tiền xử lý ảnh hóa đơn (OpenCV Hough-line Deskew, LAB CLAHE contrast enhancement) & chuẩn hóa PDF đa trang (tối đa 4 trang, 10MB)
  - Vision LLM (OpenAI `gpt-4o-mini` / tương thích OpenAI Vision API) cho hóa đơn nhập hàng & phiếu cân bán gà
  - Voice STT & NLU: Groq `whisper-large-v3` (kèm bộ lọc ảo giác 3 lớp + hậu xử lý ngữ âm tiếng Việt chăn nuôi) & Groq `llama-3.3-70b-versatile` (fallback OpenAI Chat)

---

## 🔒 Cấu hình & Bảo mật Nội bộ
Sao chép `.env.example` thành `.env` và cấu hình các biến môi trường:
- `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_API_URL`
- `GROQ_API_KEY`, `GROQ_STT_MODEL`, `GROQ_CHAT_MODEL`
- `AI_INTERNAL_TOKEN`: Shared secret cho header `X-Internal-AI-Token` giữa `backendFarmShift` và `aiServiceFarmShift`. Khi `DEBUG=false`, toàn bộ `/api/*` từ chối request (HTTP `403`) nếu thiếu hoặc sai token.
- `DEBUG`: `false` mặc định cho production (`true` khi dev local để mở `/docs` và cho phép bỏ qua token nếu cần).

---

## 🚀 Hướng dẫn Khởi chạy

### Tự chạy cùng backend local
Sau khi tạo `venv` và cài `requirements.txt` một lần, chỉ cần chạy backend Spring Boot với profile `local`.
Backend tự mở AI service bằng Python trong `venv`, truyền `AI_INTERNAL_TOKEN` sang tiến trình con và chờ kiểm tra `/health`.
Nếu AI đã chạy sẵn thì dùng lại. Khi backend dừng bình thường, tiến trình AI do backend tạo cũng được dừng.
Log AI nằm trong `backendFarmShift/target/ai-service.log` khi chạy từ thư mục backend.
Đặt `AI_SERVICE_AUTOSTART_ENABLED=false` nếu muốn chạy AI riêng bằng các cách bên dưới.

### Cách 1: Khởi chạy bằng Docker
```bash
cd aiServiceFarmShift
docker compose up --build -d
```
Service lắng nghe tại `http://127.0.0.1:8000` (Swagger UI tại `/docs` khi `DEBUG=true`).

### Cách 2: Khởi chạy trực tiếp bằng Python
```bash
cd aiServiceFarmShift
python -m venv venv

# Kích hoạt venv (Windows):
venv\Scripts\activate

# Kích hoạt venv (Linux/macOS):
source venv/bin/activate

# Cài đặt thư viện:
pip install -r requirements.txt

# Khởi chạy:
uvicorn main:app --reload --port 8000
```

### Chạy kiểm thử (`unittest`)
```powershell
.\venv\Scripts\python.exe -m unittest discover -s tests -v
```

---

## 📡 Danh sách API Endpoints

Tất cả endpoint `/api/*` yêu cầu header `X-Internal-AI-Token` khớp với `AI_INTERNAL_TOKEN` (trừ khi `DEBUG=true` và `AI_INTERNAL_TOKEN` để trống).

| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `GET` / `HEAD` | `/health`, `/api/health` | Kiểm tra tình trạng hoạt động (public healthcheck) |
| `POST` | `/api/voice/transcribe` | Chuyển đổi giọng nói tiếng Việt chăn nuôi (STT + bộ lọc ảo giác 3 lớp + chuẩn hóa ngữ âm) |
| `POST` | `/api/voice/chat` | Phân tích ý định NLU & trả lời câu hỏi chăn nuôi qua LLM (Groq → OpenAI fallback) |
| `POST` | `/api/ocr/extract-invoice` | Bóc tách hóa đơn nhập hàng (JPG/PNG/WEBP/PDF tối đa 10MB, 4 trang) |
| `POST` | `/api/ocr/extract-weight-slip` | Bóc tách phiếu cân xuất bán gà (JPG/PNG/WEBP/PDF tối đa 10MB, 4 trang) |
| `POST` | `/api/ocr/preprocess` | Kiểm tra góc nghiêng & tiền xử lý ảnh (JPG/PNG/WEBP) |
| `GET` | `/api/ocr/sample` | Lấy dữ liệu hóa đơn mẫu thử nghiệm |
