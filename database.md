# Tài liệu Đặc tả Cơ sở Dữ liệu (Database Schema) - FarmShift

Tài liệu này mô tả cấu trúc các bảng trong cơ sở dữ liệu của dự án FarmShift, bao gồm kiểu dữ liệu, ràng buộc và ý nghĩa của từng trường được suy luận tự động.

Quy ước: mỗi thay đổi về bảng hoặc cột phải được ghi lại trong tài liệu này, còn dữ liệu mẫu tương ứng được thêm vào `insert_data.txt`. File `insert_data.txt` dùng `ON CONFLICT DO NOTHING` nên chạy lại nhiều lần vẫn an toàn; chạy file sau khi backend đã khởi động ít nhất một lần để Hibernate tạo bảng.

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

Chưa có entity chi tiết tồn kho từng đợt nhập nên `itemCount` hiện là `0`, không lưu số lượng giả hoặc nhập thủ công. Khi có entity chi tiết hàng hóa, cần liên kết khóa ngoại, đếm mặt hàng và chặn xóa khi đang được sử dụng. Không tự thêm dữ liệu mẫu. Khởi động backend với `spring.jpa.hibernate.ddl-auto=update` để tạo hoặc cập nhật bảng.

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

## Bảng `farm_areas` — Khu nuôi

Entity: `FarmArea`. Lưu các khu nuôi tại **Khu nuôi** (`/areas`). Mỗi khu chứa nhiều chuồng (bảng `barns`).

| Tên trường | Kiểu dữ liệu | Ràng buộc / Ý nghĩa |
| :--- | :--- | :--- |
| `id` | BIGINT | PRIMARY KEY, tự tăng. API sinh mã hiển thị `KN000001` từ ID. |
| `name` | VARCHAR(150) | NOT NULL. Tên khu nuôi; khoảng trắng thừa được gộp lại khi lưu. |
| `name_key` | VARCHAR(150) | NOT NULL, UNIQUE. Tên chuẩn hóa NFC, chữ thường để chặn trùng tên không phân biệt hoa thường. |
| `environment_metrics` | VARCHAR(200) | Chỉ số môi trường cần theo dõi, các mã ngăn cách bởi dấu phẩy: `HUMIDITY`, `TEMPERATURE`. |
| `animal_metrics` | VARCHAR(200) | Chỉ số vật nuôi cần theo dõi: `WEIGHT`, `LOSS`, `MANURE`, `ANIMAL_PHOTO`, `DEAD_PHOTO`, `NOTE`. |
| `description` | VARCHAR(1000) | Ghi chú / mô tả khu nuôi. |
| `created_at` | TIMESTAMP | Hibernate tự ghi thời điểm tạo. |
| `updated_at` | TIMESTAMP | Hibernate tự ghi thời điểm cập nhật. |

API trả thêm các số liệu tính từ bảng `barns`, không lưu cột riêng: `barnCount` (số chuồng), `activeBarnCount` (chuồng đang hoạt động), `animalCount` (tổng số con), `totalCapacity` (tổng sức chứa).

API: `GET /api/farm-areas`, `GET /api/farm-areas/{id}` cho mọi tài khoản đã đăng nhập; `POST`, `PUT /{id}`, `DELETE /{id}` chỉ cho `ROLE_FARM_OWNER`. Không xóa được khu nuôi còn chuồng (409 `FARM_AREA_HAS_BARNS`); trùng tên trả 409 `FARM_AREA_DUPLICATE`.

Hệ thống chỉ quản lý gà thịt nên khu nuôi **không có** cột loại vật nuôi; số cữ ăn trong ngày cũng không khai báo ở khu nuôi vì phụ thuộc chương trình nuôi theo giống của từng đàn trong chuồng (xem `farming_programs`). Hai cột cũ `livestock_type` và `meals_per_day` đã bị bỏ: `insert_data.txt` (mục 4) chạy `ALTER TABLE farm_areas DROP COLUMN IF EXISTS ...` để xóa chúng khỏi database đã tạo trước đây, vì `ddl-auto=update` không tự xóa cột.

Dữ liệu mẫu: mục 4 trong `insert_data.txt` thêm 4 khu nuôi gà thịt `Khu Mía Thịt`, `Khu J Thịt`, `Khu đông tảo`, `Khu A`. Khi thêm bằng SQL phải tự điền `name_key` (tên viết thường).

