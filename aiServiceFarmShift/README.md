# aiServiceFarmShift - Dịch vụ Trí tuệ Nhân tạo FarmShift

Phân hệ Microservice xử lý AI OCR bóc tách chứng từ hóa đơn A4, nhận diện giọng nói (Voice-to-Data STT) và trợ lý kỹ thuật chăn nuôi cho Nền tảng Quản lý Trang trại FarmShift.

---

## 🛠️ Công nghệ Sử dụng
- **Ngôn ngữ**: Python 3.10+
- **Web Framework**: FastAPI, Uvicorn
- **Thư viện xử lý ảnh**: OpenCV, Pillow, NumPy
- **Mô hình AI**:
  - Tiền xử lý ảnh (OpenCV Deskew, CLAHE contrast enhancement)
  - Vision LLM (OpenAI GPT-4o-mini / Vision models)
  - Offline Rule-based Agricultural Invoice Engine (C.P., Dabaco, Hanvet)

---

## 🚀 Hướng dẫn Khởi chạy

### Cách 1: Khởi chạy bằng Docker (Khuyên dùng)
```bash
cd aiServiceFarmShift
docker compose up --build -d
```
Service sẽ chạy tại: `http://localhost:8000`  
Tài liệu Swagger API: `http://localhost:8000/docs`

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

---

## 📡 Danh sách API Endpoints

| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `GET` | `/health` | Kiểm tra tình trạng hoạt động |
| `POST` | `/api/voice/transcribe` | Chuyển đổi giọng nói (STT) tiếng Việt chăn nuôi sang văn bản |
| `POST` | `/api/ocr/extract-invoice` | Bóc tách hóa đơn & phiếu cân xuất bán A4 |
| `POST` | `/api/ocr/preprocess` | Kiểm tra góc nghiêng & tiền xử lý ảnh |
| `GET` | `/api/ocr/sample` | Lấy dữ liệu hóa đơn mẫu thử nghiệm |
