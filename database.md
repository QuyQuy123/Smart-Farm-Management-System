# Tài liệu Đặc tả Cơ sở Dữ liệu (Database Schema) - FarmShift

Tài liệu này mô tả cấu trúc các bảng trong cơ sở dữ liệu của dự án FarmShift, bao gồm kiểu dữ liệu, ràng buộc và ý nghĩa của từng trường được suy luận tự động.

## Bảng `product_categories` — Danh mục hàng hóa

Entity `ProductCategory` lưu nhóm/loại hàng tại **Thiết lập danh mục → Danh mục hàng hóa** (tên tab trước đây là Loại hàng hóa). Bảng này độc lập với `warehouse_categories`.

| Trường | Kiểu dữ liệu | Ràng buộc / Ý nghĩa |
| :--- | :--- | :--- |
| `id` | BIGINT | PRIMARY KEY, tự tăng. API sinh mã hiển thị `HH000001` từ ID, giữ nguyên khi đổi tên. |
| `name` | VARCHAR(150) | NOT NULL. Tên danh mục hàng hóa, bắt buộc nhập. |
| `name_key` | VARCHAR(150) | NOT NULL, UNIQUE. Tên chuẩn hóa Unicode NFC, bỏ khoảng trắng đầu/cuối và chuyển chữ thường để ngăn trùng tên. |
| `description` | VARCHAR(1000) | Mô tả / ghi chú, có thể để trống. |
| `created_at` | TIMESTAMP | Thời điểm tạo đầy đủ giờ/phút/giây; UI chỉ hiển thị `dd/mm/yyyy`. Không đổi khi sửa danh mục. |
| `updated_at` | TIMESTAMP | Hibernate tự ghi thời điểm cập nhật. |

API `GET /api/product-categories` và `GET /api/product-categories/{id}` dành cho tài khoản đăng nhập. `POST`, `PUT /{id}`, `DELETE /{id}` chỉ dành cho `ROLE_FARM_OWNER`. Danh sách sắp xếp theo `created_at`, rồi ID tăng dần. UI hỗ trợ tìm kiếm, xem, thêm, sửa, xác nhận xóa và sử dụng thông báo chung ở header.

Chưa có entity hàng hóa nên `itemCount` hiện là `0`, không lưu số lượng giả hoặc nhập thủ công. Khi có entity hàng hóa, cần liên kết khóa ngoại, đếm mặt hàng và chặn xóa danh mục đang được sử dụng. Không tự thêm dữ liệu mẫu. Khởi động backend với `spring.jpa.hibernate.ddl-auto=update` để tạo bảng.

## Bảng `warehouse_categories` — Danh mục kho

Entity `WarehouseCategory` lưu danh mục tại **Thiết lập danh mục → Danh mục kho**. Đây là danh mục nhóm hàng lưu trữ (Kho cám, Kho thuốc...), chưa phải danh sách kho vật lý với vị trí và sức chứa.

| Trường | Kiểu dữ liệu | Ràng buộc / Ý nghĩa |
| :--- | :--- | :--- |
| `id` | BIGINT | PRIMARY KEY, tự tăng. API sinh mã hiển thị `DM000001` từ ID; mã giữ nguyên khi sửa tên và không tái sử dụng khi xóa. |
| `name` | VARCHAR(150) | NOT NULL. Tên danh mục, bắt buộc nhập. |
| `name_key` | VARCHAR(150) | NOT NULL, UNIQUE. Tên chuẩn hóa Unicode NFC, bỏ khoảng trắng đầu/cuối và chuyển chữ thường để kiểm tra trùng. |
| `description` | VARCHAR(1000) | Mô tả danh mục, có thể để trống. |
| `created_at` | TIMESTAMP | Hibernate tự ghi đầy đủ ngày và giờ tạo, gồm giờ/phút/giây và phần thập phân. Không thay đổi khi sửa danh mục. API trả đầy đủ thời điểm; UI cột Ngày tạo chỉ định dạng `dd/mm/yyyy`. Tab Kho hàng hóa sắp xếp theo thời điểm tăng dần (cũ trước, mới sau), nếu trùng thời điểm thì theo ID tăng dần. |
| `updated_at` | TIMESTAMP | Hibernate tự ghi thời điểm cập nhật. |

