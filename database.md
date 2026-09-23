# Tài liệu Đặc tả Cơ sở Dữ liệu (Database Schema) - FarmShift

Tài liệu này mô tả cấu trúc các bảng trong cơ sở dữ liệu của dự án FarmShift, bao gồm kiểu dữ liệu, ràng buộc và ý nghĩa của từng trường được suy luận tự động.

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
