// src/features/farmshift/farmshiftData.js
// Exact seed database & route definitions from FarmShift.html

export const SEED_DATA = {
  coops: [
    { id: 'B5', n: 1500, temp: 29.2, worker: 'Nguyễn Văn An' },
    { id: 'B6', n: 1498, temp: 30.1, worker: 'Trần Văn Bình' }
  ],
  stock: [
    { id: 'TA-001', name: 'Thức ăn khởi động', unit: 'kg', n: 500, price: 12000, lot: 'TA-1026', expiry: '2027-04-01' },
    { id: 'TA-002', name: 'Thức ăn tăng trưởng', unit: 'kg', n: 1500, price: 12000, lot: 'TA-1026B', expiry: '2027-04-01' },
    { id: 'VS-001', name: 'Dung dịch vệ sinh chuồng', unit: 'lít', n: 20, price: 80000, lot: 'VS-1026', expiry: '2027-10-01' },
    { id: 'BS-001', name: 'Vitamin bổ sung', unit: 'gói', n: 40, price: 50000, lot: 'BS-0926 / BS-1026', expiry: '2026-11-05' }
  ],
  logs: [
    { date: '2026-10-21', time: '07:00', coop: 'B6', type: 'Cho ăn', amount: 60, unit: 'kg', note: 'Thức ăn tăng trưởng', person: 'Trần Văn Bình' },
    { date: '2026-10-21', time: '09:15', coop: 'B6', type: 'Hao hụt', amount: 2, unit: 'con', note: 'Đã báo chủ trại, chờ xác minh nguyên nhân', person: 'Trần Văn Bình' },
    { date: '2026-10-21', time: '10:00', coop: 'B5', type: 'Cân mẫu', amount: 460, unit: 'g/con', note: '30 mẫu, tổng 13,8 kg', person: 'Nguyễn Văn An' }
  ],
  tasks: [
    { name: 'Cho ăn buổi sáng', coop: 'B6', time: '07:00', status: 'Hoàn thành' },
    { name: 'Cân mẫu định kỳ', coop: 'B6', time: '10:00', status: 'Chưa bắt đầu' },
    { name: 'Vệ sinh lối đi chuồng', coop: 'B5', time: '14:00', status: 'Đang thực hiện' }
  ],
  purchases: [
    { id: 'MH-1021-01', party: 'NCC An Phú', date: '2026-10-21', amount: 800000, paid: 0, received: false }
  ],
  sales: [],
  payments: [],
  entries: [],
  alerts: [
    { id: 'CB-01', name: 'Vitamin bổ sung sắp hết hạn', detail: 'Lô BS-0926 · 10 gói · HSD 05/11/2026', status: 'Mới' },
    { id: 'CB-02', name: 'Tồn dung dịch vệ sinh thấp', detail: '20 lít / mức tối thiểu 30 lít', status: 'Đang xử lý' }
  ],
  employees: [
    { name: 'Trần Văn Bình', role: 'Công nhân', coop: 'B6', status: 'Hoạt động' },
    { name: 'Nguyễn Thị Mai', role: 'Kế toán', coop: '—', status: 'Hoạt động' }
  ]
};

export const ROUTES_REGISTRY = {};

function reg(id, title, group, kind, allowed = 'oa', extra = {}) {
  ROUTES_REGISTRY[id] = { id, title, group, kind, allowed, ...extra };
}

const ALL = 'oaw', OA = 'oa';

reg('dashboard', 'Tổng quan', 'dashboard', 'dashboard', ALL);
reg('farm', 'Sơ đồ trang trại', 'farm', 'farm', 'o');
reg('areas', 'Khu nuôi', 'farm', 'areas', 'o');
reg('area-form', 'Thêm / sửa khu nuôi', 'farm', 'form', 'o', { form: 'area' });
reg('coops', 'Danh sách chuồng', 'farm', 'coops', 'ow');
reg('coop', 'Chi tiết chuồng nuôi', 'farm', 'coop', 'ow');
reg('coop-form', 'Thêm / sửa chuồng', 'farm', 'form', 'o', { form: 'coop' });

reg('batches', 'Lứa nuôi & Đàn', 'batches', 'batches', OA);
reg('batch-create', 'Tạo lứa nuôi', 'batches', 'wizard', 'o');
reg('batch', 'Chi tiết lứa nuôi', 'batches', 'batch', OA);
for (const [id, title] of [
  ['flocks', 'Đàn trong lứa'],
  ['growth', 'Tăng trưởng'],
  ['feed', 'Thức ăn'],
  ['health', 'Sức khỏe'],
  ['batch-cost', 'Chi phí lứa'],
  ['harvest', 'Thu hoạch'],
  ['batch-close', 'Kết thúc lứa']
]) reg(id, title, 'batches', id, id === 'batch-close' ? 'o' : OA);