API: `GET /api/warehouse-categories` và `GET /api/warehouse-categories/{id}` cho người dùng đăng nhập. `POST`, `PUT /{id}` và `DELETE /{id}` chỉ cho `ROLE_FARM_OWNER`. Xóa bản ghi sau khi người dùng xác nhận. Chưa có entity hàng hóa nên `itemCount` hiện trả `0`, không phải trường nhập hoặc cột lưu số đếm thủ công. Khi bổ sung hàng hóa, cần liên kết khóa ngoại tới danh mục, đếm bản ghi liên quan và chặn xóa danh mục đang có hàng hóa.

Với `spring.jpa.hibernate.ddl-auto=update`, Hibernate tạo bảng khi khởi động lại backend. Không tự thêm các bản ghi mẫu hoặc số lượng mẫu trong ảnh.

## Lưu ảnh đại diện khi chạy local

Không bổ sung bảng mới: đường dẫn ảnh dùng các cột `accounts.avatar_url` và `customers.avatar_url` hiện có. `POST /api/user/avatar` nhận ảnh multipart, lưu file và cập nhật đường dẫn cho tài khoản đăng nhập (cùng hồ sơ customer nếu có) ngay khi upload thành công.

Với `STORAGE_PROVIDER=local`, file nằm ở `frontendFarmShift/public/img/avatars/<UUID>.jpg` (hoặc `.png`, `.gif`), database lưu đường dẫn web `/img/avatars/<UUID>.jpg`. Frontend Vite phục vụ ảnh từ thư mục `public`; không lưu chuỗi Base64 vào database trong luồng này. Khi chạy server với `STORAGE_PROVIDER=r2`, vẫn lưu ảnh trên Cloudflare R2 và lưu URL công khai vào các cột trên.

## Bảng `farms` — Thông tin cơ sở & Trang trại

Entity: `Farm`. Lưu thông tin tại **Thiết lập chung → Thông tin cơ sở & Trang trại** vào PostgreSQL, thay cho việc chỉ lưu trong trình duyệt.

| Tên trường | Kiểu dữ liệu | Ràng buộc / Ý nghĩa |
| :--- | :--- | :--- |
| `id` | BIGINT | PRIMARY KEY. Phiên bản hiện tại dùng một trang trại chung cho hệ thống, ID cố định `1` do ứng dụng quản lý. |
| `name` | VARCHAR(200) | NOT NULL. Tên cơ sở / hộ kinh doanh; hiển thị trên header và breadcrumb. |
| `owner` | VARCHAR(100) | NOT NULL. Chủ hộ / người đại diện; độc lập với họ tên tài khoản. |
| `phone` | VARCHAR(20) | NOT NULL. Số điện thoại liên hệ, cho phép dấu cách và ký tự định dạng. |
| `scale` | VARCHAR(100) | Quy mô chăn nuôi, ví dụ `15,000 con`. |
| `address` | VARCHAR(500) | Địa chỉ trang trại. |
| `type` | VARCHAR(200) | Mô hình sản xuất chính. |
| `created_at` | TIMESTAMP | Hibernate tự ghi thời điểm tạo. |
| `updated_at` | TIMESTAMP | Hibernate tự ghi thời điểm cập nhật. |

API: `GET /api/farm` dành cho tài khoản đã đăng nhập; `PUT /api/farm` chỉ dành cho `ROLE_FARM_OWNER`. Các trường bắt buộc không được chỉ chứa khoảng trắng; API kiểm tra độ dài và định dạng số điện thoại.

Với cấu hình `spring.jpa.hibernate.ddl-auto=update`, Hibernate tạo bảng khi khởi động backend. Lần bấm **Cập nhật thông tin** đầu tiên tạo bản ghi; các lần sau cập nhật cùng bản ghi. Khi chưa lưu lần nào, GET trả thành công nhưng chưa có `data`. Dữ liệu mẫu hoặc dữ liệu cũ trong trình duyệt chỉ là giá trị điền sẵn, không tự ghi vào database. Thông tin này dùng chung cho mọi tài khoản, chưa triển khai quan hệ tài khoản với nhiều trang trại.