## Bảng `barns` — Chuồng nuôi

Entity: `Barn`. Lưu chuồng thuộc một khu nuôi, xem tại **Khu nuôi → Tất cả** (`/barns`) hoặc trang chuồng của từng khu (`/areas/{id}`).

| Tên trường | Kiểu dữ liệu | Ràng buộc / Ý nghĩa |
| :--- | :--- | :--- |
| `id` | BIGINT | PRIMARY KEY, tự tăng. API sinh mã hiển thị `CH000001` từ ID. |
| `area_id` | BIGINT | NOT NULL, FOREIGN KEY → `farm_areas(id)`. Đổi được khi chuyển chuồng sang khu khác. |
| `name` | VARCHAR(100) | NOT NULL. Tên chuồng, ví dụ `Nhà A1`. |
| `name_key` | VARCHAR(100) | NOT NULL. Tên chuẩn hóa; UNIQUE cùng `area_id` (`uk_barns_area_name`): hai khu khác nhau được trùng tên chuồng. |
| `status` | VARCHAR(20) | NOT NULL. `INACTIVE` (Chưa hoạt động) hoặc `ACTIVE` (Đang hoạt động). Hệ thống tự quản, không có trong form: chuồng mới là `INACTIVE`, khai báo lứa nuôi chuyển sang `ACTIVE`, kết thúc lứa chuyển về `INACTIVE`. |
| `capacity` | INT | NOT NULL, từ 1 đến 10.000.000. Sức chứa tối đa (con). |
| `current_quantity` | INT | NOT NULL, ≥ 0 và ≤ `capacity`. Tổng tồn các đàn của lứa đang nuôi; không nhập tay, chỉ thay đổi qua nhập đàn, chuyển đàn, hao hụt, loại thải, xuất bán. |
| `area_m2` | NUMERIC(10,2) | Diện tích chuồng (m²), > 0, có thể để trống. Dùng để tính mật độ nuôi (con/m²). |
| `target_weight` | NUMERIC(5,2) | Mục tiêu cân nặng xuất chuồng (kg/con), 0–999, có thể để trống. |
| `description` | VARCHAR(1000) | Ghi chú chuồng. |
| `created_at` | TIMESTAMP | Hibernate tự ghi thời điểm tạo. |
| `updated_at` | TIMESTAMP | Hibernate tự ghi thời điểm cập nhật. |

Quy tắc nghiệp vụ (kiểm tra ở cả backend và form): khi tạo chuồng phải khai báo sức chứa tối đa; form gợi ý sức chứa = diện tích × 8 con/m² (mật độ khuyến nghị cho gà thịt) và cảnh báo khi mật độ vượt mức này, người dùng vẫn được nhập số khác; sức chứa không nhỏ hơn số con đang nuôi (`BARN_CAPACITY_BELOW_STOCK`); chuồng đang có lứa nuôi không chuyển khu (`BARN_ACTIVE_CYCLE_MOVE`); sửa chuồng không đổi trạng thái; không xóa chuồng còn vật nuôi (409 `BARN_NOT_EMPTY`) hoặc đã có lịch sử lứa nuôi (409 `BARN_HAS_CYCLES`, để giữ số liệu các lứa đã nuôi); trùng tên trong cùng khu trả 409 `BARN_DUPLICATE`. API trả thêm `activeCycleId` (lứa đang nuôi, null nếu chưa có). Mọi chuồng đều dùng để nuôi gà thịt nên không có cột mục đích sử dụng; cột cũ `purpose` được `insert_data.txt` (mục 5) xóa bằng `ALTER TABLE barns DROP COLUMN IF EXISTS purpose`.

API: `GET /api/barns` (lọc theo khu bằng `?areaId=`), `GET /api/barns/{id}` cho mọi tài khoản đã đăng nhập; `POST`, `PUT /{id}`, `DELETE /{id}` chỉ cho `ROLE_FARM_OWNER`. Giao diện ẩn nút thêm/sửa/xóa và hiện thông báo chế độ chỉ đọc với kế toán và công nhân.

