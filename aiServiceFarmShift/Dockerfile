# Dockerfile for aiServiceFarmShift
FROM python:3.11-slim

WORKDIR /app

# Cài đặt thư viện hệ thống cần thiết cho OpenCV và xử lý ảnh
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements và cài đặt dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ mã nguồn
COPY . .

# Expose port (Render sẽ tự động ánh xạ qua $PORT)
EXPOSE 8000

# Khởi chạy FastAPI linh hoạt theo biến PORT của Render
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
