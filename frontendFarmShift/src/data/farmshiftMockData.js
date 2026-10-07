// src/data/farmshiftMockData.js
// Dữ liệu nghiệp vụ chuẩn từ FarmShift

export const getFarmInfo = (user) => {
    try {
        const saved = localStorage.getItem('farmshift_farm_info');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && (!parsed.name || parsed.name.includes('Trấn Kế Toán') || parsed.name.includes('FarmShift') || parsed.name.includes('Admin') || parsed.name.includes('Miền Bình'))) {
                parsed.name = 'Trang trại Miến Bình';
            }
            return parsed;
        }
    } catch (e) {}

    return {
        name: 'Trang trại Miến Bình',
        owner: 'Trần Văn Bình',
        phone: '0987 654 321',
        address: 'Xã Tân Dân, Huyện Sóc Sơn, Hà Nội',
        type: 'Chăn nuôi gia cầm (Gà thịt)',
        scale: '15,000 con',
        currentFlockTotal: 12450,
        activeBatches: 5,
    };
};

export const saveFarmInfo = (info) => {
    try {
        localStorage.setItem('farmshift_farm_info', JSON.stringify(info));
        window.dispatchEvent(new Event('farmshift_info_updated'));
    } catch (e) {}
};

export const INITIAL_FARMSHIFT_DATA = {
    farmInfo: {
        name: 'Trang trại Miến Bình',
        owner: 'Trần Văn Bình',
        phone: '0987 654 321',
        address: 'Xã Tân Dân, Huyện Sóc Sơn, Hà Nội',
        type: 'Chăn nuôi gia cầm (Gà thịt)',
        scale: '15,000 con',
        currentFlockTotal: 12450,
        activeBatches: 5,
    },

    // 1. Khu nuôi & Chuồng trại
    areas: [
        {
            id: 'area-j',
            name: 'Khu J Thịt',
            barnCount: 3,
            livestockType: 'Gia cầm (Gà J-Dabaco)',
            description: 'Khu nuôi gà J-Dabaco thả vườn có mái che và sân chơi',
            barns: [
                { id: 'barn-j1', name: 'Nhà J1', capacity: 2500, current: 2400, ageDays: 45, avgWeight: 1.65, temp: 27.5, humidity: 68, status: 'Đang nuôi' },
                { id: 'barn-j2', name: 'Nhà J2', capacity: 2500, current: 2450, ageDays: 45, avgWeight: 1.62, temp: 28.0, humidity: 70, status: 'Đang nuôi' },
                { id: 'barn-j3', name: 'Nhà J3', capacity: 2500, current: 0, ageDays: 0, avgWeight: 0, temp: 26.5, humidity: 65, status: 'Trống (Vệ sinh)' },
            ]
        },
        {
            id: 'area-mia',
            name: 'Khu Mía Thịt',
            barnCount: 2,
            livestockType: 'Gia cầm (Gà Mía Dabaco)',
            description: 'Khu nuôi gà Mía đặc sản thương phẩm',
            barns: [
                { id: 'barn-m1', name: 'Nhà Mía 1', capacity: 2000, current: 1950, ageDays: 60, avgWeight: 2.10, temp: 27.2, humidity: 67, status: 'Đang nuôi' },
                { id: 'barn-m2', name: 'Nhà Mía 2', capacity: 2000, current: 1980, ageDays: 60, avgWeight: 2.05, temp: 27.8, humidity: 69, status: 'Đang nuôi' },
            ]
        },
        {
            id: 'area-a',
            name: 'Khu Nhà A',
            barnCount: 3,
            livestockType: 'Gia cầm (Gà lai chọi)',
            description: 'Chuồng nuôi bán công nghiệp hệ thống làm mát Cooling pad',
            barns: [
                { id: 'barn-a1', name: 'Nhà A1', capacity: 3000, current: 2850, ageDays: 28, avgWeight: 0.95, temp: 28.5, humidity: 72, status: 'Đang nuôi' },
                { id: 'barn-a2', name: 'Nhà A2', capacity: 3000, current: 2820, ageDays: 28, avgWeight: 0.92, temp: 28.2, humidity: 71, status: 'Đang nuôi' },
                { id: 'barn-a3', name: 'Nhà A3', capacity: 3000, current: 0, ageDays: 0, avgWeight: 0, temp: 25.0, humidity: 60, status: 'Trống' },
            ]
        },
        {
            id: 'area-b',
            name: 'Khu Nhà B',
            barnCount: 2,
            livestockType: 'Gia cầm',
            description: 'Khu úm gà con tuần 1 - tuần 3',
            barns: [
                { id: 'barn-b1', name: 'Nhà B1', capacity: 3500, current: 0, ageDays: 0, avgWeight: 0, temp: 26.0, humidity: 62, status: 'Trống (Khử trùng)' },
                { id: 'barn-b2', name: 'Nhà B2', capacity: 3500, current: 0, ageDays: 0, avgWeight: 0, temp: 26.0, humidity: 62, status: 'Trống' },
            ]
        }
    ],

    // 2. Kho hàng hóa
    inventory: [
        { id: 'inv-1', code: 'CG001', name: 'Gà giống J-Dabaco trống', category: 'Con giống', brand: 'Dabaco', unit: 'Con', pack: 'Thùng 102 con', price: 18500, stock: 0, minThreshold: 1000, warehouse: 'Kho Con giống' },
        { id: 'inv-2', code: 'CG002', name: 'Gà giống Mía Dabaco', category: 'Con giống', brand: 'Dabaco', unit: 'Con', pack: 'Thùng 102 con', price: 19000, stock: 0, minThreshold: 1000, warehouse: 'Kho Con giống' },
        { id: 'inv-3', code: 'TA001', name: 'Cám Gà úm Higro 01', category: 'Nguyên liệu sản xuất', brand: 'CP', unit: 'Bao (25kg)', pack: 'Bao', price: 345000, stock: 85, minThreshold: 30, warehouse: 'Kho Cám & Thức ăn' },
        { id: 'inv-4', code: 'TA002', name: 'Cám Gà thịt Higro 02', category: 'Nguyên liệu sản xuất', brand: 'CP', unit: 'Bao (25kg)', pack: 'Bao', price: 335000, stock: 160, minThreshold: 50, warehouse: 'Kho Cám & Thức ăn' },
        { id: 'inv-5', code: 'TA003', name: 'Cám Gà vỗ béo Higro 03', category: 'Nguyên liệu sản xuất', brand: 'CP', unit: 'Bao (25kg)', pack: 'Bao', price: 325000, stock: 210, minThreshold: 40, warehouse: 'Kho Cám & Thức ăn' },
        { id: 'inv-6', code: 'VX001', name: 'Vắc-xin Newcastle Lasota', category: 'Kho vaxin', brand: 'Hanvet', unit: 'Lọ 1000 liều', pack: 'Lọ', price: 42000, stock: 25, minThreshold: 10, warehouse: 'Kho Vắc-xin' },
        { id: 'inv-7', code: 'VX002', name: 'Vắc-xin Gumboro D78', category: 'Kho vaxin', brand: 'Hanvet', unit: 'Lọ 1000 liều', pack: 'Lọ', price: 48000, stock: 18, minThreshold: 10, warehouse: 'Kho Vắc-xin' },
        { id: 'inv-8', code: 'TH001', name: 'Kháng sinh Doxycycline 50%', category: 'Kho thuốc', brand: 'FAVET', unit: 'Gói 1kg', pack: 'Gói', price: 450000, stock: 12, minThreshold: 5, warehouse: 'Kho Thuốc thú y' },
        { id: 'inv-9', code: 'TH002', name: 'Hạ sốt Paracetamol C', category: 'Kho thuốc', brand: 'Hanvet', unit: 'Gói 1kg', pack: 'Gói', price: 85000, stock: 35, minThreshold: 10, warehouse: 'Kho Thuốc thú y' },
        { id: 'inv-10', code: 'HC001', name: 'Thuốc sát trùng BKC 80%', category: 'Kho hóa chất', brand: 'FAVET', unit: 'Can 5 lít', pack: 'Can', price: 290000, stock: 8, minThreshold: 5, warehouse: 'Kho Hóa chất' },
        { id: 'inv-11', code: 'HC002', name: 'Iodine sát trùng chuồng', category: 'Kho hóa chất', brand: 'Hanvet', unit: 'Chai 1 lít', pack: 'Chai', price: 115000, stock: 15, minThreshold: 5, warehouse: 'Kho Hóa chất' },
    ],

    // 3. Hóa đơn nhập hàng (Purchases)
    purchases: [
        {
            id: 'po-1',
            code: 'NH000000',
            date: '2026-09-15',
            supplier: 'Công ty CP Chăn nuôi C.P. Việt Nam',
            totalAmount: 112500000,
            paymentStatus: 'Thanh toán hoàn tất',
            stockStatus: 'Đã nhập kho',
            note: 'Nhập cám gà giai đoạn 1 và giai đoạn 2 lứa tháng 9',
            items: [
                { name: 'Cám Gà úm Higro 01', qty: 150, unit: 'Bao (25kg)', price: 345000, amount: 51750000 },
                { name: 'Cám Gà thịt Higro 02', qty: 180, unit: 'Bao (25kg)', price: 335000, amount: 60750000 },
            ]
        },
        {
            id: 'po-2',
            code: 'NH000001',
            date: '2026-09-18',
            supplier: 'Tập đoàn Dabaco Việt Nam',
            totalAmount: 92500000,
            paymentStatus: 'Thanh toán hoàn tất',
            stockStatus: 'Đã nhập kho',
            note: 'Nhập 5,000 con gà giống J-Dabaco',
            items: [
                { name: 'Gà giống J-Dabaco trống', qty: 5000, unit: 'Con', price: 18500, amount: 92500000 }
            ]
        },
        {
            id: 'po-3',
            code: 'NH000002',
            date: '2026-09-25',
            supplier: 'Công ty Thuốc Thú y Hanvet',
            totalAmount: 8560000,
            paymentStatus: 'Thanh toán hoàn tất',
            stockStatus: 'Đã nhập kho',
            note: 'Vắc-xin phòng Newcastle & Gumboro định kỳ',
            items: [
                { name: 'Vắc-xin Newcastle Lasota', qty: 30, unit: 'Lọ 1000 liều', price: 42000, amount: 1260000 },
                { name: 'Kháng sinh Doxycycline 50%', qty: 10, unit: 'Gói 1kg', price: 450000, amount: 4500000 },
                { name: 'Hạ sốt Paracetamol C', qty: 32, unit: 'Gói 1kg', price: 85000, amount: 2720000 }
            ]
        },
        {
            id: 'po-4',
            code: 'NH000003',
            date: '2026-10-02',
            supplier: 'Công ty CP Chăn nuôi C.P. Việt Nam',
            totalAmount: 68250000,
            paymentStatus: 'Trả sau',
            stockStatus: 'Đã nhập kho',
            note: 'Nhập đợt bổ sung cám vỗ béo Higro 03',
            items: [
                { name: 'Cám Gà vỗ béo Higro 03', qty: 210, unit: 'Bao (25kg)', price: 325000, amount: 68250000 }
            ]
        }
    ],

    // 4. Bán hàng (Sales & Harvest)
    sales: [
        {
            id: 'so-1',
            code: 'BH000045',
            date: '2026-09-28',
            customer: 'Thương lái Trần Văn Tuấn (Hà Nội)',
            flock: 'Khu J Thịt - Lứa J01',
            quantity: 1200,
            totalWeight: 2460, // kg
            unitPrice: 78000, // đ/kg
            totalAmount: 191880000,
            paidAmount: 191880000,
            status: 'Đã thu tiền',
            note: 'Xuất bán đợt 1 chuồng J1'
        },
        {
            id: 'so-2',
            code: 'BH000046',
            date: '2026-10-04',
            customer: 'Công ty Thực phẩm Sạch Minh Tâm',
            flock: 'Khu Mía Thịt - Lứa M01',
            quantity: 800,
            totalWeight: 1720,
            unitPrice: 84000,
            totalAmount: 144480000,
            paidAmount: 100000000,
            status: 'Còn thiếu 44,480,000 đ',
            note: 'Gà Mía Dabaco tuyển chọn loại 1'
        }
    ],

    // 5. Sổ quỹ (Cashbook)
    cashbook: [
        { id: 'cb-1', code: 'PT000021', date: '2026-10-04', type: 'Thu', category: 'Đơn bán gà', amount: 100000000, contact: 'Khách hàng', name: 'Công ty Thực phẩm Sạch Minh Tâm', fund: 'Tài khoản MB Bank', note: 'Thu tiền bán gà Mía đợt 1', creator: 'Admin FarmShift' },
        { id: 'cb-2', code: 'PC000035', date: '2026-10-02', type: 'Chi', category: 'Tiền điện & nước trang trại', amount: 8200000, contact: 'Đối tượng khác', name: 'Điện lực Sóc Sơn', fund: 'Tài khoản MB Bank', note: 'Thanh toán tiền điện tháng 9', creator: 'Admin FarmShift' },
        { id: 'cb-3', code: 'PT000020', date: '2026-09-28', type: 'Thu', category: 'Đơn bán gà', amount: 191880000, contact: 'Khách hàng', name: 'Trần Văn Tuấn', fund: 'Tiền mặt tại quỹ', note: 'Thu trọn tiền bán chuồng J1', creator: 'Admin FarmShift' },
        { id: 'cb-4', code: 'PC000034', date: '2026-09-25', type: 'Chi', category: 'Thuốc thú y', amount: 8560000, contact: 'Nhà cung cấp', name: 'Công ty Thuốc Thú y Hanvet', fund: 'Tài khoản MB Bank', note: 'Chi tiền mua thuốc & vắc-xin', creator: 'Admin FarmShift' },
        { id: 'cb-5', code: 'PC000033', date: '2026-09-20', type: 'Chi', category: 'Tiền lương công nhân', amount: 18000000, contact: 'Nhân sự', name: 'Lương tổ chăm sóc tháng 9', fund: 'Tiền mặt tại quỹ', note: 'Thanh toán lương 2 công nhân', creator: 'Admin FarmShift' },
    ],

    // 6. Ghi nhật ký chăn nuôi gần nhất
    journalLogs: [
        { id: 'log-1', date: '2026-10-07', barn: 'Nhà A1', feedMeal1: 75, feedMeal2: 75, totalFeed: 150, temp: 28.5, humidity: 72, mortality: 2, cull: 0, healthStatus: 'Bình thường, gà ăn mạnh, nhanh nhẹn', note: 'Bổ sung men tiêu hóa vào nước uống buổi sáng' },
        { id: 'log-2', date: '2026-10-07', barn: 'Nhà A2', feedMeal1: 72, feedMeal2: 74, totalFeed: 146, temp: 28.2, humidity: 71, mortality: 1, cull: 0, healthStatus: 'Bình thường', note: 'Không có dấu hiệu bất thường' },
        { id: 'log-3', date: '2026-10-07', barn: 'Nhà J1', feedMeal1: 110, feedMeal2: 115, totalFeed: 225, temp: 27.5, humidity: 68, mortality: 0, cull: 0, healthStatus: 'Tốt, phân khô khuôn', note: 'Cho ra sân chơi tắm nắng' },
        { id: 'log-4', date: '2026-10-07', barn: 'Nhà Mía 1', feedMeal1: 95, feedMeal2: 95, totalFeed: 190, temp: 27.2, humidity: 67, mortality: 0, cull: 0, healthStatus: 'Tốt', note: 'Cho ăn ngô mảnh kết hợp cám vỗ béo' },
        { id: 'log-5', date: '2026-10-06', barn: 'Nhà A1', feedMeal1: 74, feedMeal2: 74, totalFeed: 148, temp: 29.0, humidity: 74, mortality: 3, cull: 1, healthStatus: 'Có 3 con biểu hiện khò khè nhẹ', note: 'Đã phun sát trùng Iod xung quanh hiên chuồng' },
    ],

    // 7. Nhân sự & Tài khoản (Đồng bộ chuẩn từ Database)
    staff: [
        { id: 'st-1', name: 'Admin', email: 'hiepgacute1989@gmail.com', phone: '0966755095', role: 'Chủ trang trại (Admin)', barnAssigned: 'Toàn bộ trang trại', status: 'Hoạt động' },
        { id: 'st-2', name: 'Miến Bình', email: 'mienbinh@smartfarm.com', phone: '0988111222', role: 'Chủ trang trại', barnAssigned: 'Toàn bộ trang trại', status: 'Hoạt động' },
        { id: 'st-3', name: 'Trần Kế Toán', email: 'ketoan@smartfarm.com', phone: '0977222333', role: 'Kế toán', barnAssigned: 'Sổ quỹ & Kho hàng', status: 'Hoạt động' },
        { id: 'st-4', name: 'Lê Công Nhân', email: 'congnhan@smartfarm.com', phone: '0966333444', role: 'Công nhân trại', barnAssigned: 'Khu J Thịt, Chuồng B6', status: 'Hoạt động' },
    ],

    // 8. Cảnh báo Realtime (IoT)
    alerts: [
        { id: 'al-1', time: '14:25 - Hôm nay', barn: 'Nhà A1', type: 'Nhiệt độ cao', value: '29.2°C (Ngưỡng: 29.0°C)', level: 'Cảnh báo', status: 'Hệ thống quạt hút đang tăng tốc' },
        { id: 'al-2', time: '09:10 - Hôm nay', barn: 'Kho Cám & Thức ăn', type: 'Tồn kho', value: 'Higro 01 chạm ngưỡng an toàn', level: 'Nhắc nhở', status: 'Đề xuất đặt thêm 50 bao' },
        { id: 'al-3', time: 'Hôm qua', barn: 'Nhà J2', type: 'Độ ẩm cao', value: '78% (Mưa lớn)', level: 'Đã xử lý', status: 'Đã rải thêm trấu độn chuồng' },
    ]
};

// Aliases for compatibility
export const farmShiftData = INITIAL_FARMSHIFT_DATA;
export const INITIAL_FARMGO_DATA = INITIAL_FARMSHIFT_DATA;
