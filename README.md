# Smart Farm Management System - Nền tảng Quản lý Trang trại Chăn nuôi Thông minh

> Hệ thống quản lý trang trại chăn nuôi Gà thịt tích hợp công nghệ AI OCR bóc tách chứng từ/phiếu bán A4, nhập liệu giọng nói (Voice-to-Data) và giám sát cảnh báo nhiệt độ chuồng trại Real-time (IoT).

---

# 📌 1. Giới thiệu Dự án

Mô hình chăn nuôi trang trại tại Việt Nam đang phát triển nhanh về quy mô, tuy nhiên phương thức quản lý vẫn phụ thuộc nhiều vào ghi chép sổ sách thủ công. Các phần mềm thương mại hiện tại chủ yếu đóng vai trò "sổ sách điện tử", khiến chủ trang trại trung niên (ngoài 40 tuổi) hoặc công nhân gặp rào cản lớn trong việc nhập liệu thủ công hàng ngày.

**Smart Farm Management System** được phát triển nhằm giải quyết triệt để các điểm nghẽn này với 3 trụ cột chính:

## 1. Quản lý Nghiệp vụ & AI OCR

- Quản lý lứa nuôi.
- Theo dõi hao hụt.
- Quản lý lịch tiêm vắc-xin.
- Theo dõi công nợ nhà cung cấp.
- Chụp ảnh hóa đơn/phiếu kê xuất bán A4 để AI tự động bóc tách dữ liệu vào hệ thống.

## 2. Cảnh báo Nhiệt độ IoT Real-time

- Kết nối cảm biến nhiệt độ chuồng trại.
- Phát cảnh báo khẩn cấp qua Push Notification hoặc Còi báo động.
- Ngăn ngừa rủi ro sốc nhiệt cho vật nuôi.

## 3. Trợ lý AI Voice & Chatbot

- Nhập nhật ký chăn nuôi bằng giọng nói (Voice-to-Data).
- Chatbot hỗ trợ kỹ thuật chăn nuôi.
- Gợi ý phác đồ điều trị được cá nhân hóa theo từng trang trại.

---

# 🏗️ 2. Kiến trúc Công nghệ (Tech Stack)

| Thành phần | Công nghệ |
|------------|-----------|
| Edge Gateway | Nginx 1.27 Alpine (Rate limit 3 tầng, SPA micro-cache, REST & `/api/ws` STOMP) |
| Frontend | React 19, Vite 8, React Router 7, CSS Modules (`*.module.css`), `lucide-react`, Axios, STOMP WS, MQTT |
| Backend Core | Java 21 LTS, Spring Boot 3.4.1, Spring Data JPA, Spring Security (Stateless JWT), Lombok, PDFBox, Web Push VAPID |
| AI Service | Python 3.11+, FastAPI, OpenCV, Pillow, PyMuPDF, Groq (`whisper-large-v3`, `llama-3.3-70b-versatile`), OpenAI Vision (`gpt-4o-mini`) |
| Database | PostgreSQL 16 (`ddl-auto=none` + idempotent `ApplicationRunner` upgrades) |
| IoT Hardware | ESP32 / Arduino, DHT22, SHT30 (MQTT) |

---

# 📂 3. Cấu trúc Thư mục (Folder Structure)

```text
Smart-Farm-Management-System/
├── .gitignore
├── README.md
│
├── backendFarmShift/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/farmshift/
│   │   │   │   ├── config/
│   │   │   │   ├── controller/
│   │   │   │   ├── dto/
│   │   │   │   │   ├── request/
│   │   │   │   │   └── response/
│   │   │   │   ├── entity/
│   │   │   │   ├── repository/
│   │   │   │   ├── service/
│   │   │   │   │   └── impl/
│   │   │   │   ├── exception/
│   │   │   │   └── util/
│   │   │   └── resources/
│   │   │       ├── application.yml
│   │   │       └── db/migration/
│   │   └── test/
│   └── pom.xml
│
├── frontendFarmShift/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── pages/
│   │   │   ├── Dashboard/
│   │   │   ├── BatchManagement/
│   │   │   ├── Inventory/
│   │   │   ├── InvoicesOCR/
│   │   │   └── IoTAlerts/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── context/
│   │   ├── routes/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env
│   ├── package.json
│   └── vite.config.js
│
└── aiServiceFarmShift/
    ├── app/
    │   ├── api/
    │   ├── core/
    │   └── services/
    ├── main.py
    └── requirements.txt
```

---

# 🛠️ 4. Hướng dẫn Cài đặt & Chạy Dự án

## Yêu cầu Tiền đề (Prerequisites)

- Java SDK 17 hoặc 21
- Node.js 18+
- Python 3.10+
- PostgreSQL Database

Tạo sẵn database:

```sql
CREATE DATABASE farmshift_db;
```

---

## Bước 1: Khởi chạy Backend (backendFarmShift)

### 1. Truy cập thư mục Backend

```bash
cd backendFarmShift
```