Dữ liệu mẫu: mục 5 trong `insert_data.txt` thêm `Nhà A1`–`Nhà A3` (sức chứa 50.000, đang nuôi 50.000 / 40.000 / 30.000) vào `Khu Mía Thịt` và `Nhà B1`, `Nhà B2` (sức chứa 80.000, đang nuôi 50.000) vào `Khu J Thịt`. Chuồng được gắn vào khu theo `name_key` của khu nên không phụ thuộc ID tự tăng. Mục 6 điền diện tích (1.000 m² cho Nhà A1–A3, 1.600 m² cho Nhà B1, B2); số con của chuồng được tính lại từ các đàn ở mục 8.

## Bảng `farming_cycles` — Lứa nuôi

Entity: `FarmingCycle`. Một đợt nuôi trong một chuồng, từ lúc khai báo đến khi xuất hết đàn. Xem tại trang chi tiết chuồng (`/barns/{id}`).

| Tên trường | Kiểu dữ liệu | Ràng buộc / Ý nghĩa |
| :--- | :--- | :--- |
| `id` | BIGINT | PRIMARY KEY, tự tăng. API sinh mã `L000001`. |
| `barn_id` | BIGINT | NOT NULL, FOREIGN KEY → `barns(id)`. |
| `cycle_number` | INT | NOT NULL. Lứa thứ mấy của chuồng (1, 2, 3...); UNIQUE cùng `barn_id` (`uk_cycles_barn_number`). |
| `start_date` | DATE | NOT NULL. Ngày bắt đầu lứa, không sau hôm nay. |
| `hatch_date` | DATE | Ngày nở (ngày tuổi 1), không sau ngày bắt đầu. Để trống thì tính ngày tuổi theo đàn nhập đầu tiên. |
| `end_date` | DATE | Ngày kết thúc lứa. |
| `status` | VARCHAR(20) | NOT NULL. `ACTIVE` (đang nuôi) hoặc `CLOSED` (đã kết thúc). |
| `note` | VARCHAR(1000) | Ghi chú. |
| `created_at`, `updated_at` | TIMESTAMP | Hibernate tự ghi. |

Quy tắc: chỉ khai báo lứa cho chuồng chưa có lứa đang nuôi (409 `CYCLE_ALREADY_ACTIVE`); khai báo lứa chuyển chuồng sang Đang hoạt động. Chỉ kết thúc lứa khi tồn đàn bằng 0 (409 `CYCLE_HAS_ANIMALS`); ngày kết thúc từ ngày bắt đầu đến hôm nay và không trước ghi nhận cuối cùng (`CYCLE_END_DATE`); kết thúc lứa chuyển chuồng về Chưa hoạt động. Lứa đã kết thúc chỉ xem được (409 `CYCLE_CLOSED`). Mọi ngày ghi nhận phải trong khoảng từ ngày bắt đầu lứa đến hôm nay (`CYCLE_DATE_OUT_OF_RANGE`).

API: `GET /api/barns/{barnId}/cycles` (lịch sử lứa), `POST /api/barns/{barnId}/cycles` (chủ trại), `GET /api/cycles/{id}` (toàn bộ dữ liệu trang chi tiết kèm chỉ số kỹ thuật), `POST /api/cycles/{id}/close` (chủ trại).

Chỉ số kỹ thuật (tính khi đọc, không lưu cột): ngày nuôi; ngày tuổi; tổng nhập; tổng đàn; số chết, loại thải, xuất bán và tỷ lệ % trên tổng nhập; cân nặng TB (lần cân mẫu gần nhất, nếu chưa cân thì lấy trọng lượng lúc nhập); sản lượng ước tính = tổng đàn × cân nặng TB; mật độ = tổng đàn / diện tích chuồng; khối lượng tăng = sản lượng ước tính + khối lượng đã ra khỏi chuồng (xuất bán, loại thải, chuyển đi) − khối lượng lúc vào; **FCR = tổng cám (kg) / khối lượng tăng**.

Hạch toán (chỉ chủ trại và kế toán): chi phí con giống (theo giá vốn từng đàn, chuyển đi/đến theo tỷ lệ số con) + cám + khoản chi bổ sung; chi phí/kg = tổng chi phí / (sản lượng ước tính + khối lượng đã xuất bán); chi phí/con = tổng chi phí / tổng đàn; doanh thu = Σ khối lượng xuất bán × đơn giá; lợi nhuận = doanh thu − chi phí.

