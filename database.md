# Tài liệu Đặc tả Cơ sở Dữ liệu (Database Schema) - FarmShift

Tài liệu này mô tả cấu trúc các bảng trong cơ sở dữ liệu của dự án FarmShift, bao gồm kiểu dữ liệu, ràng buộc và ý nghĩa của từng trường được suy luận tự động.

Quy ước: mỗi thay đổi về bảng hoặc cột phải được ghi lại trong tài liệu này, còn dữ liệu mẫu tương ứng được thêm vào `insert_data.txt`. File `insert_data.txt` dùng `ON CONFLICT DO NOTHING` nên chạy lại nhiều lần vẫn an toàn; chạy file sau khi backend đã khởi động ít nhất một lần để Hibernate tạo bảng.

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
| `status` | VARCHAR(20) | NOT NULL. `INACTIVE` (Chưa hoạt động), `ACTIVE` (Đang hoạt động), `CLOSED` (Đã đóng). |
| `capacity` | INT | NOT NULL, từ 1 đến 10.000.000. Sức chứa tối đa (con). |
| `current_quantity` | INT | NOT NULL, ≥ 0 và ≤ `capacity`. Tổng tồn các đàn của lứa đang nuôi; không nhập tay, chỉ thay đổi qua nhập đàn, chuyển đàn, hao hụt, loại thải, xuất bán. |
| `area_m2` | NUMERIC(10,2) | Diện tích chuồng (m²), > 0, có thể để trống. Dùng để tính mật độ nuôi (con/m²). |
| `target_weight` | NUMERIC(5,2) | Mục tiêu cân nặng xuất chuồng (kg/con), 0–999, có thể để trống. |
| `description` | VARCHAR(1000) | Ghi chú chuồng. |
| `created_at` | TIMESTAMP | Hibernate tự ghi thời điểm tạo. |
| `updated_at` | TIMESTAMP | Hibernate tự ghi thời điểm cập nhật. |

Quy tắc nghiệp vụ (kiểm tra ở cả backend và form): khi tạo chuồng phải khai báo sức chứa tối đa; form gợi ý sức chứa = diện tích × 8 con/m² (mật độ khuyến nghị cho gà thịt) và cảnh báo khi mật độ vượt mức này, người dùng vẫn được nhập số khác; sức chứa không nhỏ hơn số con đang nuôi (`BARN_CAPACITY_BELOW_STOCK`); chuồng đang có lứa nuôi phải giữ trạng thái Đang hoạt động (`BARN_ACTIVE_CYCLE_STATUS`) và không chuyển khu (`BARN_ACTIVE_CYCLE_MOVE`); không xóa chuồng còn vật nuôi (409 `BARN_NOT_EMPTY`) hoặc đã có lịch sử lứa nuôi (409 `BARN_HAS_CYCLES`, hãy chuyển sang Đã đóng); trùng tên trong cùng khu trả 409 `BARN_DUPLICATE`. API trả thêm `activeCycleId` (lứa đang nuôi, null nếu chưa có). Mọi chuồng đều dùng để nuôi gà thịt nên không có cột mục đích sử dụng; cột cũ `purpose` được `insert_data.txt` (mục 5) xóa bằng `ALTER TABLE barns DROP COLUMN IF EXISTS purpose`.

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

Quy tắc: chỉ khai báo lứa cho chuồng chưa đóng (`CYCLE_BARN_CLOSED`) và chưa có lứa đang nuôi (409 `CYCLE_ALREADY_ACTIVE`); khai báo lứa chuyển chuồng sang Đang hoạt động. Chỉ kết thúc lứa khi tồn đàn bằng 0 (409 `CYCLE_HAS_ANIMALS`); ngày kết thúc từ ngày bắt đầu đến hôm nay và không trước ghi nhận cuối cùng (`CYCLE_END_DATE`); kết thúc lứa chuyển chuồng về Chưa hoạt động. Lứa đã kết thúc chỉ xem được (409 `CYCLE_CLOSED`). Mọi ngày ghi nhận phải trong khoảng từ ngày bắt đầu lứa đến hôm nay (`CYCLE_DATE_OUT_OF_RANGE`).

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

## Bảng `farming_programs`, `farming_program_steps`, `cycle_programs` — Chương trình nuôi

`farming_programs` (entity `FarmingProgram`, mã `CT0001`): `id`, `name` (VARCHAR(150), NOT NULL), `name_key` (UNIQUE, chặn trùng tên - `PROGRAM_DUPLICATE`), `type` (`FEED` định mức cám, `HEALTH` phòng & chữa bệnh, `WORK` công việc), `description`, `created_at`, `updated_at`.

`farming_program_steps` (entity `FarmingProgramStep`): `id`, `program_id` (FK), `name` (VARCHAR(200)), `day_from`, `day_to` (INT 1–365, `day_from` ≤ `day_to` - `PROGRAM_STEP_RANGE`), `quantity` (NUMERIC(14,3), định mức, có thể trống), `unit` (VARCHAR(50), ví dụ `g/con/ngày`, `liều/con`), `note`. Mỗi chương trình cần ít nhất một nội dung.

`cycle_programs` (entity `CycleProgram`): `id`, `cycle_id` (FK), `program_id` (FK), `created_at`; UNIQUE (`cycle_id`, `program_id`) - `uk_cycle_programs` (409 `PROGRAM_ALREADY_ATTACHED`). Trang chi tiết đánh dấu từng nội dung `DONE` (đã qua), `IN_PROGRESS` (đang áp dụng), `UPCOMING` (sắp tới) theo ngày tuổi hiện tại của lứa.

API: `GET /api/farming-programs`, `GET /api/farming-programs/{id}` (mọi tài khoản); `POST`, `PUT /{id}`, `DELETE /{id}` (chủ trại; không xóa chương trình đã áp dụng cho lứa - 409 `PROGRAM_IN_USE`); `POST /api/cycles/{id}/programs`, `DELETE /api/cycles/{id}/programs/{programId}` (chủ trại).

Dữ liệu mẫu: mục 7 trong `insert_data.txt` khai báo lứa thứ 1 (bắt đầu 01/10/2026) cho Nhà A1–A3, B1, B2; mục 8 nhập các đàn (Nhà A3: `MÍA-DABACO TRỐNG` 20.000 con × 11.000đ và `MÍA-DABACO MÁI` 10.000 con × 11.500đ = 335.000.000đ) kèm biến động `IMPORT`, rồi tính lại `barns.current_quantity`; mục 9 thêm 3 chương trình nuôi mẫu và áp dụng `Lịch vắc-xin gà thịt`, `Định mức cám gà thịt` cho lứa của Nhà A3.

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