## 1. Bảng `roles`
Quản lý các vai trò (quyền hạn) của người dùng trong hệ thống.

| STT | Tên trường (Column Name) | Kiểu dữ liệu (Data Type) | Ràng buộc (Constraints) | Giá trị mặc định (Default) | Mô tả ý nghĩa |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `id` | BIGSERIAL | PRIMARY KEY | (Tự tăng) | Khóa chính định danh duy nhất cho mỗi vai trò. |
| 2 | `name` | VARCHAR(20) | UNIQUE, NOT NULL | | Tên định danh của vai trò (VD: ROLE_FARM_OWNER). |
| 3 | `description` | VARCHAR(200) | | | Mô tả chi tiết về quyền hạn và ý nghĩa của vai trò này. |

## 2. Bảng `accounts`
Quản lý thông tin tài khoản đăng nhập của người dùng vào hệ thống.

| STT | Tên trường (Column Name) | Kiểu dữ liệu (Data Type) | Ràng buộc (Constraints) | Giá trị mặc định (Default) | Mô tả ý nghĩa |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `id` | BIGSERIAL | PRIMARY KEY | (Tự tăng) | Khóa chính định danh tài khoản. |
| 2 | `email` | VARCHAR(50) | UNIQUE, NOT NULL | | Địa chỉ email dùng để đăng nhập hệ thống. |
| 3 | `password` | VARCHAR(255) | NOT NULL | | Mật khẩu đã được mã hóa (băm/hash). |
| 4 | `role_id` | BIGINT | REFERENCES roles(id) | | Khóa ngoại liên kết tới bảng `roles`, xác định quyền hạn của tài khoản. |
| 5 | `full_name` | VARCHAR(100) | | | Họ và tên đầy đủ của chủ tài khoản. |
| 6 | `avatar_url` | TEXT | | | Đường dẫn (URL) tới ảnh đại diện của tài khoản. |
| 7 | `is_active` | BOOLEAN | | TRUE | Trạng thái hoạt động của tài khoản (TRUE = đang hoạt động, có thể đăng nhập). |
| 8 | `created_at` | TIMESTAMP | | CURRENT_TIMESTAMP | Thời gian khởi tạo tài khoản. |

## 3. Bảng `customers`
Quản lý thông tin hồ sơ chi tiết của khách hàng hoặc người dùng liên kết với tài khoản.

| STT | Tên trường (Column Name) | Kiểu dữ liệu (Data Type) | Ràng buộc (Constraints) | Giá trị mặc định (Default) | Mô tả ý nghĩa |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `id` | BIGSERIAL | PRIMARY KEY | (Tự tăng) | Khóa chính định danh bản ghi khách hàng. |
| 2 | `account_id` | BIGINT | UNIQUE, REFERENCES accounts(id) ON DELETE CASCADE | | Khóa ngoại liên kết 1-1 với bảng `accounts`. Xóa tài khoản sẽ tự động xóa luôn thông tin này. |
| 3 | `full_name` | VARCHAR(100) | NOT NULL | | Họ và tên đầy đủ của khách hàng/người dùng. |
| 4 | `phone` | VARCHAR(20) | | | Số điện thoại liên hệ. |
| 5 | `citizen_id` | VARCHAR(20) | UNIQUE | | Số Căn cước công dân / CMND (duy nhất cho mỗi người). |
| 6 | `address` | VARCHAR(255) | | | Địa chỉ nơi ở hoặc nơi làm việc. |
| 7 | `avatar_url` | TEXT | | | Đường dẫn (URL) ảnh đại diện của cá nhân. |
| 8 | `date_of_birth` | DATE | | | Ngày tháng năm sinh. |
| 9 | `created_at` | TIMESTAMP | | CURRENT_TIMESTAMP | Thời gian tạo hồ sơ thông tin này. |