## Bảng `flocks` — Đàn

Entity: `Flock`. Một lô vật nuôi nhập (hoặc tách/chuyển) vào lứa. API sinh mã `H0001`.

| Tên trường | Kiểu dữ liệu | Ràng buộc / Ý nghĩa |
| :--- | :--- | :--- |
| `id` | BIGINT | PRIMARY KEY, tự tăng. |
| `cycle_id` | BIGINT | NOT NULL, FOREIGN KEY → `farming_cycles(id)`. |
| `name` | VARCHAR(150) | NOT NULL. Tên đàn / giống, ví dụ `MÍA-DABACO TRỐNG`. |
| `gender` | VARCHAR(20) | NOT NULL. `MALE` (Trống), `FEMALE` (Mái), `MIXED` (Xô - trống mái lẫn). |
| `source_type` | VARCHAR(20) | NOT NULL. `PURCHASE` (nhập con giống) hoặc `TRANSFER` (tách/chuyển từ chuồng khác). |
| `source_note` | VARCHAR(200) | Nguồn nhập (mặc định `Khác`) hoặc `Chuyển từ <chuồng> (<mã đàn>)`. |
| `source_flock_id` | BIGINT | FOREIGN KEY → `flocks(id)`. Đàn nguồn khi chuyển đàn. |
| `program_id` | BIGINT | FOREIGN KEY → `farming_programs(id)`. Chương trình nuôi (giống) chọn khi nhập đàn (bắt buộc khi nhập mới); đàn chuyển đến giữ chương trình của đàn nguồn. |
| `import_date` | DATE | NOT NULL. Ngày nhập / ngày chuyển đến. |
| `age_at_import` | INT | NOT NULL, 1–365. Ngày tuổi lúc nhập; ngày tuổi hiện tại = `age_at_import` + số ngày từ `import_date`. Đàn chuyển đến giữ nguyên ngày tuổi của đàn nguồn. |
| `import_quantity` | INT | NOT NULL, ≥ 1. Số con nhập. |
| `import_avg_weight` | NUMERIC(8,3) | NOT NULL. Trọng lượng TB lúc nhập (kg/con). |
| `unit_price` | NUMERIC(14,2) | NOT NULL, ≥ 0. Giá vốn con giống (đ/con). Đàn chuyển đến mang theo giá vốn của đàn nguồn. Ẩn với công nhân. |
| `quantity` | INT | NOT NULL. Tồn hiện tại. |
| `status` | VARCHAR(20) | NOT NULL. `ACTIVE` hoặc `ARCHIVED` (tự chuyển khi tồn bằng 0, hiện ở tab Lưu trữ). |
| `note` | VARCHAR(1000) | Ghi chú. |
| `created_at`, `updated_at` | TIMESTAMP | Hibernate tự ghi. |

Quy tắc nhập đàn (`POST /api/cycles/{id}/flocks`, chủ trại): lứa đang nuôi; bắt buộc chọn giới tính trống / mái / xô; **các đàn nhập của một lứa cách nhau không quá 3 ngày** tính từ đàn nhập đầu tiên (`FLOCK_IMPORT_WINDOW`, nếu quá phải khai báo lứa mới); tổng tồn sau khi nhập không vượt sức chứa chuồng (`FLOCK_OVER_CAPACITY`).

Quy tắc chuyển đàn (`POST /api/flocks/{id}/transfer`, chủ trại): chuồng đích khác chuồng nguồn (`TRANSFER_SAME_BARN`), đang có lứa nuôi (`TRANSFER_TARGET_NO_CYCLE`), cùng loại vật nuôi (`TRANSFER_LIVESTOCK_MISMATCH`) và còn đủ chỗ (`FLOCK_OVER_CAPACITY`); số con không vượt tồn (`FLOCK_INSUFFICIENT`); tạo đàn mới `TRANSFER` ở lứa đích. Đàn chuyển đến không tính vào cửa sổ 3 ngày nhập đàn. Không ghi biến động trước ngày nhập đàn (`FLOCK_DATE_BEFORE_IMPORT`) hoặc lên đàn đã lưu trữ (`FLOCK_ARCHIVED`).

## Bảng `flock_movements` — Biến động đàn

