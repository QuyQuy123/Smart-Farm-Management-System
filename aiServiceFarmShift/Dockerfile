# Dockerfile for aiServiceFarmShift
FROM python:3.11-slim

WORKDIR /app

# Cài đặt thư viện hệ thống cần thiết cho OpenCV và xử lý ảnh
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system app \
    && useradd --system --gid app app

# Copy requirements và cài đặt dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ mã nguồn và chuyển quyền cho user không phải root
COPY --chown=app:app . .

USER app

# Expose port (Render sẽ tự động ánh xạ qua $PORT)
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -fsS http://127.0.0.1:${PORT:-8000}/health >/dev/null || exit 1

# Khởi chạy FastAPI linh hoạt theo biến PORT của Render
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --limit-concurrency 100 --timeout-keep-alive 5"]
