// src/components/GlobalSearch/GlobalSearch.jsx
// Thanh tìm kiếm chức năng toàn hệ thống (Omnibar / Quick Feature Search) chuẩn FarmShift
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, X, LayoutDashboard, Warehouse, ClipboardList,
  Package, ArrowLeftRight, FileText, ShoppingCart, DollarSign,
  Users, BarChart3, Layers, Settings, Sliders, Fan, Thermometer,
  HeartPulse, ShieldAlert, Zap, CornerDownLeft, Sparkles
} from 'lucide-react';
import styles from './GlobalSearch.module.css';

const SEARCHABLE_ITEMS = [
  // ── 1. Chức năng chính & Phân hệ
  {
    id: 'dashboard',
    category: 'Chức năng chính',
    title: 'Bảng tin tổng quan (Dashboard)',
    description: 'Chỉ số KPI, tiến độ đàn, cảnh báo IoT vi khí hậu toàn trại',
    path: '/dashboard',
    icon: LayoutDashboard,
    keywords: ['bang tin', 'tong quan', 'dashboard', 'kpi', 'trang chu', 'home']
  },
  {
    id: 'areas',
    category: 'Chức năng chính',
    title: 'Khu nuôi & Chuồng trại',
    description: 'Quản lý Khu Mía, Khu J, danh sách chuồng, mật độ nuôi',
    path: '/areas',
    icon: Warehouse,
    keywords: ['khu nuoi', 'chuong', 'trai', 'khu mia', 'khu j', 'nha a', 'nha b']
  },
  {
    id: 'journal-feed',
    category: 'Nhật ký chăn nuôi',
    title: 'Nhật ký cho ăn & Trừ tồn kho',
    description: 'Ghi lượng cám cữ 1, cữ 2, tự động trừ tồn kho cám CP',
    path: '/journal',
    icon: ClipboardList,
    keywords: ['cho an', 'nhat ky', 'cu an', 'cam', 'thuc an', 'tru kho']
  },
  {
    id: 'journal-iot',
    category: 'Thiết bị & Vi khí hậu',
    title: 'Quản lý thiết bị IoT & Điều khiển quạt',
    description: 'Bật/tắt quạt hút 1, quạt 2, giàn mát, chế độ Auto và Thủ công',
    path: '/journal',
    icon: Fan,
    keywords: ['quat', 'iot', 'thiet bi', 'dieu khien quat', 'gian mat', 'cooling pad', 'toc do', 'cap do']
  },
  {
    id: 'journal-env',
    category: 'Thiết bị & Vi khí hậu',
    title: 'Chỉ số môi trường nuôi (Nhiệt độ & Độ ẩm)',
    description: 'Đồng bộ dữ liệu cảm biến nhiệt độ (°C) và độ ẩm (%) theo thời gian thực',
    path: '/journal',
    icon: Thermometer,
    keywords: ['nhiet do', 'do am', 'moi truong', 'cam bien', 'vi khi hau', 'sensor']
  },
  {
    id: 'journal-health',
    category: 'Nhật ký chăn nuôi',
    title: 'Sức khỏe đàn & Tỷ lệ hao hụt',
    description: 'Theo dõi con chết, trọng lượng bình quân, phát hiện triệu chứng bệnh',
    path: '/journal',
    icon: HeartPulse,
    keywords: ['suc khoe', 'hao hut', 'con chet', 'benh', 'trieu chung', 'can nang']
  },
  {
    id: 'journal-treatment',
    category: 'Nhật ký chăn nuôi',
    title: 'Xử lý vật nuôi & Phác đồ điều trị',
    description: 'Lịch tiêm vắc xin, phác đồ kháng sinh, sát trùng chuồng trại',
    path: '/journal',
    icon: ShieldAlert,
    keywords: ['vacxin', 'tiem phong', 'thuoc', 'phac do', 'khang sinh', 'dieu tri']
  },
  {
    id: 'inventory',
    category: 'Kho & Vật tư',
    title: 'Kho hàng hóa & Vật tư nông nghiệp',
    description: 'Tra cứu tồn kho cám CP, thuốc thú y, vắc xin, hóa chất sát trùng',
    path: '/inventory',
    icon: Package,
    keywords: ['kho', 'hang hoa', 'ton kho', 'cam cp', 'thuoc thu y', 'vat tu']
  },
  {
    id: 'transfers',
    category: 'Kho & Vật tư',
    title: 'Xuất nhập nội bộ',
    description: 'Phiếu luân chuyển cám, thuốc thú y giữa kho tổng và các khu chuồng',
    path: '/transfers',
    icon: ArrowLeftRight,
    keywords: ['xuat nhap noi bo', 'dieu chuyen', 'chuyen kho', 'cap phat']
  },
  {
    id: 'purchases',
    category: 'Mua bán & Tài chính',
    title: 'Hóa đơn nhập hàng (Mua hàng)',
    description: 'Lập hóa đơn mua cám CP, thuốc thú y, con giống từ nhà cung cấp',
    path: '/purchases',
    icon: FileText,
    keywords: ['nhap hang', 'hoa don nhap', 'mua cam', 'nha cung cap', 'ncc']
  },
  {
    id: 'sales',
    category: 'Mua bán & Tài chính',
    title: 'Quản lý bán hàng (Xuất bán gà)',
    description: 'Tạo phiếu xuất bán gà thịt thương phẩm, cân xe, hợp đồng thương lái',
    path: '/sales',
    icon: ShoppingCart,
    keywords: ['ban hang', 'xuat ban', 'thuong lai', 'can xe', 'ga thit', 'hoa don ban']
  },
  {
    id: 'cashbook',
    category: 'Mua bán & Tài chính',
    title: 'Sổ quỹ thu chi & Dòng tiền',
    description: 'Theo dõi số dư MB Bank, quỹ tiền mặt, phiếu thu tiền bán, phiếu chi tiền cám',
    path: '/cashbook',
    icon: DollarSign,
    keywords: ['so quy', 'thu chi', 'dong tien', 'mb bank', 'tien mat', 'phieu thu', 'phieu chi']
  },
  {
    id: 'account',
    category: 'Hệ thống & Cấu hình',
    title: 'Tài khoản & Nhân sự',
    description: 'Quản lý danh sách nhân viên, kỹ sư trại, phân quyền truy cập',
    path: '/account',
    icon: Users,
    keywords: ['tai khoan', 'nhan su', 'nhan vien', 'admin', 'ky su', 'phan quyen']
  },
  {
    id: 'reports',
    category: 'Báo cáo',
    title: 'Báo cáo & Thống kê chăn nuôi',
    description: 'Chỉ số FCR tiêu tốn cám, tỷ lệ sống, tốc độ tăng trọng, hiệu quả kinh tế',
    path: '/reports',
    icon: BarChart3,
    keywords: ['bao cao', 'thong ke', 'fcr', 'tang trong', 'ty le song', 'hieu qua']
  },
  {
    id: 'catalog-settings',
    category: 'Hệ thống & Cấu hình',
    title: 'Thiết lập danh mục',
    description: 'Quản lý danh mục thức ăn, thuốc thú y, nhà cung cấp, khách hàng',
    path: '/catalog-settings',
    icon: Layers,
    keywords: ['danh muc', 'thiet lap danh muc', 'loai cam', 'nha cung cap']
  },
  {
    id: 'breeding-settings',
    category: 'Hệ thống & Cấu hình',
    title: 'Thiết lập chăn nuôi & Tiêu chuẩn',
    description: 'Định mức thức ăn theo ngày tuổi, dải vi khí hậu chuẩn, lịch vacxin mẫu',
    path: '/breeding-settings',
    icon: Settings,
    keywords: ['thiet lap chan nuoi', 'dinh muc', 'tieu chuan', 'quy trinh']
  },
  {
    id: 'general-settings',
    category: 'Hệ thống & Cấu hình',
    title: 'Thiết lập chung & Thông tin trang trại',
    description: 'Tên trang trại Miến Bình, địa chỉ, cấu hình cảm biến IoT & cảnh báo',
    path: '/general-settings',
    icon: Sliders,
    keywords: ['thiet lap chung', 'cai dat', 'trang trai mien binh', 'thong tin trai']
  },

  // ── 2. Chuồng trại cụ thể (Fast Jump)
  {
    id: 'barn-a1',
    category: 'Chuồng nuôi cụ thể',
    title: 'Chuồng Nhà A1 (Khu Mía Thịt)',
    description: 'Đang nuôi 1.950 con · Ngày tuổi 6 · Nhiệt độ 31.7°C, Độ ẩm 68%',
    path: '/journal',
    icon: Warehouse,
    keywords: ['nha a1', 'a1', 'chuong a1', 'khu mia thit']
  },
  {
    id: 'barn-a2',
    category: 'Chuồng nuôi cụ thể',
    title: 'Chuồng Nhà A2 (Khu Mía Thịt)',
    description: 'Đang nuôi 1.980 con · Ngày tuổi 6 · Nhiệt độ 31.8°C, Độ ẩm 66%',
    path: '/journal',
    icon: Warehouse,
    keywords: ['nha a2', 'a2', 'chuong a2', 'khu mia thit']
  },
  {
    id: 'barn-a3',
    category: 'Chuồng nuôi cụ thể',
    title: 'Chuồng Nhà A3 (Khu Mía Thịt)',
    description: 'Đang nuôi 1.900 con · Ngày tuổi 6 · Nhiệt độ 31.2°C, Độ ẩm 70%',
    path: '/journal',
    icon: Warehouse,
    keywords: ['nha a3', 'a3', 'chuong a3', 'khu mia thit']
  },
  {
    id: 'barn-b1',
    category: 'Chuồng nuôi cụ thể',
    title: 'Chuồng Nhà B1 (Khu J Thịt)',
    description: 'Đang nuôi 2.400 con · Ngày tuổi 45 · Nhiệt độ 27.5°C, Độ ẩm 74%',
    path: '/journal',
    icon: Warehouse,
    keywords: ['nha b1', 'b1', 'chuong b1', 'khu j thit']
  },
  {
    id: 'barn-b2',
    category: 'Chuồng nuôi cụ thể',
    title: 'Chuồng Nhà B2 (Khu J Thịt)',
    description: 'Đang nuôi 2.450 con · Ngày tuổi 45 · Nhiệt độ 28.2°C, Độ ẩm 72%',
    path: '/journal',
    icon: Warehouse,
    keywords: ['nha b2', 'b2', 'chuong b2', 'khu j thit']
  },

  // ── 3. Tác vụ nhanh
  {
    id: 'action-fan-emergency',
    category: 'Tác vụ khẩn cấp & Tự động',
    title: '⚡ Bật toàn bộ quạt thông gió (Khẩn cấp)',
    description: 'Kích hoạt quạt thông gió làm mát toàn bộ các chuồng khi thời tiết oi bức',
    path: '/journal',
    icon: Zap,
    keywords: ['bat quat', 'khan cap', 'giai nhiet', 'nang nong', 'bat tat ca']
  },
  {
    id: 'action-auto-iot',
    category: 'Tác vụ khẩn cấp & Tự động',
    title: '🤖 Chuyển toàn bộ quạt sang chế độ Tự động (Auto)',
    description: 'Hệ thống tự động kích hoạt quạt theo cảm biến nhiệt độ & độ ẩm vi khí hậu',
    path: '/journal',
    icon: Fan,
    keywords: ['che do tu dong', 'auto', 'tu dong hoa', 'cam bien nhiet do']
  }
];