Entity: `FlockMovement`. Nhật ký mọi thay đổi số con, không sửa/xóa để giữ dấu vết.

| Tên trường | Kiểu dữ liệu | Ràng buộc / Ý nghĩa |
| :--- | :--- | :--- |
| `id` | BIGINT | PRIMARY KEY, tự tăng. |
| `flock_id` | BIGINT | NOT NULL, FOREIGN KEY → `flocks(id)`. |
| `type` | VARCHAR(20) | NOT NULL. `IMPORT`, `TRANSFER_IN`, `TRANSFER_OUT`, `DEATH` (hao hụt), `CULL` (loại thải), `HARVEST` (xuất bán). |
| `movement_date` | DATE | NOT NULL. |
| `quantity` | INT | NOT NULL, ≥ 1. |
| `weight_kg` | NUMERIC(14,3) | Tổng khối lượng (kg). Bắt buộc với xuất bán; nhập và chuyển đàn tự tính = số con × trọng lượng TB. |
| `unit_price` | NUMERIC(14,2) | Đơn giá bán (đ/kg), chỉ với xuất bán. |
| `related_flock_id` | BIGINT | FOREIGN KEY → `flocks(id)`. Đàn đối ứng khi chuyển đàn. |
| `note` | VARCHAR(1000) | Ghi chú / nguyên nhân. |
| `created_by` | VARCHAR(150) | Email người ghi. |
| `created_at` | TIMESTAMP | Hibernate tự ghi. |

API: `POST /api/flocks/{id}/losses` ghi chết / loại thải (chủ trại, công nhân; `type` chỉ nhận `DEATH`, `CULL`, khác trả `FLOCK_LOSS_TYPE`); `POST /api/flocks/{id}/harvests` ghi xuất bán (chủ trại, kế toán).

## Bảng `feed_records` — Nhật ký cám

Entity: `FeedRecord`. Các cột: `id`, `cycle_id` (FK → `farming_cycles`), `record_date` (DATE, NOT NULL), `feed_name` (VARCHAR(150), NOT NULL), `quantity_kg` (NUMERIC(14,3), > 0), `unit_price` (NUMERIC(14,2), ≥ 0, đ/kg), `note`, `created_by`, `created_at`. Dùng để tính FCR và chi phí cám. API: `POST /api/cycles/{id}/feed-records` (chủ trại, công nhân), `DELETE /api/cycles/{id}/feed-records/{recordId}` (chủ trại).

## Bảng `weight_samples` — Thông số vật nuôi (cân mẫu)

Entity: `WeightSample`. Các cột: `id`, `cycle_id` (FK), `sample_date` (DATE, NOT NULL), `avg_weight_kg` (NUMERIC(8,3), > 0), `sample_size` (INT, số con cân, có thể trống), `note`, `created_by`, `created_at`. Lần cân gần nhất là cân nặng TB của lứa. API: `POST /api/cycles/{id}/weight-samples` (chủ trại, công nhân), `DELETE /api/cycles/{id}/weight-samples/{sampleId}` (chủ trại).

## Bảng `cycle_expenses` — Khoản chi bổ sung

Entity: `CycleExpense`. Các cột: `id`, `cycle_id` (FK), `expense_date` (DATE, NOT NULL), `category` (VARCHAR(20): `ELECTRICITY` tiền điện, `WATER` tiền nước, `LABOR` công nhân, `MEDICINE` thuốc & vắc-xin, `OTHER` chi phí khác), `amount` (NUMERIC(16,2), > 0), `note`, `created_by`, `created_at`. API: `POST` / `DELETE /api/cycles/{id}/expenses[/{expenseId}]` (chủ trại, kế toán). Công nhân không xem được khoản chi.

## Bảng `farming_programs`, `farming_program_steps` — Chương trình nuôi theo giống

Xem / tạo / sửa tại **Thiết lập chăn nuôi → Chương trình nuôi**. Mỗi chương trình dành cho một giống gà (ví dụ Gà ta thả vườn 105 ngày, xuất chuồng 1,5–2,2 kg) và quy định theo ngày tuổi: cám định mức, lịch vắc-xin, thuốc trộn, nhiệt độ chuồng, công việc chăm sóc. Khi nhập đàn, chủ trại chọn chương trình cho đàn; trang chi tiết chuồng dùng chương trình và ngày tuổi của từng đàn để lập **Kế hoạch hôm nay** (cơ sở để công nhân đánh dấu hoàn thành công việc hằng ngày ở bước sau).

