# ERD — Main Entities and Relationships

Tài liệu giải thích các entity trong ERD luồng chính đã trao đổi, bao gồm Account và WorkTask. Tên entity và hành động dùng tiếng Anh, phần giải thích dùng tiếng Việt. Các quan hệ được đối chiếu với mapping JPA trong `backendFarmShift/src/main/java/com/farmshift/backendFarmShift/entity`.

## Cách đọc quan hệ

```text
EntityA [cardinality] —— Action —— [cardinality] EntityB
Account [1] —— Performs —— [0..N] WorkTask
```

Một Account có thể được giao nhiều WorkTask. Mỗi WorkTask bắt buộc được giao cho đúng một Account. Số cạnh mỗi entity cho biết số bản ghi của entity đó ứng với một bản ghi ở đầu bên kia.

| Ký hiệu | Ý nghĩa |
| --- | --- |
| 1 | Bắt buộc có đúng một |
| 0..1 | Có thể không có, tối đa một |
| 0..N | Có thể không có hoặc có nhiều |
| 1..N | Bắt buộc có ít nhất một |

Các dòng dưới dùng `0..N` để thể hiện chính xác tính tùy chọn của tập bản ghi con. Có thể viết ngắn thành `N` trên ERD tổng quan nếu ghi chú quy ước này.

Trong kiểu Chen, entity là hình chữ nhật, hành động là hình thoi và thuộc tính là hình oval. Gạch dưới khóa chính.

## Các entity trong ERD

Danh sách thuộc tính dưới đây là những thuộc tính tiêu biểu để vẽ. Các quan hệ ở phần sau thể hiện các cột tham chiếu giữa bảng.

| Entity | Table | Vai trò | Thuộc tính tiêu biểu |
| --- | --- | --- | --- |
| Account | accounts | Tài khoản đăng nhập và người được giao công việc | id, email, full_name, is_active |
| WorkTask | work_tasks | Công việc giao cho một tài khoản tại một chuồng | id, title, start_date, end_date |
| FarmArea | farm_areas | Khu chăn nuôi gồm nhiều chuồng | id, name |
| Barn | barns | Chuồng tổ chức nuôi theo từng lứa | id, name, current_quantity |
| FarmingCycle | farming_cycles | Một lứa nuôi tại một chuồng | id, cycle_number, start_date, end_date |
| Flock | flocks | Đàn vật nuôi thuộc một lứa | id, import_date, import_quantity, quantity |
| FlockMovement | flock_movements | Biến động số con như nhập, chuyển, hao hụt hoặc xuất bán | id, type, movement_date, quantity, weight_kg |
| DailyTaskLog | daily_task_logs | Ghi nhận thực hiện công việc hằng ngày trong lứa | id, task_date, task_key, planned_quantity, actual_quantity |
| CycleExpense | cycle_expenses | Khoản chi phí được ghi nhận cho lứa | id, expense_date, amount |
| DailyStockAllocation | daily_stock_allocations | Dòng phân bổ lượng hàng từ một bản ghi tồn kho cho nhật ký | log_id, inventory_item_id, quantity |
| Supplier | suppliers | Nhà cung cấp hàng hóa hoặc vật nuôi | id, code, name |
| PurchaseInvoice | purchase_invoices | Hóa đơn mua hàng từ nhà cung cấp | id, code, invoice_date, total_amount, paid_amount |
| PurchaseInvoiceItem | purchase_invoice_items | Một dòng hàng trên hóa đơn mua | id, quantity, amount |
| PurchasePayment | purchase_payments | Một lần thanh toán cho hóa đơn mua | id, payment_date, amount |
| ProductCategory | product_categories | Danh mục mặt hàng được mua và theo dõi tồn kho | id, name |
| WarehouseCategory | warehouse_categories | Kho lưu trữ hàng hóa | id, name |
| InventoryItem | inventory_items | Bản ghi tồn kho của một mặt hàng tại một kho | id, code, stock, price |
| InternalStockVoucher | internal_stock_vouchers | Phiếu nhập, xuất hoặc chuyển kho nội bộ | id, code, movement_type, movement_date, total_amount |
| InternalStockVoucherItem | internal_stock_voucher_items | Một dòng hàng trong phiếu kho nội bộ | id, quantity, unit_price, amount |
| CustomerContact | customer_contacts | Khách hàng mua hàng, được tham chiếu bởi đơn bán | id, code, name, phone |
| SalesOrder | sales_orders | Đơn bán ghi số con, khối lượng và số tiền | id, code, date, quantity, total_weight, total_amount, paid_amount |

