# Tài liệu Đặc tả Cơ sở Dữ liệu (Database Schema) - FarmShift

Tài liệu này mô tả cấu trúc các bảng trong cơ sở dữ liệu của dự án FarmShift, bao gồm kiểu dữ liệu, ràng buộc và ý nghĩa của từng trường được suy luận tự động.

## Bảng `inventory_items` — Hàng hóa thực tế trong kho

Bổ sung `unit_id` (FK → `measurement_units.id`): đơn vị được chọn từ tab Đơn vị tính khi tạo/sửa hàng hóa. API yêu cầu `unitId`; dữ liệu cũ có thể để NULL cho đến khi chỉnh sửa. Không xóa đơn vị đang được hàng hóa sử dụng hoặc đổi đơn vị của hàng có tồn kho khác 0.

Entity `InventoryItem` phục vụ CRUD tại **Kho hàng hóa**. Liên kết danh mục kho, Tên hàng hóa và Nhãn hiệu trong database, thay thế dữ liệu mẫu và trạng thái tạm trong frontend.

| Trường | Kiểu dữ liệu | Ràng buộc / Ý nghĩa |
| :--- | :--- | :--- |
| `id` | BIGINT | PRIMARY KEY, tự tăng. |
| `code` | VARCHAR(40) | NOT NULL, UNIQUE. Mã tự sinh `SP` + UUID, không đổi khi sửa. Không trả về DTO hoặc hiện trên UI. |
| `image_url` | TEXT | Đường dẫn ảnh local `/img/products/...` hoặc URL R2, không lưu Base64. Có thể để trống. |
| `warehouse_id` | BIGINT | NOT NULL, FOREIGN KEY → `warehouse_categories.id`. |
| `product_id` | BIGINT | NOT NULL, FOREIGN KEY → `product_categories.id` (Tên hàng hóa). Hàng được chọn phải thuộc đúng kho. |
| `brand_id` | BIGINT | FOREIGN KEY → `brands.id`, cho phép bỏ trống. |
| `price` | NUMERIC(19,2) | NOT NULL, giá tiền không âm, tối đa 2 chữ số thập phân. |
| `stock` | NUMERIC(19,3) | NOT NULL. Backend luôn gán `0` khi tạo mới. Không có trong request CRUD và không được sửa bằng form/API CRUD; update giữ nguyên tồn kho. |
| `created_at` | TIMESTAMP | Thời điểm tạo, không đổi khi sửa. |
| `updated_at` | TIMESTAMP | Hibernate cập nhật khi sửa. |

UNIQUE (`warehouse_id`, `product_id`): một tên hàng hóa chỉ tạo một lần trong cùng kho. UI chỉ hiển thị ảnh, tên hàng hóa, giá tiền, tồn kho, nhãn hiệu và thao tác; tab kho lấy từ database theo thứ tự tạo cũ trước/mới sau. Tên hàng hóa trong popup lọc theo kho đang chọn. Ảnh dùng `POST /api/files/upload` với folder `products`, tối đa 5MB (JPEG/PNG/GIF), lưu file trước và đường dẫn khi lưu hàng hóa.

API `GET /api/inventory-items?warehouseId=...`, `GET /api/inventory-items/{id}` dành cho tài khoản đăng nhập. `POST`, `PUT /{id}`, `DELETE /{id}` chỉ dành cho `ROLE_FARM_OWNER`. Không xóa hàng hóa có tồn kho khác 0; không đổi tên/kho của hàng đang có tồn kho. Chặn xóa kho, tên hàng hóa, nhãn hiệu đang được sử dụng. Số lượng tại Danh mục kho và Tên hàng hóa được tính từ số bản ghi `inventory_items` liên quan, không phải tổng tồn kho. Không tự thêm hàng mẫu. Khởi động lại backend với `ddl-auto=update` để tạo bảng.

## Bảng `customer_contacts` — Danh bạ khách hàng

Entity `CustomerContact` phục vụ CRUD tại **Thiết lập danh mục → Khách hàng**. Bảng này riêng biệt với `customers` hiện dùng cho hồ sơ tài khoản/nhân sự; không dùng chung dữ liệu.