// Hàm bỏ dấu tiếng Việt để tìm kiếm không dấu mượt mà
const removeVietnameseTones = (str) => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
};

export const GlobalSearch = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const searchContainerRef = useRef(null);
  const inputRef = useRef(null);

  // Lắng nghe phím tắt Ctrl+K hoặc Cmd+K để mở nhanh
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Click ra ngoài để đóng menu tìm kiếm
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Tự động focus input khi mở
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Lọc kết quả tìm kiếm
  const normalizedQuery = removeVietnameseTones(query.trim());
  const filteredItems = normalizedQuery
    ? SEARCHABLE_ITEMS.filter(item => {
        const titleNorm = removeVietnameseTones(item.title);
        const descNorm = removeVietnameseTones(item.description);
        const catNorm = removeVietnameseTones(item.category);
        const keywordsMatch = item.keywords.some(k => removeVietnameseTones(k).includes(normalizedQuery));
        return (
          titleNorm.includes(normalizedQuery) ||
          descNorm.includes(normalizedQuery) ||
          catNorm.includes(normalizedQuery) ||
          keywordsMatch
        );
      })
    : SEARCHABLE_ITEMS.slice(0, 8); // Khi chưa gõ, hiện 8 tính năng thông dụng nhất

  // Reset selectedIndex khi kết quả thay đổi
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = (item) => {
    setIsOpen(false);
    setQuery('');
    navigate(item.path);
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filteredItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        handleSelect(filteredItems[selectedIndex]);
      }
    }
  };

  return (
    <div className={styles.searchWrapper} ref={searchContainerRef}>
      {/* ── Thanh hiển thị trên Header ── */}
      <div
        className={`${styles.searchBar} ${isOpen ? styles.searchBarActive : ''}`}
        onClick={() => setIsOpen(true)}
      >
        <Search size={15} className={styles.searchIcon} />
        <span className={styles.searchPlaceholder}>
          Tìm nhanh chức năng, chuồng trại, kho hàng...
        </span>
        <div className={styles.shortcutBadge}>
          <kbd className={styles.kbd}>Ctrl</kbd>
          <span style={{ fontSize: '10px', color: '#94a3b8' }}>+</span>
          <kbd className={styles.kbd}>K</kbd>
        </div>
      </div>

      {/* ── Dropdown / Modal kết quả ── */}
      {isOpen && (
        <div className={styles.dropdownModal}>
          <div className={styles.dropdownHeader}>
            <Search size={17} className={styles.modalSearchIcon} />
            <input
              ref={inputRef}
              type="text"
              className={styles.modalInput}
              placeholder="Nhập tên chức năng (ví dụ: quạt, cám, chuồng A1, sổ quỹ)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
            />
            {query && (
              <button
                type="button"
                className={styles.clearBtn}
                onClick={() => setQuery('')}
                title="Xóa tìm kiếm"
              >
                <X size={15} />
              </button>
            )}
            <button
              type="button"
              className={styles.escBadge}
              onClick={() => setIsOpen(false)}
              title="Đóng (Esc)"
            >
              ESC
            </button>
          </div>

          <div className={styles.resultsList}>
            {filteredItems.length > 0 ? (
              filteredItems.map((item, index) => {
                const Icon = item.icon;
                const isSelected = index === selectedIndex;

                return (
                  <div
                    key={item.id}
                    className={`${styles.resultItem} ${isSelected ? styles.resultItemSelected : ''}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div className={styles.itemIconBox}>
                      <Icon size={17} />
                    </div>
                    <div className={styles.itemContent}>
                      <div className={styles.itemHeader}>
                        <span className={styles.itemTitle}>{item.title}</span>
                        <span className={styles.itemCategory}>{item.category}</span>
                      </div>
                      <div className={styles.itemDesc}>{item.description}</div>
                    </div>
                    <div className={styles.itemAction}>
                      {isSelected ? (
                        <span className={styles.enterHint}>
                          <CornerDownLeft size={13} /> Chọn
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className={styles.emptyState}>
                <Sparkles size={24} color="#94a3b8" />
                <p>Không tìm thấy chức năng hoặc chuồng nuôi nào khớp với "<strong>{query}</strong>"</p>
                <span>Thử tìm với từ khóa: <em>quạt, cám, chuồng, sổ quỹ, báo cáo, nhật ký...</em></span>
              </div>
            )}
          </div>

          <div className={styles.dropdownFooter}>
            <div className={styles.footerHint}>
              <span><kbd className={styles.footerKbd}>↑</kbd> <kbd className={styles.footerKbd}>↓</kbd> Di chuyển</span>
              <span><kbd className={styles.footerKbd}>↵</kbd> Truy cập</span>
              <span><kbd className={styles.footerKbd}>ESC</kbd> Đóng</span>
            </div>
            <div className={styles.footerBrand}>
              FarmShift Navigation
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