Account còn có password, role_id, avatar_url và created_at. WorkTask dùng thuộc tính title. InventoryItem dùng code và lấy mặt hàng thông qua ProductCategory.

DailyStockAllocation là lớp `@Embeddable`, lưu qua collection table. Mapping và đoạn tạo bảng trong repo không khai báo id riêng cho bảng này. Khi vẽ, thể hiện quantity và hai liên kết log_id, inventory_item_id.

SalesOrder.id có kiểu String trong Java. CustomerContact là entity khách hàng được SalesOrder tham chiếu. Dự án còn có Customer trong bảng customers với mục đích và mapping riêng.

## Các quan hệ chính để vẽ

### Account and Work Assignment

```text
Account [1] —— Performs —— [0..N] WorkTask
Barn [1] —— Has —— [0..N] WorkTask
```

Mỗi công việc thuộc một chuồng và có một người được giao thực hiện. FK nằm trên WorkTask, lần lượt là assignee_id và barn_id.

### Farming and Flock Management

```text
FarmArea [1] —— Contains —— [0..N] Barn
Barn [1] —— Hosts —— [0..N] FarmingCycle
FarmingCycle [1] —— Includes —— [0..N] Flock
Flock [1] —— Undergoes —— [0..N] FlockMovement
```

Các FK lần lượt là barns.area_id, farming_cycles.barn_id, flocks.cycle_id và flock_movements.flock_id. Một chuồng có thể trải qua nhiều lứa theo thời gian. Một lứa có thể gồm nhiều đàn và mỗi đàn có nhiều lần biến động.

### Daily Logs and Expenses

```text
FarmingCycle [1] —— Has —— [0..N] DailyTaskLog
FarmingCycle [1] —— Incurs —— [0..N] CycleExpense
DailyTaskLog [1] —— Records —— [0..N] DailyStockAllocation
InventoryItem [1] —— Supplies —— [0..N] DailyStockAllocation
```

DailyTaskLog và CycleExpense dùng cycle_id. Mỗi dòng phân bổ thuộc một nhật ký qua log_id và lấy hàng từ một InventoryItem qua inventory_item_id. quantity ghi lượng lấy từ bản ghi tồn kho đó.

### Purchasing and Payments

```text
Supplier [1] —— Supplies —— [0..N] PurchaseInvoice
Supplier [0..1] —— Supplies —— [0..N] Flock
PurchaseInvoice [1] —— Contains —— [0..N] PurchaseInvoiceItem
PurchaseInvoice [1] —— Has —— [0..N] PurchasePayment
ProductCategory [0..1] —— Describes —— [0..N] PurchaseInvoiceItem
WarehouseCategory [0..1] —— Receives —— [0..N] PurchaseInvoiceItem
```

PurchaseInvoice dùng supplier_id. Flock có supplier_id tùy chọn. Dòng hóa đơn dùng invoice_id, product_category_id và warehouse_id. PurchasePayment dùng invoice_id. Một hóa đơn có thể được thanh toán nhiều lần.

### Inventory and Internal Stock Movements

```text
WarehouseCategory [1] —— Stores —— [0..N] InventoryItem
ProductCategory [1] —— Has —— [0..N] InventoryItem
FarmingCycle [0..1] —— Uses —— [0..N] InternalStockVoucher
WarehouseCategory [0..1] —— Issues —— [0..N] InternalStockVoucher
WarehouseCategory [0..1] —— Receives —— [0..N] InternalStockVoucher
InternalStockVoucher [1] —— Contains —— [0..N] InternalStockVoucherItem
ProductCategory [1] —— Describes —— [0..N] InternalStockVoucherItem
```

InventoryItem dùng warehouse_id và product_id. InternalStockVoucher dùng cycle_id, source_warehouse_id và target_warehouse_id. Dòng phiếu dùng voucher_id và product_id.

Hai dây từ WarehouseCategory đến InternalStockVoucher biểu diễn hai vai trò. Ghi Source Warehouse cạnh dây Issues và Destination Warehouse cạnh dây Receives. Có thể giữ cả hai để mô tả nhập, xuất và chuyển kho. Khi chỉ trình bày xuất vật tư cho lứa, có thể giữ dây Source Warehouse.

### Sales

```text
CustomerContact [0..1] —— Places —— [0..N] SalesOrder
FlockMovement [0..1] —— Documents —— [0..1] SalesOrder
```

