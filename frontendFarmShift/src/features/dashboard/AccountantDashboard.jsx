// src/features/dashboard/AccountantDashboard.jsx
// Kế toán Dashboard — Exact FarmShift.html UI/UX Clone
import React from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import {
  DollarSign, ShoppingCart, TrendingUp, Package,
  FileText, Sparkles, Plus, ArrowUpRight, ArrowDownLeft
} from 'lucide-react';

export const AccountantDashboard = () => {
  const BREADCRUMBS = [{ label: 'FarmShift' }, { label: 'Tổng quan kế toán' }];

  const kpis = [
    { title: 'Tồn quỹ', value: '50.000.000 ₫', unit: 'số dư mẫu', icon: DollarSign },
    { title: 'Phải trả', value: '800.000 ₫', unit: 'nhà cung cấp', icon: ShoppingCart },
    { title: 'Phải thu', value: '20.000.000 ₫', unit: 'khách hàng', icon: TrendingUp },
    { title: 'Tồn kho', value: '30.600.000 ₫', unit: 'giá trị mẫu', icon: Package },
  ];

  const purchases = [
    { id: 'MH-1021-01', party: 'NCC An Phú', amount: '800.000 ₫', stockStatus: 'Chưa nhập', paymentStatus: 'Chưa thanh toán' },
    { id: 'MH-1018-02', party: 'Cám Miền Trung', amount: '12.000.000 ₫', stockStatus: 'Nhập đủ', paymentStatus: 'Đã thanh toán' },
  ];

  const transactions = [
    { id: 'PC-1021-01', date: '21/10/2026', type: 'Chi', ref: 'MH-1018-02', amount: '12.000.000 ₫' },
    { id: 'PT-1020-01', date: '20/10/2026', type: 'Thu', ref: 'BH-1020-01', amount: '35.000.000 ₫' },
    { id: 'PC-1019-01', date: '19/10/2026', type: 'Chi', ref: 'Điện nước tháng 9', amount: '2.500.000 ₫' },
  ];

  return (
    <DashboardLayout breadcrumbs={BREADCRUMBS} pageTitle="Tổng quan kế toán">
      {/* ── 4 KPIs ────────────────────────────────────────── */}
      <div className="grid four">
        {kpis.map((k, i) => {
          const Icon = k.icon;
          return (
            <div key={i} className="card kpi">
              <span className="round">
                <Icon size={22} />
              </span>
              <div>
                <span className="muted">{k.title}</span>
                <strong>{k.value}</strong>
                <small>{k.unit}</small>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Grid 2 columns: Chứng từ + Thao tác ───────────── */}
      <div className="grid two">
        {/* Chứng từ cần xử lý */}
        <section className="card">
          <h2>Chứng từ cần xử lý</h2>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Mã phiếu</th>
                  <th>Nhà cung cấp</th>
                  <th>Tổng tiền</th>
                  <th>Nhập kho</th>
                  <th>Thanh toán</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {purchases.map(p => (
                  <tr key={p.id}>
                    <td><b>{p.id}</b></td>
                    <td>{p.party}</td>
                    <td className="num">{p.amount}</td>
                    <td>
                      <span className={`badge ${p.stockStatus === 'Nhập đủ' ? '' : 'warn'}`}>
                        {p.stockStatus}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${p.paymentStatus === 'Đã thanh toán' ? '' : 'warn'}`}>
                        {p.paymentStatus}
                      </span>
                    </td>
                    <td className="num">
                      <Link to="/accountant-dashboard/orders" className="btn small">
                        Chi tiết
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Thao tác kế toán */}
        <section className="card">
          <h2>Thao tác kế toán</h2>
          <div className="quick">
            <Link to="/accountant-dashboard/orders" className="btn primary">
              Lập phiếu mua
            </Link>
            <Link to="/accountant-dashboard/sales" className="btn">
              Lập phiếu bán
            </Link>
            <Link to="/accountant-dashboard/transactions" className="btn">
              Chi tiền
            </Link>
            <Link to="/accountant-dashboard/transactions" className="btn">
              Thu tiền
            </Link>
            <Link to="/accountant-dashboard/reports" className="btn">
              Đọc hóa đơn AI
            </Link>
          </div>

          <div className="note">
            Theo dõi trạng thái kho và thanh toán độc lập. Phiếu nháp chưa phát sinh dòng tiền.
          </div>
        </section>
      </div>

      {/* ── Thu chi đã ghi nhận ───────────────────────────── */}
      <section className="card">
        <h2>Thu chi đã ghi nhận</h2>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Mã phiếu</th>
                <th>Ngày</th>
                <th>Loại</th>
                <th>Liên kết</th>
                <th className="num">Số tiền</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(t => (
                <tr key={t.id}>
                  <td><b>{t.id}</b></td>
                  <td>{t.date}</td>
                  <td>
                    <span className={`badge ${t.type === 'Thu' ? '' : 'warn'}`}>
                      {t.type}
                    </span>
                  </td>
                  <td>{t.ref}</td>
                  <td className="num"><b>{t.amount}</b></td>
                  <td className="num">
                    <Link to="/accountant-dashboard/transactions" className="btn small">
                      Chi tiết
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardLayout>
  );
};