reg('movements', 'Biến động đàn', 'batches', 'movements', 'o');
for (const [id, title] of [
  ['transfer', 'Chuyển đàn'],
  ['split', 'Tách đàn'],
  ['merge', 'Gộp đàn'],
  ['mortality', 'Ghi nhận hao hụt']
]) reg(id, title, id === 'mortality' ? 'journal' : 'batches', 'form', id === 'mortality' ? 'ow' : 'o', { form: id });

reg('programs', 'Chương trình nuôi', 'programs', 'programs', 'o');
reg('program', 'Chi tiết chương trình', 'programs', 'program', 'o');
reg('program-form', 'Tạo / sửa chương trình', 'programs', 'form', 'o', { form: 'program' });
reg('targets', 'Chỉ tiêu mục tiêu', 'programs', 'form', 'o', { form: 'targets' });

reg('tasks', 'Kế hoạch & Công việc', 'tasks', 'tasks', 'ow');
reg('task', 'Chi tiết công việc', 'tasks', 'task', 'ow');
reg('task-form', 'Tạo / sửa công việc', 'tasks', 'form', 'o', { form: 'task' });
reg('task-board', 'Bảng công việc', 'tasks', 'board', 'ow');
reg('calendar', 'Lịch chăm sóc', 'tasks', 'calendar', 'ow');

reg('journal', 'Nhật ký chăn nuôi', 'journal', 'journal', ALL);
reg('log-detail', 'Chi tiết nhật ký', 'journal', 'log-detail', ALL);
reg('quick', 'Ghi nhanh', 'journal', 'quick', 'ow');
for (const [id, title] of [
  ['feeding', 'Ghi nhận cho ăn'],
  ['weighing', 'Ghi nhận cân mẫu'],
  ['medication', 'Thuốc & Vaccine'],
  ['work-log', 'Nhật ký công việc'],
  ['health-log', 'Ghi nhận sức khỏe']
]) reg(id, title, 'journal', 'form', 'ow', { form: id });

reg('voice', 'Nhập bằng giọng nói', 'journal', 'voice', 'ow');
reg('voice-review', 'Kiểm tra nhật ký giọng nói', 'journal', 'voice-review', 'ow');
reg('feeding-history', 'Lịch sử cho ăn', 'journal', 'feeding-history', 'ow');
reg('weight-history', 'Lịch sử cân mẫu', 'journal', 'weight-history', 'ow');

for (const [id, title, kind] of [
  ['inventory', 'Kho & Vật tư', 'inventory'],
  ['item', 'Chi tiết vật tư', 'item'],
  ['stock-card', 'Thẻ kho', 'stock-card'],
  ['lots', 'Lô tồn & Hạn sử dụng', 'lots'],
  ['stock-transactions', 'Phiếu nhập / xuất kho', 'stock-transactions'],
  ['stock-detail', 'Chi tiết phiếu kho', 'stock-detail'],
  ['counts', 'Kiểm kê', 'counts']
]) reg(id, title, 'inventory', kind, OA);

for (const [id, title] of [
  ['item-form', 'Thêm / sửa vật tư'],
  ['stock-in', 'Nhập kho'],
  ['stock-out', 'Xuất kho'],
  ['stock-transfer', 'Chuyển kho'],
  ['stock-return', 'Nhập trả'],
  ['stock-count', 'Lập biên bản kiểm kê'],
  ['stock-adjust', 'Điều chỉnh tồn kho']
]) reg(id, title, 'inventory', 'form', OA, { form: id });
reg('stock-lookup', 'Tra cứu vật tư', 'stock-lookup', 'stock-lookup', 'w');

for (const [id, title, kind] of [
  ['purchases', 'Mua hàng', 'purchases'],
  ['purchase', 'Chi tiết phiếu mua', 'purchase'],
  ['suppliers', 'Nhà cung cấp', 'suppliers'],
  ['supplier', 'Chi tiết nhà cung cấp', 'supplier']
]) reg(id, title, 'purchases', kind, OA);
reg('purchase-form', 'Tạo phiếu mua', 'purchases', 'form', OA, { form: 'purchase' });
reg('supplier-form', 'Thêm / sửa nhà cung cấp', 'purchases', 'form', OA, { form: 'supplier' });