SalesOrder dùng customer_id để tham chiếu CustomerContact và movement_id để tham chiếu biến động xuất đàn. Mỗi đơn có thể liên kết với tối đa một biến động, và một biến động có thể liên kết với tối đa một đơn.

Chuỗi chăn nuôi đến xuất bán được đọc như sau.

```text
FarmArea → Barn → FarmingCycle → Flock → FlockMovement → SalesOrder
```

## Các liên kết bổ sung khi cần đối chiếu chi tiết

Các liên kết dưới đây có trong mapping. Có thể bổ sung theo phạm vi thuyết minh của ERD.

| Quan hệ | FK hoặc mapping | Giải thích |
| --- | --- | --- |
| Role [0..1] — Classifies — [0..N] Account | accounts.role_id | Vai trò của tài khoản |
| Supplier [1] — Receives — [0..N] PurchasePayment | purchase_payments.supplier_id | Nhà cung cấp nhận khoản thanh toán |
| Flock [0..1] — Has — [0..N] PurchaseInvoice | purchase_invoices.flock_id | Hóa đơn mua liên kết với đàn |
| FarmingCycle [0..1] — Supplies — [0..N] SalesOrder | sales_orders.cycle_id | Đơn bán tham chiếu trực tiếp lứa nuôi |
| CycleExpense [0..1] — Has — [0..N] InternalStockVoucher | internal_stock_vouchers.expense_id | Phiếu kho tham chiếu khoản chi phí |
| InventoryItem [0..1] — Has — [0..N] DailyTaskLog | daily_task_logs.inventory_item_id | Tham chiếu tồn kho trực tiếp trên nhật ký |
| DailyTaskLog [0..1] — Records — [0..1] CycleExpense | daily_task_logs.expense_id | Nhật ký liên kết khoản chi phí phát sinh |
| InventoryItem [0..1] — Supplies — [0..N] InternalStockVoucherItem | source_inventory_item_id | Tồn kho nguồn của dòng phiếu |
| InventoryItem [0..1] — Receives — [0..N] InternalStockVoucherItem | target_inventory_item_id | Tồn kho đích của dòng phiếu |
| Flock [0..1] — Produces — [0..N] Flock | flocks.source_flock_id | Đàn phát sinh từ đàn nguồn |
| Flock [0..1] — Involves — [0..N] FlockMovement | flock_movements.related_flock_id | Đàn đối ứng trong biến động chuyển đàn |

Quan hệ tự tham chiếu Flock nối hai bản ghi có vai trò khác nhau trong cùng bảng. Một vòng nối giữa ba entity cũng có thể hợp lệ khi mỗi dây biểu diễn một FK riêng.

InventoryItem còn lưu purchase_invoice_item_id dạng Long, được PurchaseService gán từ dòng hóa đơn mua. Mapping khai báo unique cho cột này. Nếu thể hiện nguồn nhập trên sơ đồ, ghi rõ đây là tham chiếu được lưu bằng ID, với bội số tối đa một ở mỗi đầu theo khai báo unique.

## Lưu ý khi hoàn thiện bản vẽ

- Đặt hình thoi Undergoes giữa Flock và FlockMovement.
- Nối trực tiếp đường Has từ ProductCategory vào ô InventoryItem. Điểm giao giữa hai đường nên có cách thể hiện rõ để người đọc phân biệt dây cắt nhau và dây nối nhau.
- Dùng Has giữa CycleExpense và InternalStockVoucher. Dùng Uses giữa FarmingCycle và InternalStockVoucher.
- Tên entity thống nhất với tên class Java trong bảng trên.
- Các trường created_by hoặc done_by dạng chuỗi được thể hiện như thuộc tính. Chỉ thêm dây tới Account khi có mapping tham chiếu tương ứng.
- Backend cấu hình ddl-auto=none. Các bội số trong tài liệu phản ánh khai báo JPA và các đoạn nâng cấp schema trong repository. Cần đối chiếu schema database triển khai nếu kiểm chứng ràng buộc vật lý thực tế.

## Nguồn đối chiếu trong repository

- Entity và mapping — `backendFarmShift/src/main/java/com/farmshift/backendFarmShift/entity/`
- DDL phân bổ tồn kho — `backendFarmShift/src/main/java/com/farmshift/backendFarmShift/config/DailyStockAllocationSchemaUpgrade.java`
- Ràng buộc đơn bán và biến động — `backendFarmShift/src/main/java/com/farmshift/backendFarmShift/config/SalesOrderSchemaUpgrade.java`
- Cấu hình JPA — `backendFarmShift/src/main/resources/application.properties`