| Trường | Kiểu dữ liệu | Ràng buộc / Ý nghĩa |
| :--- | :--- | :--- |
| `id` | BIGINT | PRIMARY KEY, tự tăng, định danh API. |
| `code` | VARCHAR(40) | NOT NULL, UNIQUE. Mã tự sinh `KH` + UUID bỏ dấu gạch nối, không đổi khi sửa. Chỉ lưu database, không trả trong DTO hoặc hiển thị trên UI. |
| `name` | VARCHAR(200) | NOT NULL. Tên khách hàng, chuẩn hóa NFC và cắt khoảng trắng đầu/cuối. Cho phép trùng tên vì các khách hàng có thể cùng tên. |
| `phone` | VARCHAR(20) | NOT NULL. Chỉ chữ số 0–9: đầu 024/028 phải có đúng 11 số, các đầu khác đúng 10 số. |
| `created_at` | TIMESTAMP | Ngày giờ tạo gồm giây, không đổi khi sửa. |
| `updated_at` | TIMESTAMP | Hibernate cập nhật khi sửa. |

API `GET /api/customer-contacts?page=0&q=...` phân trang tại database, kích thước cố định **10 bản ghi/trang**, số trang bắt đầu từ 0. Response `data` gồm `content`, `totalElements`, `totalPages`, `page`, `size`; chỉ trả `id`, `name`, `phone` của từng khách hàng. Sắp xếp theo `created_at`, rồi ID tăng dần. Tìm theo tên (không phân biệt hoa/thường) hoặc số điện thoại trước khi phân trang.

`GET /api/customer-contacts/{id}` dành cho tài khoản đăng nhập; `POST`, `PUT /{id}`, `DELETE /{id}` chỉ dành cho `ROLE_FARM_OWNER`. UI có CRUD, xác nhận xóa, tìm kiếm, Trang trước/Trang sau và thông báo dùng chung ở header. Khi xóa khách hàng cuối của trang, UI tự quay về trang hợp lệ gần nhất. Khởi động backend với `spring.jpa.hibernate.ddl-auto=update` để tạo bảng; không tự thêm dữ liệu mẫu.

## Bảng `suppliers` — Nhà cung cấp

Entity `Supplier` phục vụ CRUD tại **Thiết lập danh mục → Nhà cung cấp**.

| Trường | Kiểu dữ liệu | Ràng buộc / Ý nghĩa |
| :--- | :--- | :--- |
| `id` | BIGINT | PRIMARY KEY, tự tăng, định danh API. |
| `code` | VARCHAR(40) | NOT NULL, UNIQUE. Mã tự sinh `NCC` + UUID không có dấu gạch nối, không đổi khi sửa. Chỉ lưu database, không trả trong DTO và không hiển thị trên UI. |
| `name` | VARCHAR(200) | NOT NULL. Đơn vị cung cấp. |
| `name_key` | VARCHAR(200) | NOT NULL, UNIQUE. Tên chuẩn hóa NFC, cắt khoảng trắng, chuyển chữ thường để ngăn trùng đơn vị. |
| `representative` | VARCHAR(100) | NOT NULL. Người đại diện. |
| `phone` | VARCHAR(20) | NOT NULL. Chỉ chữ số 0–9: đầu 024/028 phải có đúng 11 số, các đầu khác đúng 10 số. |
| `product_type_id` | BIGINT | NOT NULL, FOREIGN KEY → `product_types.id`. Nhóm nhà cung cấp được chọn từ bảng Loại hàng hóa. |
| `created_at` | TIMESTAMP | Ngày giờ tạo đầy đủ, không đổi khi sửa; UI chỉ hiện dd/mm/yyyy. |
| `updated_at` | TIMESTAMP | Hibernate tự cập nhật. |

API `GET /api/suppliers`, `GET /api/suppliers/{id}` cho tài khoản đăng nhập. `POST`, `PUT /{id}`, `DELETE /{id}` chỉ cho `ROLE_FARM_OWNER`. Danh sách sắp theo ngày tạo và ID tăng dần. Loại hàng hóa đang có nhà cung cấp sử dụng không được xóa. UI có tìm kiếm, chọn nhóm từ database, xem/sửa/xác nhận xóa và thông báo chung ở header. Không thêm dữ liệu mẫu; khởi động backend với `spring.jpa.hibernate.ddl-auto=update` để tạo bảng.

## Bảng `measurement_units` — Đơn vị tính

