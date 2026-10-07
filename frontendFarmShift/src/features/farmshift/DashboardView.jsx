// src/features/farmshift/DashboardView.jsx
// Bảng tin - Dashboard trang chủ chuẩn FarmShift theo tiêu chuẩn DESIGN.md
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, AlertTriangle, CheckCircle2, ChevronRight,
  Plus, FileText, ShoppingCart, DollarSign, ArrowUpRight,
  Layers, Package, Warehouse, HelpCircle, X, Sparkles, Activity
} from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { INITIAL_FARMSHIFT_DATA } from '../../data/farmshiftMockData';

export const DashboardView = () => {
  const [data] = useState(INITIAL_FARMSHIFT_DATA);
  const [showWizard, setShowWizard] = useState(true);

  const wizardSteps = [
    { num: 1, title: 'Tìm hiểu cách sử dụng', done: true, link: '#' },
    { num: 2, title: 'Tạo hạ tầng nuôi', done: true, link: '/areas' },
    { num: 3, title: 'Thiết lập Kho hàng', done: true, link: '/inventory' },
    { num: 4, title: 'Nhập hàng về kho', done: true, link: '/purchases' },
    { num: 5, title: 'Nhập kho đầu kỳ', done: true, link: '/transfers' },
    { num: 6, title: 'Nhập đàn - Vào giống', done: true, link: '/areas' },
    { num: 7, title: 'Ghi nhật ký', done: true, link: '/journal' },
    { num: 8, title: 'Tạo phiếu chi vào lứa nuôi', done: false, link: '/cashbook' },
  ];

  // Flatten active barns
  const activeBarns = data.areas.flatMap(a =>
    a.barns.filter(b => b.status === 'Đang nuôi').map(b => ({ ...b, areaName: a.name }))
  );

  return (
    <FarmShiftLayout pageTitle="Bảng tin tổng quan" showShortcuts={true}>
      {/* ── DESIGN.md Signature Cream Callout (Wizard) ────── */}
      {showWizard && (
        <div className="signature-cream-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle2 size={20} color="var(--color-primary)" />
              <strong style={{ fontSize: '16px', color: 'var(--color-ink)' }}>
                Quy trình vận hành & thiết lập trang trại chuẩn
              </strong>
            </div>
            <button
              onClick={() => setShowWizard(false)}
              style={{ background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
            {wizardSteps.map(step => (
              <Link
                key={step.num}
                to={step.link}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 14px',
                  borderRadius: 'var(--rounded-md)',
                  backgroundColor: step.done ? 'var(--color-canvas)' : 'rgba(255, 255, 255, 0.6)',
                  border: `1px solid ${step.done ? 'var(--color-hairline)' : 'transparent'}`,
                  textDecoration: 'none',
                  color: step.done ? 'var(--color-ink)' : 'var(--color-muted)',
                  fontSize: '13px',
                  fontWeight: 500
                }}
              >
                <span
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: 'var(--rounded-full)',
                    backgroundColor: step.done ? 'var(--color-primary)' : 'var(--color-hairline)',
                    color: step.done ? '#ffffff' : 'var(--color-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    flexShrink: 0
                  }}
                >
                  {step.done ? '✓' : step.num}
                </span>
                <span>{step.num}. {step.title}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── KPI Summary Cards (DESIGN.md Editorial Clean) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="farmshift-card" style={{ margin: 0, padding: '20px' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-muted)', fontWeight: 500, letterSpacing: '0.04em' }}>
            TỔNG ĐÀN HIỆN TẠI
          </div>
          <div style={{ fontSize: '32px', fontWeight: 500, color: 'var(--color-ink)', marginTop: '8px', lineHeight: 1 }}>
            {data.farmInfo.currentFlockTotal.toLocaleString('vi-VN')} <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--color-muted)' }}>con</span>
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--color-muted)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Warehouse size={14} /> {activeBarns.length} chuồng đang nuôi ({data.areas.length} khu trại)
          </div>
        </div>

        <div className="farmshift-card" style={{ margin: 0, padding: '20px' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-muted)', fontWeight: 500, letterSpacing: '0.04em' }}>
            CÁM TIÊU THỤ HÔM NAY
          </div>
          <div style={{ fontSize: '32px', fontWeight: 500, color: 'var(--color-ink)', marginTop: '8px', lineHeight: 1 }}>
            711 <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--color-muted)' }}>kg</span>
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--color-muted)', marginTop: '8px' }}>
            Định mức 57.1g / con / ngày
          </div>
        </div>

        <div className="farmshift-card" style={{ margin: 0, padding: '20px' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-muted)', fontWeight: 500, letterSpacing: '0.04em' }}>
            HAO HỤT TRONG NGÀY
          </div>
          <div style={{ fontSize: '32px', fontWeight: 500, color: 'var(--color-ink)', marginTop: '8px', lineHeight: 1 }}>
            3 <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--color-muted)' }}>con (0.02%)</span>
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--color-success)', marginTop: '8px' }}>
            ✓ Tỷ lệ an toàn trong ngưỡng &lt; 0.05%
          </div>
        </div>

        <div className="farmshift-card" style={{ margin: 0, padding: '20px' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-muted)', fontWeight: 500, letterSpacing: '0.04em' }}>
            SỐ DƯ QUỸ RÒNG
          </div>
          <div style={{ fontSize: '32px', fontWeight: 500, color: 'var(--color-ink)', marginTop: '8px', lineHeight: 1 }}>
            282,120,000 <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--color-muted)' }}>đ</span>
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--color-muted)', marginTop: '8px' }}>
            MB Bank + Tiền mặt tại quỹ
          </div>
        </div>
      </div>

      {/* ── Active Barns Monitoring Table ───────────────── */}
      <div className="farmshift-card">
        <div className="farmshift-card-header">
          <h3 className="farmshift-card-title">
            <Activity size={18} color="var(--color-primary)" />
            Giám sát các chuồng đang nuôi (Real-time IoT & Nhật ký)
          </h3>
          <Link to="/areas" className="farmshift-btn farmshift-btn-secondary" style={{ fontSize: '13px', padding: '6px 14px' }}>
            Xem tất cả khu nuôi ›
          </Link>
        </div>

        <div className="farmshift-table-container" style={{ border: 'none' }}>
          <table className="farmshift-table">
            <thead>
              <tr>
                <th>Chuồng nuôi</th>
                <th>Khu vực</th>
                <th>Số lượng</th>
                <th>Ngày tuổi</th>
                <th>Trọng lượng TB</th>
                <th>Nhiệt độ IoT</th>
                <th>Độ ẩm IoT</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {activeBarns.map(b => (
                <tr key={b.id}>
                  <td>
                    <strong style={{ color: 'var(--color-ink)' }}>{b.name}</strong>
                  </td>
                  <td>{b.areaName}</td>
                  <td><strong>{b.current.toLocaleString()}</strong> con</td>
                  <td>{b.ageDays} ngày</td>
                  <td><span>{b.avgWeight}</span> kg/con</td>
                  <td>
                    <span style={{ color: b.temp > 29 ? 'var(--color-signature-coral)' : 'var(--color-ink)', fontWeight: 500 }}>
                      {b.temp}°C
                    </span>
                  </td>
                  <td>{b.humidity}%</td>
                  <td>
                    <span className="farmshift-badge farmshift-badge-success">
                      {b.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Link
                      to="/journal"
                      className="farmshift-btn farmshift-btn-primary"
                      style={{ fontSize: '12px', padding: '5px 12px' }}
                    >
                      Ghi nhật ký
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Two Column: Recent Transactions & Warehouse Alerts ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        {/* Recent Purchases */}
        <div className="farmshift-card" style={{ margin: 0 }}>
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">
              <FileText size={18} color="var(--color-primary)" />
              Hóa đơn nhập hàng gần nhất
            </h3>
            <Link to="/purchases" style={{ fontSize: '13px', color: 'var(--color-link)', textDecoration: 'none' }}>
              Tất cả ›
            </Link>
          </div>
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Nhà cung cấp</th>
                  <th>Tổng tiền</th>
                  <th>Thanh toán</th>
                </tr>
              </thead>
              <tbody>
                {data.purchases.slice(0, 4).map(p => (
                  <tr key={p.id}>
                    <td><strong style={{ color: 'var(--color-ink)', fontFamily: 'monospace' }}>{p.code}</strong></td>
                    <td>{p.supplier}</td>
                    <td><strong>{p.totalAmount.toLocaleString('vi-VN')} đ</strong></td>
                    <td>
                      <span className={`farmshift-badge ${p.paymentStatus.includes('hoàn tất') ? 'farmshift-badge-success' : 'farmshift-badge-warning'}`}>
                        {p.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Inventory Stock Alerts */}
        <div className="farmshift-card" style={{ margin: 0 }}>
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">
              <Package size={18} color="var(--color-primary)" />
              Tồn kho thức ăn & vật tư thiết yếu
            </h3>
            <Link to="/inventory" style={{ fontSize: '13px', color: 'var(--color-link)', textDecoration: 'none' }}>
              Kho hàng ›
            </Link>
          </div>
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th>Tên hàng hoá</th>
                  <th>Kho</th>
                  <th>Tồn kho</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {data.inventory.filter(i => i.stock > 0).slice(0, 5).map(inv => (
                  <tr key={inv.id}>
                    <td><strong>{inv.name}</strong></td>
                    <td>{inv.warehouse}</td>
                    <td><strong>{inv.stock}</strong> {inv.unit}</td>
                    <td>
                      <span className={`farmshift-badge ${inv.stock <= inv.minThreshold ? 'farmshift-badge-warning' : 'farmshift-badge-info'}`}>
                        {inv.stock <= inv.minThreshold ? 'Chạm ngưỡng' : 'Đầy đủ'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </FarmShiftLayout>
  );
};
