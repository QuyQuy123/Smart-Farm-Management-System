// src/features/farmshift/ReportsView.jsx
// Báo cáo & Thống kê toàn diện trang trại chuẩn FarmShift & DESIGN.md (Đủ 9 loại báo cáo)
import React, { useState } from 'react';
import {
  BarChart3, TrendingUp, FileSpreadsheet, PieChart,
  Calendar, ArrowUpRight, DollarSign, Package, Warehouse,
  Scale, ArrowLeftRight, Clock, ShieldCheck, Activity, Users
} from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { INITIAL_FARMSHIFT_DATA } from '../../data/farmshiftMockData';

export const ReportsView = () => {
  const [activeTab, setActiveTab] = useState('summary');
  // 'summary' | 'sales' | 'purchases' | 'inventory' | 'cashbook' | 'harvest' | 'growth' | 'internal' | 'activity'

  return (
    <FarmShiftLayout
      pageTitle="Báo cáo & Phân tích chăn nuôi"
      breadcrumbs={[{ label: 'Báo cáo' }]}
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="farmshift-btn farmshift-btn-excel">
            <FileSpreadsheet size={15} /> Xuất Báo cáo Excel
          </button>
        </div>
      }
    >
      {/* ── Tabs Navigation (All 9 FarmShift Reports) ────────── */}
      <div className="farmshift-tabs">
        <button
          className={`farmshift-tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveTab('summary')}
        >
          Tổng hợp trang trại
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'sales' ? 'active' : ''}`}
          onClick={() => setActiveTab('sales')}
        >
          Báo cáo bán hàng
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'purchases' ? 'active' : ''}`}
          onClick={() => setActiveTab('purchases')}
        >
          Báo cáo nhập hàng
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          Báo cáo tồn kho
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'cashbook' ? 'active' : ''}`}
          onClick={() => setActiveTab('cashbook')}
        >
          Báo cáo sổ quỹ
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'harvest' ? 'active' : ''}`}
          onClick={() => setActiveTab('harvest')}
        >
          Báo cáo thu hoạch
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'growth' ? 'active' : ''}`}
          onClick={() => setActiveTab('growth')}
        >
          Xu hướng lứa nuôi (FCR)
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'internal' ? 'active' : ''}`}
          onClick={() => setActiveTab('internal')}
        >
          Xuất nhập nội bộ
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'activity' ? 'active' : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          Nhật ký hoạt động
        </button>
      </div>

      {/* ── Tab 1: Tổng hợp trang trại ───────────────────── */}
      {activeTab === 'summary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div className="farmshift-card" style={{ margin: 0, padding: '20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-muted)', fontWeight: 500 }}>TỔNG NHẬP ĐÀN</div>
              <div style={{ fontSize: '28px', fontWeight: 500, color: 'var(--color-ink)', marginTop: '6px' }}>14,500 con</div>
              <div style={{ fontSize: '12px', color: 'var(--color-muted)', marginTop: '4px' }}>Lứa nuôi tháng 8 - 9/2026</div>
            </div>
            <div className="farmshift-card" style={{ margin: 0, padding: '20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-muted)', fontWeight: 500 }}>ĐÃ XUẤT BÁN THỊT</div>
              <div style={{ fontSize: '28px', fontWeight: 500, color: 'var(--color-primary)', marginTop: '6px' }}>2,000 con</div>
              <div style={{ fontSize: '12px', color: 'var(--color-muted)', marginTop: '4px' }}>4,180 kg thương phẩm</div>
            </div>
            <div className="farmshift-card" style={{ margin: 0, padding: '20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-muted)', fontWeight: 500 }}>HAO HỤT LŨY KẾ</div>
              <div style={{ fontSize: '28px', fontWeight: 500, color: 'var(--color-success)', marginTop: '6px' }}>50 con (0.34%)</div>
              <div style={{ fontSize: '12px', color: 'var(--color-success)', marginTop: '4px' }}>Tỷ lệ sống đạt 99.66%</div>
            </div>
            <div className="farmshift-card" style={{ margin: 0, padding: '20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-muted)', fontWeight: 500 }}>ĐANG NUÔI HIỆN TẠI</div>
              <div style={{ fontSize: '28px', fontWeight: 500, color: 'var(--color-ink)', marginTop: '6px' }}>12,450 con</div>
              <div style={{ fontSize: '12px', color: 'var(--color-muted)', marginTop: '4px' }}>5 chuồng đang nuôi</div>
            </div>
          </div>

          <div className="farmshift-card">
            <div className="farmshift-card-header">
              <h3 className="farmshift-card-title">Chi tiết phân bổ và tỷ lệ nuôi sống theo từng chuồng</h3>
            </div>
            <div className="farmshift-table-container" style={{ border: 'none' }}>
              <table className="farmshift-table">
                <thead>
                  <tr>
                    <th>Chuồng</th>
                    <th>Giống gà</th>
                    <th>Nhập đàn ban đầu</th>
                    <th>Hao hụt lũy kế</th>
                    <th>Đã xuất bán</th>
                    <th>Đang nuôi hiện tại</th>
                    <th>Tỷ lệ nuôi sống</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Nhà J1</strong></td>
                    <td>Gà J-Dabaco</td>
                    <td>2,500 con</td>
                    <td>10 con</td>
                    <td>1,200 con</td>
                    <td><strong style={{ color: 'var(--color-ink)' }}>1,290 con</strong></td>
                    <td><span className="farmshift-badge farmshift-badge-success">99.6%</span></td>
                  </tr>
                  <tr>
                    <td><strong>Nhà J2</strong></td>
                    <td>Gà J-Dabaco</td>
                    <td>2,500 con</td>
                    <td>12 con</td>
                    <td>0 con</td>
                    <td><strong style={{ color: 'var(--color-ink)' }}>2,488 con</strong></td>
                    <td><span className="farmshift-badge farmshift-badge-success">99.5%</span></td>
                  </tr>
                  <tr>
                    <td><strong>Nhà Mía 1</strong></td>
                    <td>Gà Mía Dabaco</td>
                    <td>2,000 con</td>
                    <td>8 con</td>
                    <td>800 con</td>
                    <td><strong style={{ color: 'var(--color-ink)' }}>1,192 con</strong></td>
                    <td><span className="farmshift-badge farmshift-badge-success">99.6%</span></td>
                  </tr>
                  <tr>
                    <td><strong>Nhà Mía 2</strong></td>
                    <td>Gà Mía Dabaco</td>
                    <td>2,000 con</td>
                    <td>10 con</td>
                    <td>0 con</td>
                    <td><strong style={{ color: 'var(--color-ink)' }}>1,990 con</strong></td>
                    <td><span className="farmshift-badge farmshift-badge-success">99.5%</span></td>
                  </tr>
                  <tr>
                    <td><strong>Nhà A1</strong></td>
                    <td>Gà lai chọi</td>
                    <td>2,900 con</td>
                    <td>5 con</td>
                    <td>0 con</td>
                    <td><strong style={{ color: 'var(--color-ink)' }}>2,895 con</strong></td>
                    <td><span className="farmshift-badge farmshift-badge-success">99.8%</span></td>
                  </tr>
                  <tr>
                    <td><strong>Nhà A2</strong></td>
                    <td>Gà lai chọi</td>
                    <td>2,600 con</td>
                    <td>5 con</td>
                    <td>0 con</td>
                    <td><strong style={{ color: 'var(--color-ink)' }}>2,595 con</strong></td>
                    <td><span className="farmshift-badge farmshift-badge-success">99.8%</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 2: Báo cáo bán hàng ──────────────────────── */}
      {activeTab === 'sales' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Doanh thu bán gà thịt thương phẩm</h3>
          </div>
          <div className="farmshift-card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div style={{ padding: '16px', borderRadius: 'var(--rounded-md)', backgroundColor: 'var(--color-surface-soft)', border: '1px solid var(--color-hairline)' }}>
                <div style={{ fontSize: '13px', color: 'var(--color-muted)' }}>Tổng doanh thu thực tế</div>
                <div style={{ fontSize: '28px', fontWeight: 500, color: 'var(--color-ink)', marginTop: '4px' }}>336,360,000 đ</div>
                <div style={{ fontSize: '12px', color: 'var(--color-muted)', marginTop: '2px' }}>Đã thu tiền: 291,880,000 đ · Còn nợ: 44,480,000 đ</div>
              </div>
              <div style={{ padding: '16px', borderRadius: 'var(--rounded-md)', backgroundColor: 'var(--color-surface-soft)', border: '1px solid var(--color-hairline)' }}>
                <div style={{ fontSize: '13px', color: 'var(--color-muted)' }}>Tổng khối lượng xuất bán</div>
                <div style={{ fontSize: '28px', fontWeight: 500, color: 'var(--color-primary)', marginTop: '4px' }}>4,180 kg</div>
                <div style={{ fontSize: '12px', color: 'var(--color-muted)', marginTop: '2px' }}>Đơn giá trung bình: 80,468 đ/kg</div>
              </div>
            </div>

            <div className="farmshift-table-container" style={{ border: 'none' }}>
              <table className="farmshift-table">
                <thead>
                  <tr>
                    <th>Mã đơn</th>
                    <th>Khách hàng</th>
                    <th>Kho hàng</th>
                    <th>Tổng tiền</th>
                    <th>Thanh toán</th>
                    <th>NV Tạo đơn</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong style={{ color: 'var(--color-link)', fontFamily: 'monospace' }}>DH000001</strong></td>
                    <td><strong>Thương lái Tuấn (Hà Nội)</strong></td>
                    <td>Kho Con giống & Thành phẩm</td>
                    <td><strong>196,800,000 đ</strong></td>
                    <td><span className="farmshift-badge farmshift-badge-success">Đã thanh toán đủ</span></td>
                    <td>Nguyen Hiep</td>
                  </tr>
                  <tr>
                    <td><strong style={{ color: 'var(--color-link)', fontFamily: 'monospace' }}>DH000002</strong></td>
                    <td><strong>Hợp tác xã Gia Cầm Yên Thế</strong></td>
                    <td>Kho Con giống & Thành phẩm</td>
                    <td><strong>139,560,000 đ</strong></td>
                    <td><span className="farmshift-badge farmshift-badge-warning">Còn nợ 44.48 tr</span></td>
                    <td>Nguyen Hiep</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 3: Báo cáo nhập hàng ─────────────────────── */}
      {activeTab === 'purchases' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Chi phí nhập hàng & vật tư theo đối tác</h3>
          </div>
          <div className="farmshift-card-body">
            <div style={{ padding: '16px', borderRadius: 'var(--rounded-md)', backgroundColor: 'var(--color-surface-soft)', border: '1px solid var(--color-hairline)', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', color: 'var(--color-muted)' }}>Tổng giá trị vật tư đã mua</div>
              <div style={{ fontSize: '28px', fontWeight: 500, color: 'var(--color-ink)', marginTop: '4px' }}>281,810,000 đ</div>
              <div style={{ fontSize: '12px', color: 'var(--color-muted)', marginTop: '2px' }}>Gồm: Cám (180.75 tr) + Con giống (92.5 tr) + Thuốc thú y (8.56 tr)</div>
            </div>

            <div className="farmshift-table-container" style={{ border: 'none' }}>
              <table className="farmshift-table">
                <thead>
                  <tr>
                    <th>Mã đơn</th>
                    <th>Nhà cung cấp</th>
                    <th>Kho hàng</th>
                    <th>Tổng tiền</th>
                    <th>Thanh toán</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong style={{ color: 'var(--color-link)', fontFamily: 'monospace' }}>NH000000</strong></td>
                    <td>Công ty Cổ phần Chăn nuôi C.P. Việt Nam</td>
                    <td>Kho Cám & Thức ăn</td>
                    <td><strong>18,000,000 đ</strong></td>
                    <td><span className="farmshift-badge farmshift-badge-success">Đã thanh toán</span></td>
                  </tr>
                  <tr>
                    <td><strong style={{ color: 'var(--color-link)', fontFamily: 'monospace' }}>NH000001</strong></td>
                    <td>Tập đoàn DABACO Việt Nam</td>
                    <td>Kho Cám & Thức ăn</td>
                    <td><strong>227,250,000 đ</strong></td>
                    <td><span className="farmshift-badge farmshift-badge-success">Đã thanh toán</span></td>
                  </tr>
                  <tr>
                    <td><strong style={{ color: 'var(--color-link)', fontFamily: 'monospace' }}>NH000002</strong></td>
                    <td>Công ty Thuốc Thú Y Hanvet</td>
                    <td>Kho Thuốc thú y</td>
                    <td><strong>2,560,000 đ</strong></td>
                    <td><span className="farmshift-badge farmshift-badge-success">Đã thanh toán</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 4: Báo cáo tồn kho ───────────────────────── */}
      {activeTab === 'inventory' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Báo cáo kiểm kê tài sản tồn kho hiện tại</h3>
          </div>
          <div className="farmshift-card-body">
            <div style={{ fontSize: '28px', fontWeight: 500, color: 'var(--color-ink)', marginBottom: '8px' }}>
              184,520,000 đ
            </div>
            <div style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '16px' }}>
              Ước tính giá trị tồn kho cám các loại (455 bao), vắc-xin bảo quản lạnh, thuốc dự phòng và hóa chất
            </div>

            <div className="farmshift-table-container" style={{ border: 'none' }}>
              <table className="farmshift-table">
                <thead>
                  <tr>
                    <th>Mã hàng</th>
                    <th>Tên hàng hóa</th>
                    <th>Đầu kỳ</th>
                    <th>Nhập kho</th>
                    <th>Xuất kho</th>
                    <th>Cuối kỳ</th>
                    <th>Giá trị ước tính</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><span style={{ fontFamily: 'monospace' }}>SP000001</span></td>
                    <td><strong>Higro 01 (Cám gà con)</strong></td>
                    <td>50 bao</td>
                    <td>200 bao</td>
                    <td>130 bao</td>
                    <td><strong style={{ color: 'var(--color-ink)' }}>120 bao</strong></td>
                    <td>43,200,000 đ</td>
                  </tr>
                  <tr>
                    <td><span style={{ fontFamily: 'monospace' }}>SP000002</span></td>
                    <td><strong>Higro 02 (Cám giai đoạn 2)</strong></td>
                    <td>80 bao</td>
                    <td>350 bao</td>
                    <td>250 bao</td>
                    <td><strong style={{ color: 'var(--color-ink)' }}>180 bao</strong></td>
                    <td>63,900,000 đ</td>
                  </tr>
                  <tr>
                    <td><span style={{ fontFamily: 'monospace' }}>SP000005</span></td>
                    <td><strong>Higro 03 (Vỗ béo)</strong></td>
                    <td>30 bao</td>
                    <td>250 bao</td>
                    <td>125 bao</td>
                    <td><strong style={{ color: 'var(--color-ink)' }}>155 bao</strong></td>
                    <td>55,800,000 đ</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 5: Báo cáo sổ quỹ ────────────────────────── */}
      {activeTab === 'cashbook' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Dòng tiền lưu chuyển trang trại</h3>
          </div>
          <div className="farmshift-card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div style={{ padding: '16px', borderRadius: 'var(--rounded-md)', backgroundColor: 'var(--color-surface-soft)', border: '1px solid var(--color-hairline)' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>Dòng tiền vào</div>
                <div style={{ fontSize: '22px', fontWeight: 500, color: 'var(--color-success)', marginTop: '4px' }}>+291,880,000 đ</div>
              </div>
              <div style={{ padding: '16px', borderRadius: 'var(--rounded-md)', backgroundColor: 'var(--color-surface-soft)', border: '1px solid var(--color-hairline)' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>Dòng tiền ra</div>
                <div style={{ fontSize: '22px', fontWeight: 500, color: 'var(--color-signature-coral)', marginTop: '4px' }}>-34,760,000 đ</div>
              </div>
              <div style={{ padding: '16px', borderRadius: 'var(--rounded-md)', backgroundColor: 'var(--color-surface-soft)', border: '1px solid var(--color-hairline)' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>Dòng tiền thuần</div>
                <div style={{ fontSize: '22px', fontWeight: 500, color: 'var(--color-primary)', marginTop: '4px' }}>+257,120,000 đ</div>
              </div>
            </div>

            <div className="farmshift-table-container" style={{ border: 'none' }}>
              <table className="farmshift-table">
                <thead>
                  <tr>
                    <th>Nguồn quỹ</th>
                    <th>Dư đầu kỳ</th>
                    <th>Tổng Thu</th>
                    <th>Tổng Chi</th>
                    <th>Tồn cuối kỳ</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Tài khoản MB Bank (FarmShift)</strong></td>
                    <td>15,000,000 đ</td>
                    <td>260,000,000 đ</td>
                    <td>25,000,000 đ</td>
                    <td><strong style={{ color: 'var(--color-ink)' }}>250,000,000 đ</strong></td>
                  </tr>
                  <tr>
                    <td><strong>Quỹ tiền mặt tại trang trại</strong></td>
                    <td>5,000,000 đ</td>
                    <td>31,880,000 đ</td>
                    <td>9,760,000 đ</td>
                    <td><strong style={{ color: 'var(--color-ink)' }}>27,120,000 đ</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 6: Báo cáo thu hoạch ─────────────────────── */}
      {activeTab === 'harvest' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Sản lượng thịt thu hoạch phân loại</h3>
          </div>
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th>Lứa / Chuồng</th>
                  <th>Số con thu hoạch</th>
                  <th>Gà loại 1</th>
                  <th>Gà loại 2</th>
                  <th>Tổng kg thịt</th>
                  <th>Tỷ lệ gà loại 1</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Nhà J1 (Gà J-Dabaco)</strong></td>
                  <td>1,200 con</td>
                  <td>2,200 kg</td>
                  <td>260 kg</td>
                  <td>2,460 kg</td>
                  <td><span className="farmshift-badge farmshift-badge-success">89.4%</span></td>
                </tr>
                <tr>
                  <td><strong>Nhà Mía 1 (Gà Mía)</strong></td>
                  <td>800 con</td>
                  <td>1,520 kg</td>
                  <td>200 kg</td>
                  <td>1,720 kg</td>
                  <td><span className="farmshift-badge farmshift-badge-success">88.3%</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 7: Xu hướng lứa nuôi (FCR) ───────────────── */}
      {activeTab === 'growth' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Hệ số chuyển đổi thức ăn (FCR) & Tốc độ tăng trọng</h3>
          </div>
          <div className="farmshift-card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              <div style={{ border: '1px solid var(--color-hairline)', padding: '20px', borderRadius: 'var(--rounded-lg)' }}>
                <div style={{ fontSize: '13px', color: 'var(--color-muted)', fontWeight: 500 }}>LỨA J-DABACO (45 NGÀY TUỔI)</div>
                <div style={{ fontSize: '32px', fontWeight: 500, color: 'var(--color-primary)', marginTop: '8px' }}>FCR: 2.15</div>
                <div style={{ fontSize: '13px', color: 'var(--color-success)', marginTop: '4px' }}>✓ Đạt chuẩn giống (Chuẩn Dabaco: 2.20)</div>
                <div style={{ fontSize: '13px', color: 'var(--color-body)', marginTop: '12px', lineHeight: 1.6 }}>
                  • Trọng lượng TB: <strong>1.65 kg / con</strong><br />
                  • Tiêu thụ cám lũy kế: <strong>3.55 kg / con</strong><br />
                  • Tăng trọng bình quân ngày (ADG): <strong>36.6 g / ngày</strong>
                </div>
              </div>

              <div style={{ border: '1px solid var(--color-hairline)', padding: '20px', borderRadius: 'var(--rounded-lg)' }}>
                <div style={{ fontSize: '13px', color: 'var(--color-muted)', fontWeight: 500 }}>LỨA GÀ MÍA (60 NGÀY TUỔI)</div>
                <div style={{ fontSize: '32px', fontWeight: 500, color: 'var(--color-primary)', marginTop: '8px' }}>FCR: 2.38</div>
                <div style={{ fontSize: '13px', color: 'var(--color-success)', marginTop: '4px' }}>✓ Đạt chuẩn gà thịt đặc sản</div>
                <div style={{ fontSize: '13px', color: 'var(--color-body)', marginTop: '12px', lineHeight: 1.6 }}>
                  • Trọng lượng TB: <strong>2.08 kg / con</strong><br />
                  • Tiêu thụ cám lũy kế: <strong>4.95 kg / con</strong><br />
                  • Tăng trọng bình quân ngày (ADG): <strong>34.6 g / ngày</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 8: Báo cáo xuất nhập nội bộ (Báo cáo xuất nhập nội bộ.html) ── */}
      {activeTab === 'internal' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Thống kê luân chuyển vật tư nội bộ giữa các kho và chuồng</h3>
          </div>
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th>Mã phiếu</th>
                  <th>Hàng hóa</th>
                  <th>Đơn vị tính</th>
                  <th>Số lượng</th>
                  <th>Đơn giá</th>
                  <th>Thành tiền</th>
                  <th>Kho xuất</th>
                  <th>Kho nhập / Nơi nhận</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong style={{ fontFamily: 'monospace', color: 'var(--color-link)' }}>EC000000</strong></td>
                  <td>Paracetamol C bột</td>
                  <td>Gói (1kg)</td>
                  <td>10</td>
                  <td>110,000 đ</td>
                  <td><strong>1,100,000 đ</strong></td>
                  <td>Kho Thuốc thú y</td>
                  <td>Khu J Thịt - Nhà B1</td>
                </tr>
                <tr>
                  <td><strong style={{ fontFamily: 'monospace', color: 'var(--color-link)' }}>CK000005</strong></td>
                  <td>Cám Higro 02</td>
                  <td>Bao (25kg)</td>
                  <td>40</td>
                  <td>355,000 đ</td>
                  <td><strong>14,200,000 đ</strong></td>
                  <td>Kho Cám & Thức ăn</td>
                  <td>Kho đệm Nhà A (Khu Mía Thịt)</td>
                </tr>
                <tr>
                  <td><strong style={{ fontFamily: 'monospace', color: 'var(--color-link)' }}>IC000001</strong></td>
                  <td>Cám Higro 01</td>
                  <td>Bao (25kg)</td>
                  <td>250</td>
                  <td>360,000 đ</td>
                  <td><strong>90,000,000 đ</strong></td>
                  <td>Kiểm kê cân bằng</td>
                  <td>Kho Cám & Thức ăn</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 9: Báo cáo hoạt động / Audit trail (Báo cáo hoạt động.html) ── */}
      {activeTab === 'activity' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Nhật ký truy vết thao tác & bảo mật nhân sự</h3>
          </div>
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Nhân công</th>
                  <th>Nhóm chức năng</th>
                  <th>Thao tác</th>
                  <th>Nội dung chi tiết</th>
                  <th>Địa chỉ IP</th>
                  <th>Thiết bị</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>07/10/2026 14:32:10</td>
                  <td><strong>Nguyen Hiep</strong></td>
                  <td><span className="farmshift-badge farmshift-badge-neutral">Ghi nhật ký</span></td>
                  <td>Cập nhật</td>
                  <td>Ghi nhận cho ăn 50kg cám tại Nhà A1</td>
                  <td>192.168.1.102</td>
                  <td>Chrome / Windows 11</td>
                </tr>
                <tr>
                  <td>07/10/2026 11:15:45</td>
                  <td><strong>Nguyen Thi Thu Ha</strong></td>
                  <td><span className="farmshift-badge farmshift-badge-neutral">Sổ quỹ</span></td>
                  <td>Tạo mới</td>
                  <td>Lập phiếu thu tiền bán gà số DH000001 (196.8 tr)</td>
                  <td>192.168.1.105</td>
                  <td>Safari / iOS</td>
                </tr>
                <tr>
                  <td>06/10/2026 16:40:22</td>
                  <td><strong>Tran Van Nam</strong></td>
                  <td><span className="farmshift-badge farmshift-badge-neutral">Xuất nhập nội bộ</span></td>
                  <td>Xuất kho</td>
                  <td>Tạo phiếu xuất kho số EC000000 (10 gói Paracetamol C)</td>
                  <td>192.168.1.110</td>
                  <td>Chrome / Android</td>
                </tr>
                <tr>
                  <td>06/10/2026 09:20:18</td>
                  <td><strong>Nguyen Hiep</strong></td>
                  <td><span className="farmshift-badge farmshift-badge-neutral">Bán hàng</span></td>
                  <td>Tạo đơn bán</td>
                  <td>Lập đơn xuất bán thương lái Tuấn 2,460 kg gà Nhà J1</td>
                  <td>192.168.1.102</td>
                  <td>Chrome / Windows 11</td>
                </tr>
                <tr>
                  <td>05/10/2026 08:00:00</td>
                  <td><strong>Nguyen Hiep</strong></td>
                  <td><span className="farmshift-badge farmshift-badge-neutral">Hệ thống</span></td>
                  <td>Đăng nhập</td>
                  <td>Đăng nhập phiên làm việc tài khoản Admin</td>
                  <td>192.168.1.102</td>
                  <td>Chrome / Windows 11</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </FarmShiftLayout>
  );
};