Entity `MeasurementUnit` phục vụ CRUD tại **Thiết lập danh mục → Đơn vị tính**.

| Trường | Kiểu dữ liệu | Ràng buộc / Ý nghĩa |
| :--- | :--- | :--- |
| `id` | BIGINT | PRIMARY KEY, tự tăng, dùng làm định danh API. |
| `code` | VARCHAR(30) | NOT NULL. Mã nhập tay, cho phép sửa, ví dụ KG, BAO25. |
| `code_key` | VARCHAR(30) | NOT NULL, UNIQUE. Mã chuẩn hóa Unicode NFC, cắt khoảng trắng đầu/cuối, chuyển chữ thường để kiểm tra trùng. |
| `name` | VARCHAR(150) | NOT NULL. Tên đơn vị. |
| `name_key` | VARCHAR(150) | NOT NULL, UNIQUE. Tên chuẩn hóa như trên để ngăn trùng. |
| `description` | VARCHAR(1000) | Mô tả, có thể bỏ trống. |
| `created_at` | TIMESTAMP | Thời điểm tạo gồm giờ/phút/giây, không đổi khi sửa; UI hiển thị dd/mm/yyyy. |
| `updated_at` | TIMESTAMP | Hibernate tự ghi khi cập nhật. |

Số lượng hàng hóa (`itemCount`) chỉ đọc, được tính từ số bản ghi `product_categories` có `specification` (nhãn UI: Đơn vị) khớp tên đơn vị, bỏ khoảng trắng đầu/cuối và không phân biệt hoa/thường. Hiện liên kết bằng chuỗi, chưa có khóa ngoại đơn vị. Khi đổi tên đơn vị, service cập nhật các chuỗi khớp trong cùng transaction. Không cho xóa đơn vị có hàng hóa sử dụng. Đây là số loại/tên hàng hóa, không phải tổng tồn kho, không nhập tay hoặc lưu số đếm giả.

API `GET /api/measurement-units`, `GET /api/measurement-units/{id}` dành cho tài khoản đăng nhập; `POST`, `PUT /{id}`, `DELETE /{id}` chỉ dành cho `ROLE_FARM_OWNER`. Sắp xếp theo thời điểm tạo và ID tăng dần. UI có tìm kiếm, xem, thêm, sửa, xác nhận xóa, nút nền xanh nhạt và thông báo chung ở header. Khởi động backend với `spring.jpa.hibernate.ddl-auto=update` để tạo bảng; không tự thêm dữ liệu mẫu.

## Bảng `product_categories` — Tên hàng hóa

Entity `ProductCategory` lưu danh mục tại **Thiết lập danh mục → Tên hàng hóa** (tên tab trước đây là Danh mục hàng hóa / Loại hàng hóa). Mỗi tên hàng hóa chọn một kho từ `warehouse_categories` qua `warehouse_id`. Kho có hàng hóa liên quan không được xóa; cần chuyển hoặc xóa các hàng hóa liên quan trước.

| Trường | Kiểu dữ liệu | Ràng buộc / Ý nghĩa |
| :--- | :--- | :--- |
| `id` | BIGINT | PRIMARY KEY, tự tăng. API sinh mã hiển thị `HH000001` từ ID (ẩn trên UI, giữ trong API response). |
| `name` | VARCHAR(150) | NOT NULL. Tên hàng hóa, bắt buộc nhập. |
| `name_key` | VARCHAR(150) | NOT NULL, UNIQUE. Tên chuẩn hóa Unicode NFC, bỏ khoảng trắng đầu/cuối và chuyển chữ thường để ngăn trùng tên. |
| `description` | VARCHAR(1000) | Mô tả / ghi chú, có thể để trống. |
| `specification` | VARCHAR(150) | Quy cách đóng gói (VD: Bao 25kg, Chai 1L). Có thể để trống. |
| `brand` | VARCHAR(150) | Nhãn hiệu / thương hiệu (VD: C.P., Dabaco, Hanvet). Có thể để trống. |
| `product_type` | VARCHAR(150) | Loại hàng hóa (VD: Thức ăn, Thuốc thú y, Vắc-xin). Có thể để trống. |
| `warehouse_id` | BIGINT | FOREIGN KEY → `warehouse_categories.id`. Kho chứa hàng hóa; API yêu cầu chọn khi thêm/sửa. Bản ghi cũ chưa chọn kho được giữ NULL để bảo toàn dữ liệu khi nâng cấp. |
| `created_at` | TIMESTAMP | Thời điểm tạo đầy đủ giờ/phút/giây; ẩn trên UI nhưng giữ trong database và API. Không đổi khi sửa tên hàng hóa. |
| `updated_at` | TIMESTAMP | Hibernate tự ghi thời điểm cập nhật. |