`farming_programs` (entity `FarmingProgram`, mã `CT0001`):

| Tên trường | Kiểu dữ liệu | Ràng buộc / Ý nghĩa |
| :--- | :--- | :--- |
| `id` | BIGINT | PRIMARY KEY, tự tăng. |
| `name` | VARCHAR(150) | NOT NULL. Tên chương trình. |
| `name_key` | VARCHAR(150) | NOT NULL, UNIQUE. Tên chuẩn hóa chữ thường, chặn trùng tên (409 `PROGRAM_DUPLICATE`). |
| `breed` | VARCHAR(100) | NOT NULL. Giống gà, ví dụ `Gà ta`, `Gà Mía`, `Gà J-Dabaco`. |
| `duration_days` | INT | NOT NULL, 1–365. Thời gian nuôi (ngày tuổi xuất chuồng). Mọi nội dung phải nằm trong khoảng này (`PROGRAM_STEP_OUT_OF_DURATION`). |
| `target_weight_min`, `target_weight_max` | NUMERIC(5,2) | Cân xuất chuồng mục tiêu (kg/con), có thể trống; min ≤ max (`PROGRAM_WEIGHT_RANGE`). |
| `description` | VARCHAR(1000) | Mô tả. |
| `created_at`, `updated_at` | TIMESTAMP | Hibernate tự ghi. |

`farming_program_steps` (entity `FarmingProgramStep`): mỗi dòng là một nội dung áp dụng từ ngày tuổi `day_from` đến `day_to`.

| Tên trường | Kiểu dữ liệu | Ràng buộc / Ý nghĩa |
| :--- | :--- | :--- |
| `id` | BIGINT | PRIMARY KEY, tự tăng. |
| `program_id` | BIGINT | NOT NULL, FOREIGN KEY → `farming_programs(id)`; xóa chương trình xóa luôn các dòng. |
| `category` | VARCHAR(20) | NOT NULL. `FEED` cám định mức, `VACCINE` vắc-xin, `MEDICINE` thuốc trộn, `TEMPERATURE` nhiệt độ, `WORK` công việc. |
| `name` | VARCHAR(200) | NOT NULL. Loại cám / tên vắc-xin / tên thuốc / giai đoạn nhiệt độ / tên công việc. |
| `day_from`, `day_to` | INT | NOT NULL, 1–365, `day_from` ≤ `day_to` (`PROGRAM_STEP_RANGE`). |
| `quantity` | NUMERIC(14,3) | FEED: g/con/ngày (bắt buộc > 0); VACCINE: liều (tùy chọn); MEDICINE: liều lượng (bắt buộc > 0). |
| `unit` | VARCHAR(50) | FEED luôn là `g/con/ngày`; VACCINE ví dụ `liều/con`, `giọt/con`; MEDICINE bắt buộc, ví dụ `g/kg cám`, `ml/lít nước`. |
| `meals_per_day` | INT | FEED: số cữ ăn trong ngày, 1–8 (bắt buộc). |
| `method` | VARCHAR(20) | VACCINE: `EYE_NOSE` nhỏ mắt mũi, `MOUTH` nhỏ miệng, `DRINKING_WATER` pha nước uống, `INJECTION` tiêm, `WING_WEB` chủng màng cánh. MEDICINE: `MIX_FEED` trộn cám, `MIX_WATER` pha nước uống. Sai nhóm hoặc thiếu trả `PROGRAM_METHOD_REQUIRED`. |
| `temp_min`, `temp_max` | NUMERIC(4,1) | TEMPERATURE: nhiệt độ chuồng °C (10–45), `temp_min` < `temp_max` (`PROGRAM_TEMPERATURE_RANGE`). |
| `note` | VARCHAR(1000) | Ghi chú cách làm. |