### 2. Cấu hình Database

Mở file cấu hình local (không commit lên Git):

```text
backendFarmShift/src/main/resources/application-local.properties
```

Hoặc truyền qua biến môi trường tương ứng với `application.properties`:

```properties
DB_HOST=localhost
DB_PORT=5432
DB_NAME=farmshift_db
DB_USERNAME=postgres
DB_PASSWORD=your_password
```

*(Schema PostgreSQL sử dụng `spring.jpa.hibernate.ddl-auto=none` và được nâng cấp tự động, idempotent qua các `ApplicationRunner` khi khởi động backend.)*

### 3. Khởi chạy Spring Boot

#### Windows

```bash
mvnw.cmd spring-boot:run
```

#### Linux/macOS

```bash
./mvnw spring-boot:run
```

Backend sẽ chạy tại:

```text
http://localhost:8080
```

---

## Bước 2: Khởi chạy AI Service (aiServiceFarmShift)

### 1. Truy cập thư mục AI Service

```bash
cd aiServiceFarmShift
```

### 2. Tạo Virtual Environment

#### Windows

```bash
python -m venv venv
venv\Scripts\activate
```

#### Linux/macOS

```bash
python -m venv venv
source venv/bin/activate
```

### 3. Cài đặt Dependencies

```bash
pip install -r requirements.txt
```

### 4. Khởi chạy FastAPI

```bash
uvicorn main:app --reload --port 8000
```

AI Service sẽ chạy tại:

```text
http://localhost:8000
```

Swagger API:

```text
http://localhost:8000/docs
```

---

## Bước 3: Khởi chạy Frontend (frontendFarmShift)

### 1. Truy cập thư mục Frontend

```bash
cd frontendFarmShift
```

### 2. Cài đặt Dependencies

```bash
npm install
```

### 3. Khởi chạy Development Server

```bash
npm run dev
```

Frontend sẽ chạy tại:

```text
http://localhost:5173
```

---

# 🚀 Các Tính năng Chính

## Quản lý Chăn nuôi

- Quản lý lứa nuôi.
- Theo dõi tăng trưởng vật nuôi.
- Theo dõi tỷ lệ hao hụt.
- Quản lý lịch tiêm phòng.

## Quản lý Kho

- Quản lý thức ăn.
- Quản lý thuốc thú y.
- Quản lý vắc-xin.
- Theo dõi nhập xuất tồn kho.

## AI OCR

- Chụp ảnh hóa đơn.
- Chụp phiếu kê xuất bán A4.
- Tự động trích xuất dữ liệu.
- Giảm nhập liệu thủ công.

## AI Voice-to-Data

- Ghi nhận nhật ký bằng giọng nói.
- Chuyển đổi giọng nói thành dữ liệu hệ thống.
- Hỗ trợ người dùng ít kinh nghiệm công nghệ.

## IoT Monitoring

- Theo dõi nhiệt độ chuồng trại theo thời gian thực.
- Cảnh báo vượt ngưỡng.
- Hỗ trợ phòng chống sốc nhiệt.

## AI Chatbot

- Hỏi đáp kỹ thuật chăn nuôi.
- Tư vấn chăm sóc vật nuôi.
- Hỗ trợ xây dựng phác đồ điều trị.

---

# 📈 Roadmap

- [x] Quản lý lứa nuôi
- [x] Quản lý kho
- [x] OCR hóa đơn & phiếu cân bán gà
- [x] AI Chatbot
- [x] Voice-to-Data
- [x] IoT Real-time Monitoring
- [ ] Mobile App (Android/iOS)
- [ ] AI Predictive Analytics

---

# 📝 License

MIT License

---
# Lưu avatar khi phát triển local

Trong `backendFarmShift/src/main/resources/application-local.properties`, đặt:

```properties
STORAGE_PROVIDER=local
# Không bắt buộc. Nếu cần, đặt đường dẫn tuyệt đối đến frontendFarmShift/public/img.
STORAGE_LOCAL_DIRECTORY=
```

Khởi động backend từ thư mục gốc dự án hoặc `backendFarmShift`, và chạy frontend bằng Vite. Ảnh upload được lưu tại `frontendFarmShift/public/img/avatars`; database lưu URL `/img/avatars/...`. Nút **Cắt & Lưu ảnh** lưu cả file và đường dẫn vào database ngay, không cần bấm lưu hồ sơ thêm lần nữa. Giới hạn ảnh 5MB; local hỗ trợ PNG, JPEG và GIF.

Khi triển khai server, đặt biến môi trường `STORAGE_PROVIDER=r2` để tiếp tục dùng Cloudflare R2 và cấu hình các biến `R2_*` như trước. Thư mục ảnh local được Git bỏ qua; nếu chuyển máy, cần sao chép cả thư mục ảnh cùng dữ liệu database. Nếu tùy chỉnh thư mục local, hãy trỏ nó đến `public/img` của frontend đang chạy để URL hiển thị được.
