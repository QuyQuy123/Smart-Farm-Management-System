# OCR phiếu cân bán gà

## Luồng sử dụng

Trong Quản lý bán hàng → Tạo đơn bán hàng, bấm **Bóc tách phiếu cân**.
Chụp camera hoặc tải JPG/PNG/PDF (tối đa 10MB, PDF tối đa 4 trang).
Đối chiếu ảnh/PDF bên trái và sửa form bên phải. Bấm **Xác nhận và lưu đơn bán**.
Các lượt cân chỉ phục vụ đối chiếu; đơn bán lưu những trường được form hỗ trợ.
Khối lượng điền vào form là **cân thực tế sau trừ bì**, không phải cân cả lồng.
Không tự chọn lứa nếu có nhiều lứa khớp khu/chuồng; người dùng cần chọn từ database.
Nếu phiếu không ghi thanh toán, form chọn Nợ và nhắc người dùng kiểm tra.

## Cấu hình

- Cài dependencies AI: `pip install -r aiServiceFarmShift/requirements.txt` (thêm PyMuPDF để đọc PDF).
- AI service sử dụng `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_API_URL` hiện có trong `.env`.
- Backend gọi AI qua `ai-service.url` / `AI_SERVICE_URL` hiện có.
- Backend lưu nguyên bản vào `frontendFarmShift/public/weigh-slips` mặc định.
  Có thể đặt `SALES_WEIGHT_SLIPS_DIRECTORY` thành đường dẫn tuyệt đối khác.
- Khi triển khai tách frontend/backend, mount thư mục lưu trữ bền vững để frontend phục vụ
  đúng URL `/weigh-slips/*`. Static build trên Vercel không tự nhận file backend ghi vào repo;
  môi trường đó cần cấu hình nơi lưu trữ/serve file có quyền ghi trước khi dùng chức năng lưu bản gốc.
- Camera cần HTTPS hoặc localhost và quyền truy cập camera từ trình duyệt.

Không lưu bản gốc trong bước OCR. Khi xác nhận, lưu đơn và liên kết bản gốc;
rollback database sẽ xóa file mới ghi. Request ID được dùng để tránh tạo trùng khi thử lại.
Các file trong public có thể được truy cập bằng URL, theo yêu cầu lưu vào frontend public.
Luồng này không dùng dữ liệu mẫu dự phòng nếu OpenAI không hoạt động.

## API

- `POST /api/sales/orders/ocr`: multipart `file`, trả bản nháp (chưa ghi database/file).
- `POST /api/sales/orders/weight-slip`: multipart `data` (JSON SalesOrderRequest) và `file`.
- Cả hai chỉ dành cho chủ trại/kế toán. Đơn trả về có `weightSlipUrl` để xem bản gốc từ danh sách.

## Tự chạy AI service khi mở backend local

Backend ở profile `local` tự chạy `python -m uvicorn main:app` trong thư mục AI,
ưu tiên Python của `venv`, sau đó `.venv`. Không cần mở terminal AI riêng.
Nếu `/health` đã xác nhận AI service hoạt động thì dùng lại tiến trình đó.
Backend chỉ dừng tiến trình mà nó tự tạo; không dừng service chạy bằng tay hoặc Docker.
Không chạy với profile `test` hoặc khi URL AI trỏ tới server từ xa.

- Tắt: `AI_SERVICE_AUTOSTART_ENABLED=false`.
- Chỉ định Python: `AI_SERVICE_PYTHON` (đường dẫn tới python.exe, không kèm tham số).
- Chỉ định thư mục: `AI_SERVICE_DIRECTORY`.
- Thời gian chờ: `AI_SERVICE_START_TIMEOUT=45` (giây).
- Log: `backendFarmShift/target/ai-service.log` nếu khởi động từ backendFarmShift.
- Vẫn cần cài dependencies trong venv một lần và cấu hình `.env` của AI service.
- Nếu AI khởi động lỗi, backend vẫn chạy và ghi cảnh báo kèm đường dẫn log.