for (const [id, title, kind] of [
  ['sales', 'Bán hàng', 'sales'],
  ['sale', 'Chi tiết phiếu bán', 'sale'],
  ['customers', 'Khách hàng & Thương lái', 'customers'],
  ['customer', 'Chi tiết khách hàng', 'customer'],
  ['harvest-plan', 'Kế hoạch xuất bán', 'harvest-plan']
]) reg(id, title, 'sales', kind, OA);
reg('sale-form', 'Tạo phiếu bán', 'sales', 'form', OA, { form: 'sale' });
reg('customer-form', 'Thêm / sửa khách hàng', 'sales', 'form', OA, { form: 'customer' });
reg('harvest-form', 'Lập kế hoạch xuất bán', 'sales', 'form', 'o', { form: 'harvest' });

reg('ocr', 'Trung tâm chứng từ AI', 'ocr', 'ocr', OA);
reg('ocr-upload', 'Tải chứng từ', 'ocr', 'ocr-upload', OA);
reg('ocr-review', 'Kiểm tra kết quả OCR', 'ocr', 'ocr-review', OA);

for (const [id, title, kind] of [
  ['finance', 'Tổng quan tài chính', 'finance'],
  ['cashbook', 'Sổ quỹ', 'cashbook'],
  ['receipts', 'Phiếu thu', 'receipts'],
  ['payments', 'Phiếu chi', 'payments'],
  ['voucher', 'Chi tiết thu / chi', 'voucher'],
  ['payables', 'Công nợ phải trả', 'payables'],
  ['receivables', 'Công nợ phải thu', 'receivables'],
  ['debt', 'Chi tiết công nợ', 'debt'],
  ['costs', 'Chi phí theo lứa', 'costs']
]) reg(id, title, 'finance', kind, OA);
reg('receipt-form', 'Lập phiếu thu', 'finance', 'form', OA, { form: 'receipt' });
reg('payment-form', 'Lập phiếu chi', 'finance', 'form', OA, { form: 'payment' });
reg('cost-form', 'Ghi nhận / phân bổ chi phí', 'finance', 'form', OA, { form: 'cost' });

reg('iot', 'Giám sát môi trường', 'iot', 'iot', 'ow');
reg('device', 'Chi tiết thiết bị', 'iot', 'device', 'ow');
reg('devices', 'Danh sách thiết bị', 'iot', 'devices', 'o');
reg('device-form', 'Thêm / sửa thiết bị', 'iot', 'form', 'o', { form: 'device' });
reg('iot-settings', 'Ngưỡng cảnh báo', 'iot', 'form', 'o', { form: 'threshold' });
reg('rules', 'Quy tắc tự động', 'iot', 'rules', 'o');
reg('rule-form', 'Tạo / sửa quy tắc', 'iot', 'form', 'o', { form: 'rule' });

reg('alerts', 'Trung tâm cảnh báo', 'alerts', 'alerts', 'ow');
reg('alert', 'Chi tiết cảnh báo', 'alerts', 'alert', 'ow');
reg('notifications', 'Thông báo', 'notifications', 'notifications', ALL);

reg('ai', 'Trợ lý FarmShift AI', 'ai', 'ai', ALL);
reg('ai-health', 'Hỗ trợ sức khỏe đàn', 'ai', 'ai-health', 'ow');

reg('reports', 'Trung tâm báo cáo', 'reports', 'reports', OA);
for (const [id, title] of [
  ['report-batch', 'Báo cáo hiệu quả lứa'],
  ['report-flock', 'Báo cáo đàn & Hao hụt'],
  ['report-growth', 'Báo cáo tăng trưởng & Thức ăn'],
  ['report-stock', 'Báo cáo nhập xuất tồn'],
  ['report-cash', 'Báo cáo thu chi'],
  ['report-debt', 'Báo cáo công nợ'],
  ['report-trade', 'Báo cáo mua bán']
]) reg(id, title, 'reports', id, OA);

reg('employees', 'Nhân sự', 'employees', 'employees', 'o');
reg('employee', 'Chi tiết nhân viên', 'employees', 'employee', 'o');
reg('employee-form', 'Thêm / sửa nhân viên', 'employees', 'form', 'o', { form: 'employee' });
reg('assignment', 'Phân công chuồng', 'employees', 'form', 'o', { form: 'assignment' });
reg('permissions', 'Phân quyền', 'employees', 'permissions', 'o');
reg('activity', 'Lịch sử hoạt động', 'employees', 'activity', 'o');

reg('settings', 'Cài đặt trang trại', 'settings', 'form', 'o', { form: 'settings' });
reg('notification-settings', 'Cài đặt thông báo', 'profile', 'form', ALL, { form: 'notification' });
reg('profile', 'Hồ sơ cá nhân', 'profile', 'form', ALL, { form: 'profile' });
reg('password', 'Đổi mật khẩu', 'profile', 'form', ALL, { form: 'password' });
reg('catalog', 'Danh mục màn hình', 'catalog', 'catalog', ALL);