Quy tắc: chương trình phải có ít nhất một mức cám (`PROGRAM_FEED_REQUIRED`); các mức cám không chồng ngày nhau (`PROGRAM_FEED_OVERLAP`), các mức nhiệt độ không chồng ngày nhau (`PROGRAM_TEMPERATURE_OVERLAP`) — mỗi ngày tuổi chỉ có một khẩu phần và một khoảng nhiệt; FEED thiếu định mức hoặc số cữ trả `PROGRAM_FEED_INCOMPLETE`, MEDICINE thiếu liều hoặc đơn vị trả `PROGRAM_MEDICINE_DOSE`. Cột không thuộc nhóm của dòng được bỏ trống khi lưu. Kế hoạch hôm nay: cám = `quantity` × số con của đàn ÷ 1000 (kg/ngày), chia cho `meals_per_day` ra kg mỗi cữ.

API: `GET /api/farming-programs`, `GET /api/farming-programs/{id}` (mọi tài khoản, trả thêm `activeFlockCount` số đàn đang nuôi theo chương trình); `POST`, `PUT /{id}` (thay toàn bộ nội dung), `DELETE /{id}` (chủ trại; không xóa chương trình đã dùng cho đàn - 409 `PROGRAM_IN_USE`). `GET /api/cycles/{id}` trả `programs` (các chương trình của đàn trong lứa, mỗi nội dung có `state` `DONE` / `IN_PROGRESS` / `UPCOMING` theo ngày tuổi) và `todayPlan` (kế hoạch hôm nay của từng đàn đang nuôi).

Mô hình cũ (chương trình theo loại `type` gắn vào lứa qua bảng `cycle_programs`) đã bỏ; `insert_data.txt` (mục 9) chạy `DROP TABLE IF EXISTS cycle_programs` và `ALTER TABLE farming_programs DROP COLUMN IF EXISTS type`.

Dữ liệu mẫu: mục 7 trong `insert_data.txt` khai báo lứa thứ 1 (bắt đầu 01/10/2026) cho Nhà A1–A3, B1, B2; mục 8 nhập các đàn (Nhà A3: `MÍA-DABACO TRỐNG` 20.000 con × 11.000đ và `MÍA-DABACO MÁI` 10.000 con × 11.500đ = 335.000.000đ) kèm biến động `IMPORT`, rồi tính lại `barns.current_quantity`; mục 9 thêm 3 chương trình theo giống (`Gà ta thả vườn` 105 ngày đầy đủ cám 7 giai đoạn, 8 mũi vắc-xin, 5 đợt thuốc, 5 mức nhiệt, 3 công việc; `Gà Mía thương phẩm` 90 ngày; `Gà J-Dabaco thương phẩm` 75 ngày) và gắn chương trình cho các đàn mẫu theo tên giống.

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

## Bảng `transfer_categories` — Danh mục phiếu xuất nhập nội bộ

- `id`: khóa chính tự tăng; `code`: mã tự sinh DM + UUID, duy nhất, không đổi, chỉ lưu trong DB, không hiển thị hoặc nhập trên UI.
- `slip_type`: chuỗi nhập tay, bắt buộc, tối đa 150 ký tự. Không giới hạn enum. Khi nâng cấp PostgreSQL, TransferCategorySchemaUpgrade tự gỡ CHECK enum cũ; Hibernate ddl-auto=update mở rộng cột. Giá trị enum đã lưu vẫn được hiển thị bằng nhãn tiếng Việt trên UI.
- `name` (150 ký tự), `name_key`: tên chuẩn hóa NFC, không phân biệt hoa thường. Ràng buộc duy nhất theo cặp loại phiếu/tên.
- `description`: mô tả tối đa 1000 ký tự.
- `created_at`, `updated_at`: timestamp; ngày tạo do server quản lý, UI hiển thị ngày/tháng/năm.

API `/api/transfer-categories`: GET danh sách, GET /{id} chi tiết; POST, PUT /{id}, DELETE /{id} chỉ cho ROLE_FARM_OWNER. Không thêm dữ liệu mẫu. Khởi động lại backend với ddl-auto=update để tạo bảng.

`slipCount` là trường chỉ đọc, hiện trả 0: phiếu xuất nhập hiện mới nằm ở state frontend, chưa có bảng phiếu để đếm quan hệ. Khi triển khai lưu phiếu cần thêm khóa ngoại đến bảng này, đếm số phiếu thực tế và chặn xóa danh mục đã được sử dụng. CRUD danh mục đã lưu thật trong database; không dùng số đếm từ dữ liệu mẫu.
