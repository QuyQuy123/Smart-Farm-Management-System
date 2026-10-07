// src/data/screensMatrix.js
// Danh mục toàn bộ 73 màn hình hệ thống FarmShift theo prototype FarmShift_MienBinh_Full.html

export const FARMSHIFT_SCREENS = [
  // ── Nhóm 1: Bảng tin (Dashboard) ──────────────────────────
  {
    id: 'dashboard',
    group: 'Bảng tin',
    groupId: 'dashboard',
    title: 'Tổng quan trang trại',
    roles: ['owner', 'accountant', 'worker'],
    route: '/dashboard',
    notes: 'Bảng tin KPI, thời tiết, cảnh báo và tiến độ lứa nuôi'
  },
  {
    id: 'system-map',
    group: 'Bảng tin',
    groupId: 'dashboard',
    title: 'Sơ đồ hệ thống chuồng trại (System Map)',
    roles: ['owner', 'accountant', 'worker'],
    route: '/system-map',
    notes: 'Sơ đồ 5 tầng luồng vận hành chăn nuôi, tồn kho, hóa đơn, tài chính'
  },

  // ── Nhóm 2: Khu nuôi (Barns & Cycles) ──────────────────────
  {
    id: 'houses',
    group: 'Khu nuôi',
    groupId: 'farm',
    title: 'Danh sách chuồng nuôi',
    roles: ['owner', 'accountant', 'worker'],
    route: '/areas',
    notes: 'Danh sách chuồng, số lượng đầu con, trạng thái thiết bị'
  },
  {
    id: 'areas',
    group: 'Khu nuôi',
    groupId: 'farm',
    title: 'Danh sách khu nuôi',
    roles: ['owner', 'accountant', 'worker'],
    route: '/areas',
    notes: 'Quản lý các phân khu (Khu Mía, Khu J, Khu úm)'
  },
  {
    id: 'cycles',
    group: 'Khu nuôi',
    groupId: 'farm',
    title: 'Lứa nuôi & Đàn gà',
    roles: ['owner', 'accountant', 'worker'],
    route: '/cycles',
    notes: 'Quản lý lứa nuôi đang chạy, FCR, tỷ lệ sống và lứa đã thanh toán'
  },
  {
    id: 'cctv-wall',
    group: 'Khu nuôi',
    groupId: 'farm',
    title: 'Tường Camera CCTV Giám sát',
    roles: ['owner', 'accountant', 'worker'],
    route: '/areas',
    notes: 'Trực tiếp 4 góc máy camera hồng ngoại thời gian thực các chuồng'
  },

  // ── Nhóm 3: Ghi nhật ký (Diary) ───────────────────────────
  {
    id: 'feed-diary',
    group: 'Ghi nhật ký',
    groupId: 'diary',
    title: 'Ghi nhật ký cho ăn (Cám)',
    roles: ['owner', 'accountant', 'worker'],
    route: '/journal',
    notes: 'Nhập lượng cám ăn sáng / trưa / chiều theo từng chuồng'
  },
  {
    id: 'work-diary',
    group: 'Ghi nhật ký',
    groupId: 'diary',
    title: 'Ghi công việc chuồng trại',
    roles: ['owner', 'accountant', 'worker'],
    route: '/journal',
    notes: 'Checklist công việc bảo dưỡng, đảo trấu, sát trùng, dọn chuồng'
  },
  {
    id: 'health-diary',
    group: 'Ghi nhật ký',
    groupId: 'diary',
    title: 'Theo dõi vật nuôi & Sức khỏe',
    roles: ['owner', 'accountant', 'worker'],
    route: '/journal',
    notes: 'Ghi nhận số chết, loại thải, biểu hiện bệnh và thuốc điều trị'
  },
  {
    id: 'environment-diary',
    group: 'Ghi nhật ký',
    groupId: 'diary',
    title: 'Theo dõi môi trường nuôi',
    roles: ['owner', 'accountant', 'worker'],
    route: '/journal',
    notes: 'Ghi nhận nhiệt độ, độ ẩm, tốc độ gió và nồng độ khí chuồng'
  },

  // ── Nhóm 4: Kho hàng hóa (Inventory) ──────────────────────
  {
    id: 'inventory',
    group: 'Kho hàng hóa',
    groupId: 'inventory',
    title: 'Tất cả hàng hóa',
    roles: ['owner', 'accountant', 'worker'],
    route: '/inventory',
    notes: 'Danh mục tồn kho toàn diện, lọc theo kho, giá trị tồn'
  },
  {
    id: 'feed-stock',
    group: 'Kho hàng hóa',
    groupId: 'inventory',
    title: 'Kho cám',
    roles: ['owner', 'accountant', 'worker'],
    route: '/inventory',
    notes: 'Quản lý tồn cám Higro 01, Higro 02, Higro 03, ngô mảnh'
  },
  {
    id: 'medicine-stock',
    group: 'Kho hàng hóa',
    groupId: 'inventory',
    title: 'Kho thuốc',
    roles: ['owner', 'accountant', 'worker'],
    route: '/inventory',
    notes: 'Thuốc kháng sinh, vitamin, men tiêu hóa, điện giải'
  },
  {
    id: 'vaccine-stock',
    group: 'Kho hàng hóa',
    groupId: 'inventory',
    title: 'Kho vắc-xin',
    roles: ['owner', 'accountant', 'worker'],
    route: '/inventory',
    notes: 'Quản lý vắc-xin Lasota, Gumboro, New, Cúm gia cầm bảo quản lạnh'
  },
  {
    id: 'chemical-stock',
    group: 'Kho hàng hóa',
    groupId: 'inventory',
    title: 'Kho hóa chất sát trùng',
    roles: ['owner', 'accountant', 'worker'],
    route: '/inventory',
    notes: 'Vôi bột, Benkocid, Iodine, hóa chất tiêu độc khử trùng chuồng trại'
  },
  {
    id: 'breed-stock',
    group: 'Kho hàng hóa',
    groupId: 'inventory',
    title: 'Con giống',
    roles: ['owner', 'accountant'],
    route: '/inventory',
    notes: 'Quản lý nhập gà giống 01 ngày tuổi từ lò ấp'
  },
  {
    id: 'harvest-stock',
    group: 'Kho hàng hóa',
    groupId: 'inventory',
    title: 'Hàng thu hoạch',
    roles: ['owner', 'accountant'],
    route: '/inventory',
    notes: 'Gà thịt sẵn sàng xuất bán, phân bón trấu ủ vi sinh'
  },
  {
    id: 'ingredient-stock',
    group: 'Kho hàng hóa',
    groupId: 'inventory',
    title: 'Nguyên liệu sản xuất',
    roles: ['owner', 'accountant'],
    route: '/inventory',
    notes: 'Trấu rải chuồng, mùn cưa, vôi, than củi sưởi úm'
  },
  {
    id: 'item-detail',
    group: 'Kho hàng hóa',
    groupId: 'inventory',
    title: 'Thẻ kho & Chi tiết hàng hóa',
    roles: ['owner', 'accountant', 'worker'],
    route: '/inventory',
    notes: 'Sổ thẻ kho chi tiết từng mặt hàng, biến động nhập/xuất/tồn'
  },

  // ── Nhóm 5: Xuất nhập nội bộ (Internal Transfers) ─────────
  {
    id: 'stock-notes',
    group: 'Xuất nhập nội bộ',
    groupId: 'internal',
    title: 'Danh sách phiếu xuất nhập',
    roles: ['owner', 'accountant'],
    route: '/transfers',
    notes: 'Phiếu xuất kho chuyển cho chuồng, xuất hủy, điều chuyển giữa các kho'
  },
  {
    id: 'stock-reasons',
    group: 'Xuất nhập nội bộ',
    groupId: 'internal',
    title: 'Loại xuất nhập nội bộ',
    roles: ['owner', 'accountant'],
    route: '/transfers',
    notes: 'Cấu hình lý do xuất ăn, xuất khử trùng, hao hụt, chuyển kho'
  },

  // ── Nhóm 6: Hóa đơn nhập hàng (Purchases) ──────────────────
  {
    id: 'purchase-create',
    group: 'Hóa đơn nhập hàng',
    groupId: 'purchase',
    title: 'Tạo đơn nhập hàng',
    roles: ['owner', 'accountant'],
    route: '/purchases',
    notes: 'Lập hóa đơn nhập cám, thuốc, con giống từ nhà máy'
  },
  {
    id: 'purchases',
    group: 'Hóa đơn nhập hàng',
    groupId: 'purchase',
    title: 'Danh sách đơn nhập',
    roles: ['owner', 'accountant'],
    route: '/purchases',
    notes: 'Quản lý lịch sử nhập hàng, công nợ và trạng thái nhập kho'
  },
  {
    id: 'suppliers',
    group: 'Hóa đơn nhập hàng',
    groupId: 'purchase',
    title: 'Nhà cung cấp',
    roles: ['owner', 'accountant'],
    route: '/purchases',
    notes: 'Danh bạ công ty cung ứng thức ăn, thuốc thú y, giống gà'
  },

  // ── Nhóm 7: Quản lý bán hàng (Sales) ──────────────────────
  {
    id: 'sale-create',
    group: 'Quản lý bán hàng',
    groupId: 'sale',
    title: 'Tạo đơn bán hàng',
    roles: ['owner', 'accountant'],
    route: '/sales',
    notes: 'Lập đơn xuất bán gà thịt thương phẩm cho thương lái'
  },
  {
    id: 'harvest-create',
    group: 'Quản lý bán hàng',
    groupId: 'sale',
    title: 'Tạo đơn thu hoạch gà',
    roles: ['owner', 'accountant'],
    route: '/sales',
    notes: 'Cân gà xuất chuồng, trừ bì lồng, tính trọng lượng tịnh'
  },
  {
    id: 'sales',
    group: 'Quản lý bán hàng',
    groupId: 'sale',
    title: 'Danh sách đơn bán',
    roles: ['owner', 'accountant'],
    route: '/sales',
    notes: 'Lịch sử bán hàng, giá xuất, tình trạng thanh toán'
  },
  {
    id: 'customers',
    group: 'Quản lý bán hàng',
    groupId: 'sale',
    title: 'Khách hàng & Thương lái',
    roles: ['owner', 'accountant'],
    route: '/sales',
    notes: 'Danh bạ đối tác mua gà thương phẩm, đầu mối tiêu thụ'
  },

  // ── Nhóm 8: Sổ quỹ & Tài chính (Cashbook) ─────────────────
  {
    id: 'cashbook',
    group: 'Sổ quỹ',
    groupId: 'cash',
    title: 'Sổ quỹ thu chi',
    roles: ['owner', 'accountant'],
    route: '/cashbook',
    notes: 'Nhật ký dòng tiền mặt và tiền gửi ngân hàng theo ngày'
  },
  {
    id: 'expense-types',
    group: 'Sổ quỹ',
    groupId: 'cash',
    title: 'Loại phiếu chi',
    roles: ['owner', 'accountant'],
    route: '/cashbook',
    notes: 'Danh mục khoản chi: tiền điện, trấu, cám, vắc-xin, nhân công'
  },
  {
    id: 'income-types',
    group: 'Sổ quỹ',
    groupId: 'cash',
    title: 'Loại phiếu thu',
    roles: ['owner', 'accountant'],
    route: '/cashbook',
    notes: 'Danh mục khoản thu: bán gà thịt, bán phân chuồng, bán bao tải'
  },
  {
    id: 'fund-transfers',
    group: 'Sổ quỹ',
    groupId: 'cash',
    title: 'Chuyển quỹ nội bộ',
    roles: ['owner', 'accountant'],
    route: '/cashbook',
    notes: 'Điều chuyển tiền giữa quỹ tiền mặt và tài khoản ngân hàng'
  },
  {
    id: 'funds',
    group: 'Sổ quỹ',
    groupId: 'cash',
    title: 'Nguồn quỹ',
    roles: ['owner', 'accountant'],
    route: '/cashbook',
    notes: 'Két tiền mặt, tài khoản Vietcombank, Techcombank'
  },
  {
    id: 'receivables',
    group: 'Sổ quỹ',
    groupId: 'cash',
    title: 'Công nợ khách hàng',
    roles: ['owner', 'accountant'],
    route: '/cashbook',
    notes: 'Theo dõi tiền thương lái còn nợ chưa thanh toán hết'
  },
  {
    id: 'payables',
    group: 'Sổ quỹ',
    groupId: 'cash',
    title: 'Công nợ nhà cung cấp',
    roles: ['owner', 'accountant'],
    route: '/cashbook',
    notes: 'Theo dõi tiền nợ công ty cám, thuốc thú y'
  },
  {
    id: 'costs',
    group: 'Sổ quỹ',
    groupId: 'cash',
    title: 'Phân bổ chi phí lứa nuôi',
    roles: ['owner', 'accountant'],
    route: '/cashbook',
    notes: 'Hạch toán chi phí điện, trấu, khấu hao chuồng theo từng lứa'
  },
  {
    id: 'assets',
    group: 'Sổ quỹ',
    groupId: 'cash',
    title: 'Tài sản & Khấu hao',
    roles: ['owner', 'accountant'],
    route: '/cashbook',
    notes: 'Quản lý máy phát điện, quạt thông gió, khung chuồng trại'
  },
  {
    id: 'payroll',
    group: 'Sổ quỹ',
    groupId: 'cash',
    title: 'Tiền công nhân viên',
    roles: ['owner', 'accountant'],
    route: '/cashbook',
    notes: 'Bảng tính lương tháng, phụ cấp độc hại, ứng lương công nhân'
  },

  // ── Nhóm 9: IoT & Thiết bị (Energy & Smart Farm) ───────────
  {
    id: 'iot-overview',
    group: 'IoT & Thiết bị',
    groupId: 'iot',
    title: 'Giám sát chuồng trại IoT',
    roles: ['owner', 'worker'],
    route: '/energy',
    notes: 'Bảng đồng hồ nhiệt độ, độ ẩm, tốc độ quạt từng chuồng'
  },
  {
    id: 'devices',
    group: 'IoT & Thiết bị',
    groupId: 'iot',
    title: 'Danh sách thiết bị',
    roles: ['owner', 'worker'],
    route: '/energy',
    notes: 'Cảm biến SHT30, quạt hút công nghiệp, bóng sưởi hồng ngoại'
  },
  {
    id: 'controls',
    group: 'IoT & Thiết bị',
    groupId: 'iot',
    title: 'Điều khiển bật / tắt thiết bị',
    roles: ['owner', 'worker'],
    route: '/energy',
    notes: 'Công tắc từ xa bật tắt đèn, quạt hút, máy bơm làm mát'
  },
  {
    id: 'automations',
    group: 'IoT & Thiết bị',
    groupId: 'iot',
    title: 'Quy tắc tự động hóa',
    roles: ['owner', 'worker'],
    route: '/energy',
    notes: 'Kịch bản: Nhiệt độ > 29°C tự động kích hoạt quạt hút'
  },
  {
    id: 'device-schedules',
    group: 'IoT & Thiết bị',
    groupId: 'iot',
    title: 'Lịch hẹn giờ thiết bị',
    roles: ['owner', 'worker'],
    route: '/energy',
    notes: 'Hẹn giờ chiếu sáng ban đêm kích thích gà ăn'
  },
  {
    id: 'alerts',
    group: 'IoT & Thiết bị',
    groupId: 'iot',
    title: 'Cảnh báo môi trường khẩn cấp',
    roles: ['owner', 'worker'],
    route: '/energy',
    notes: 'Nhật ký cảnh báo quá nhiệt, mất điện lưới, đứt nguồn quạt'
  },
  {
    id: 'iot-history',
    group: 'IoT & Thiết bị',
    groupId: 'iot',
    title: 'Lịch sử đo & điều khiển',
    roles: ['owner', 'worker'],
    route: '/energy',
    notes: 'Biểu đồ thời gian thực chỉ số nhiệt độ và điện năng theo giờ'
  },
  {
    id: 'energy',
    group: 'IoT & Thiết bị',
    groupId: 'iot',
    title: 'Điện năng & Chi phí thiết bị',
    roles: ['owner', 'accountant', 'worker'],
    route: '/energy',
    notes: 'Ước tính tiêu thụ kWh và chi phí điện lưới sinh hoạt/kinh doanh'
  },

  // ── Nhóm 10: Tài khoản & Nhân sự (Accounts) ────────────────
  {
    id: 'employees',
    group: 'Tài khoản',
    groupId: 'accounts',
    title: 'Danh sách nhân viên',
    roles: ['owner'],
    route: '/account',
    notes: 'Quản lý danh sách công nhân, kỹ thuật viên, kế toán'
  },
  {
    id: 'assignments',
    group: 'Tài khoản',
    groupId: 'accounts',
    title: 'Phân công khu / chuồng',
    roles: ['owner'],
    route: '/account',
    notes: 'Giao trách nhiệm chăm sóc từng chuồng cho từng nhân sự'
  },
  {
    id: 'profile',
    group: 'Tài khoản',
    groupId: 'accounts',
    title: 'Hồ sơ cá nhân & Đổi mật khẩu',
    roles: ['owner', 'accountant', 'worker'],
    route: '/account',
    notes: 'Cập nhật thông tin liên hệ và bảo mật tài khoản'
  },

  // ── Nhóm 11: Báo cáo & Thống kê (Reports) ──────────────────
  {
    id: 'report-flocks',
    group: 'Báo cáo',
    groupId: 'reports',
    title: 'Báo cáo Chăn nuôi & Tăng trọng',
    roles: ['owner', 'accountant', 'worker'],
    route: '/reports',
    notes: 'Đồ thị tăng trọng so với chuẩn, tỷ lệ sống, FCR lũy kế'
  },
  {
    id: 'report-stock',
    group: 'Báo cáo',
    groupId: 'reports',
    title: 'Báo cáo Tồn kho & Cảnh báo thiếu cám',
    roles: ['owner', 'accountant'],
    route: '/reports',
    notes: 'Số ngày tồn kho cám còn lại dự kiến theo tốc độ ăn'
  },
  {
    id: 'report-sales',
    group: 'Báo cáo',
    groupId: 'reports',
    title: 'Báo cáo Doanh thu bán hàng',
    roles: ['owner', 'accountant'],
    route: '/reports',
    notes: 'Doanh số xuất chuồng, giá bán trung bình theo thời gian'
  },
  {
    id: 'report-purchases',
    group: 'Báo cáo',
    groupId: 'reports',
    title: 'Báo cáo Chi phí mua hàng',
    roles: ['owner', 'accountant'],
    route: '/reports',
    notes: 'Tổng chi phí cám, vắc-xin, thuốc nhập về trang trại'
  },
  {
    id: 'report-internal',
    group: 'Báo cáo',
    groupId: 'reports',
    title: 'Báo cáo Xuất nhập nội bộ',
    roles: ['owner', 'accountant'],
    route: '/reports',
    notes: 'Chi tiết phân bổ cám và thuốc đến từng chuồng nuôi'
  },
  {
    id: 'report-harvest',
    group: 'Báo cáo',
    groupId: 'reports',
    title: 'Báo cáo Thu hoạch & Phân loại',
    roles: ['owner', 'accountant'],
    route: '/reports',
    notes: 'Tỷ lệ gà đạt chuẩn loại 1 so với gà loại thải'
  },
  {
    id: 'report-finance',
    group: 'Báo cáo',
    groupId: 'reports',
    title: 'Báo cáo Sổ quỹ & Lợi nhuận P&L',
    roles: ['owner', 'accountant'],
    route: '/reports',
    notes: 'Lợi nhuận ròng, biên lợi nhuận trên mỗi kg gà xuất chuồng'
  },
  {
    id: 'report-cycles',
    group: 'Báo cáo',
    groupId: 'reports',
    title: 'Báo cáo Hạch toán lứa nuôi',
    roles: ['owner', 'accountant'],
    route: '/reports',
    notes: 'Tổng kết kinh tế trọn gói từng lứa nuôi sau khi bán hết'
  },
  {
    id: 'activity',
    group: 'Báo cáo',
    groupId: 'reports',
    title: 'Lịch sử hoạt động hệ thống',
    roles: ['owner'],
    route: '/reports',
    notes: 'Nhật ký ai làm gì, sửa phiếu lúc mấy giờ trên phần mềm'
  },

  // ── Nhóm 12: Thiết lập danh mục (Catalog) ──────────────────
  {
    id: 'catalog-warehouses',
    group: 'Thiết lập danh mục',
    groupId: 'catalog',
    title: 'Danh mục kho hàng',
    roles: ['owner', 'accountant'],
    route: '/catalog-settings',
    notes: 'Cấu hình kho cám, kho lạnh thuốc, kho vật tư'
  },
  {
    id: 'catalog-types',
    group: 'Thiết lập danh mục',
    groupId: 'catalog',
    title: 'Loại hàng hóa',
    roles: ['owner', 'accountant'],
    route: '/catalog-settings',
    notes: 'Phân loại thức ăn hỗn hợp, thức ăn đậm đặc, kháng sinh, vắc-xin'
  },
  {
    id: 'catalog-units',
    group: 'Thiết lập danh mục',
    groupId: 'catalog',
    title: 'Đơn vị tính',
    roles: ['owner', 'accountant'],
    route: '/catalog-settings',
    notes: 'Bao (25kg), Bao (40kg), Lọ, Liều, Gói, Can, Con, Kg'
  },
  {
    id: 'catalog-specs',
    group: 'Thiết lập danh mục',
    groupId: 'catalog',
    title: 'Đơn vị quy cách',
    roles: ['owner', 'accountant'],
    route: '/catalog-settings',
    notes: 'Quy đổi 1 bao = 25 kg, 1 thùng = 20 gói'
  },
  {
    id: 'catalog-brands',
    group: 'Thiết lập danh mục',
    groupId: 'catalog',
    title: 'Nhãn hiệu hàng hóa',
    roles: ['owner', 'accountant'],
    route: '/catalog-settings',
    notes: 'Dabaco, CJ Vina, GreenFeed, De Heus, Boehringer'
  },

  // ── Nhóm 13: Thiết lập chăn nuôi (Husbandry) ───────────────
  {
    id: 'tasks',
    group: 'Thiết lập chăn nuôi',
    groupId: 'husbandry',
    title: 'Công việc & Lịch chăm sóc',
    roles: ['owner', 'worker'],
    route: '/tasks',
    notes: 'Lịch vệ sinh chuồng, sát trùng, kiểm tra thông gió định kỳ'
  },
  {
    id: 'harvest-types',
    group: 'Thiết lập chăn nuôi',
    groupId: 'husbandry',
    title: 'Loại thu hoạch & Biểu cân',
    roles: ['owner'],
    route: '/harvest-types',
    notes: 'Gà thịt biểu lớn, Gà xô, Gà lọc còi cọc'
  },
  {
    id: 'environment-metrics',
    group: 'Thiết lập chăn nuôi',
    groupId: 'husbandry',
    title: 'Chỉ số môi trường nuôi (IoT)',
    roles: ['owner'],
    route: '/breeding-settings',
    notes: 'Ngưỡng nhiệt độ 25-28.5°C, độ ẩm 60-70% chuẩn chuồng kín'
  },
  {
    id: 'animal-metrics',
    group: 'Thiết lập chăn nuôi',
    groupId: 'husbandry',
    title: 'Chỉ số vật nuôi theo ngày',
    roles: ['owner'],
    route: '/breeding-settings',
    notes: 'Bảng theo dõi tăng trọng và lượng cám ăn/con theo giống'
  },
  {
    id: 'programs',
    group: 'Thiết lập chăn nuôi',
    groupId: 'husbandry',
    title: 'Chương trình nuôi chuẩn',
    roles: ['owner', 'worker'],
    route: '/breeding-settings',
    notes: 'Quy trình kỹ thuật 75 ngày: Úm, Sinh trưởng, Vỗ béo'
  },
  {
    id: 'growth-targets',
    group: 'Thiết lập chăn nuôi',
    groupId: 'husbandry',
    title: 'Mục tiêu tăng trưởng & Định mức cám',
    roles: ['owner'],
    route: '/growth-targets',
    notes: 'Định mức FCR và trọng lượng mục tiêu theo ngày tuổi'
  },

  // ── Nhóm 14: Thiết lập chung (Settings) ─────────────────────
  {
    id: 'farm-settings',
    group: 'Thiết lập chung',
    groupId: 'settings',
    title: 'Thông tin trang trại',
    roles: ['owner'],
    route: '/general-settings',
    notes: 'Tên hộ kinh doanh, địa chỉ, người đại diện, số điện thoại'
  },
  {
    id: 'roles',
    group: 'Thiết lập chung',
    groupId: 'settings',
    title: 'Quyền hạn theo vai trò',
    roles: ['owner'],
    route: '/general-settings',
    notes: 'Ma trận quyền Chủ trại, Kế toán, Công nhân'
  },
  {
    id: 'house-permissions',
    group: 'Thiết lập chung',
    groupId: 'settings',
    title: 'Phân quyền khu & chuồng nuôi',
    roles: ['owner'],
    route: '/general-settings',
    notes: 'Chỉ định công nhân nào được phụ trách ghi chép chuồng nào'
  },
  {
    id: 'warehouse-permissions',
    group: 'Thiết lập chung',
    groupId: 'settings',
    title: 'Phân quyền kho hàng',
    roles: ['owner'],
    route: '/general-settings',
    notes: 'Chỉ định thủ kho quản lý kho cám, kho thuốc'
  },
  {
    id: 'notifications',
    group: 'Thiết lập chung',
    groupId: 'settings',
    title: 'Thông báo cá nhân & Cảnh báo',
    roles: ['owner', 'accountant', 'worker'],
    route: '/general-settings',
    notes: 'Bật/tắt thông báo app, email, SMS, cảnh báo nhiệt độ IoT'
  },
  {
    id: 'data',
    group: 'Thiết lập chung',
    groupId: 'settings',
    title: 'Dữ liệu & Sao lưu JSON / Excel',
    roles: ['owner'],
    route: '/general-settings',
    notes: 'Tải sao lưu tệp JSON, nhập từ Excel, đặt lại mẫu demo'
  },
  {
    id: 'screens',
    group: 'Thiết lập chung',
    groupId: 'settings',
    title: 'Danh mục toàn bộ 73 màn hình hệ thống',
    roles: ['owner', 'accountant', 'worker'],
    route: '/general-settings',
    notes: 'Ma trận điều hướng nhanh đến toàn bộ 73 màn hình chức năng'
  }
];