API `GET /api/product-categories` và `GET /api/product-categories/{id}` dành cho tài khoản đăng nhập. `POST`, `PUT /{id}`, `DELETE /{id}` chỉ dành cho `ROLE_FARM_OWNER`. Danh sách sắp xếp theo `created_at`, rồi ID tăng dần. UI ẩn cột mã hàng hóa (`code`) và ngày tạo (`createdAt`), hiển thị: Tên hàng hóa, Quy cách, Nhãn hiệu, Loại hàng hóa, Kho lưu trữ, Mô tả.

`itemCount` được tính từ số bản ghi `inventory_items` có `product_id` tương ứng; không lưu số đếm giả hoặc nhập thủ công. Chặn xóa tên hàng hóa hoặc chuyển sang kho khác khi đã được hàng hóa thực tế sử dụng. Không tự thêm dữ liệu mẫu. Khởi động backend với `spring.jpa.hibernate.ddl-auto=update` để tạo hoặc cập nhật bảng.

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

API: `GET /api/warehouse-categories` và `GET /api/warehouse-categories/{id}` cho người dùng đăng nhập. `POST`, `PUT /{id}` và `DELETE /{id}` chỉ cho `ROLE_FARM_OWNER`. Xóa bản ghi sau khi người dùng xác nhận. `itemCount` đếm số bản ghi `inventory_items` thuộc kho, không phải tổng tồn kho và không nhập tay. Kho có Tên hàng hóa hoặc hàng hóa thực tế liên quan không được xóa.

Với `spring.jpa.hibernate.ddl-auto=update`, Hibernate tạo bảng khi khởi động lại backend. Không tự thêm các bản ghi mẫu hoặc số lượng mẫu trong ảnh.

## Bảng `brands` — Nhãn hiệu

Entity `Brand` lưu thương hiệu / nhãn hiệu đối tác tại **Thiết lập danh mục → Nhãn hiệu**.

| Trường | Kiểu dữ liệu | Ràng buộc / Ý nghĩa |
| :--- | :--- | :--- |
| `id` | BIGINT | PRIMARY KEY, tự tăng. API sinh mã hiển thị `NH000001` từ ID bắt đầu bằng chữ `NH` + số thứ tự (ẩn trên UI, giữ trong API response). |
| `name` | VARCHAR(150) | NOT NULL. Tên nhãn hiệu, bắt buộc nhập. |
| `name_key` | VARCHAR(150) | NOT NULL, UNIQUE. Tên chuẩn hóa Unicode NFC, bỏ khoảng trắng đầu/cuối và chuyển chữ thường để ngăn trùng tên. |
| `product_type` | VARCHAR(150) | Loại hàng hóa / lĩnh vực sản phẩm (VD: Con giống & Cám, Thức ăn chăn nuôi, Thuốc thú y...). |
| `quantity` | INTEGER | NOT NULL, DEFAULT 0. Số lượng mặt hàng / sản phẩm thuộc nhãn hiệu; không được nhỏ hơn 0. |
| `note` | VARCHAR(1000) | Ghi chú về nhãn hiệu, có thể để trống. |
| `created_at` | TIMESTAMP | Thời điểm tạo; ẩn trên UI nhưng lưu trong database và API. |
| `updated_at` | TIMESTAMP | Hibernate tự ghi thời điểm cập nhật. |

API `GET /api/brands` và `GET /api/brands/{id}` dành cho tài khoản đăng nhập. `POST`, `PUT /{id}`, `DELETE /{id}` chỉ dành cho `ROLE_FARM_OWNER`. Danh sách sắp xếp theo `created_at`, rồi ID tăng dần. UI hỗ trợ tìm kiếm, xem, thêm, sửa, xác nhận xóa và hiển thị: Tên nhãn hiệu, Loại hàng hóa, Số lượng, Ghi chú, Thao tác (ẩn mã nhãn hiệu). Khởi động backend với `spring.jpa.hibernate.ddl-auto=update` để tự động tạo bảng `brands`.

## Bảng `product_types` — Loại hàng hóa

Entity `ProductType` lưu danh mục tại **Thiết lập danh mục → Loại hàng hóa**.

| Trường | Kiểu dữ liệu | Ràng buộc / Ý nghĩa |
| :--- | :--- | :--- |
| `id` | BIGINT | PRIMARY KEY, tự tăng. |
| `code` | VARCHAR(50) | Mã loại hàng hóa (sinh theo định dạng `LH` + số thứ tự, ví dụ `LH000001`). Lưu trong database và trả về qua API, ẩn trên UI. |
| `name` | VARCHAR(150) | NOT NULL. Tên loại hàng, bắt buộc nhập. |
| `name_key` | VARCHAR(150) | NOT NULL, UNIQUE. Tên chuẩn hóa Unicode NFC, bỏ khoảng trắng đầu/cuối và chuyển chữ thường để ngăn trùng tên. |
| `description` | VARCHAR(1000) | Mô tả chi tiết loại hàng, có thể để trống. |
| `quantity` | INTEGER | NOT NULL, DEFAULT 0. Số lượng mặt hàng / sản phẩm thuộc loại hàng; không được nhỏ hơn 0. |
| `created_at` | TIMESTAMP | Thời điểm tạo; hiển thị trên UI dạng `dd/mm/yyyy`. |
| `updated_at` | TIMESTAMP | Hibernate tự ghi thời điểm cập nhật. |

API `GET /api/product-types` và `GET /api/product-types/{id}` dành cho tài khoản đăng nhập. `POST`, `PUT /{id}`, `DELETE /{id}` chỉ dành cho `ROLE_FARM_OWNER`. Danh sách sắp xếp theo `created_at`, rồi ID tăng dần. UI hỗ trợ tìm kiếm, xem, thêm, sửa, xác nhận xóa và hiển thị các cột: Tên loại hàng, Mô tả, Số lượng, Ngày tạo, Thao tác (ẩn mã loại hàng hóa). Khởi động backend với `spring.jpa.hibernate.ddl-auto=update` để tự động tạo bảng `product_types`.

## Bảng `specifications` — Đơn vị quy cách

Entity `Specification` lưu danh mục tại **Thiết lập danh mục → Đơn vị quy cách** và phục vụ danh sách chọn khi tạo / sửa tên hàng hóa.

| Trường | Kiểu dữ liệu | Ràng buộc / Ý nghĩa |
| :--- | :--- | :--- |
| `id` | BIGINT | PRIMARY KEY, tự tăng. |
| `name` | VARCHAR(150) | NOT NULL. Tên quy cách đóng gói (VD: Bao 25kg, Chai 1L, Thùng 102 con...), bắt buộc nhập. |
| `name_key` | VARCHAR(150) | NOT NULL, UNIQUE. Tên chuẩn hóa Unicode NFC, bỏ khoảng trắng đầu/cuối và chuyển chữ thường để ngăn trùng tên. |
| `unit` | VARCHAR(150) | Đơn vị lớn (VD: Bao, Thùng, Hộp, Chai...). |
| `items` | VARCHAR(150) | Giá trị quy đổi / đóng gói (VD: 25 kg, 102 con, 10 lọ...). |
| `note` | VARCHAR(1000) | Mô tả chi tiết quy cách, có thể để trống. |
| `created_at` | TIMESTAMP | Thời điểm tạo bản ghi. |
| `updated_at` | TIMESTAMP | Hibernate tự ghi thời điểm cập nhật. |

API: `GET /api/specifications` và `GET /api/specifications/{id}` dành cho tài khoản đăng nhập. `POST`, `PUT /{id}`, `DELETE /{id}` chỉ dành cho `ROLE_FARM_OWNER`. Danh sách sắp xếp theo `created_at`, rồi ID tăng dần. Khởi động backend với `spring.jpa.hibernate.ddl-auto=update` để tự động tạo bảng `specifications`.

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

Tên hàng hóa trong form Kho hàng hóa được nhập trực tiếp (tối đa 150 ký tự). API nhận `name` thay cho `productId`, dùng lại tên đã có trong cùng kho hoặc lưu tên mới vào `product_categories` và liên kết `inventory_items.product_id`. Không bổ sung bảng mới.
