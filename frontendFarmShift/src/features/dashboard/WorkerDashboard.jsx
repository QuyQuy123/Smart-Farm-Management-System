// src/features/dashboard/WorkerDashboard.jsx
// Công nhân Dashboard — Exact FarmShift.html UI/UX Clone
import React from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import {
  Bird, CheckSquare, Thermometer, TrendingUp,
  Plus, Mic
} from 'lucide-react';

export const WorkerDashboard = () => {
  const BREADCRUMBS = [{ label: 'FarmShift' }, { label: 'Trang chủ' }];

  const kpis = [
    { title: 'Đàn phụ trách', value: '1.498', unit: 'con', icon: Bird },
    { title: 'Hoàn thành', value: '1/3', unit: 'công việc', icon: CheckSquare },
    { title: 'Nhiệt độ', value: '30,1', unit: '°C · mẫu lúc 09:20', icon: Thermometer },
    { title: 'Ngày tuổi', value: '21', unit: 'ngày', icon: TrendingUp },
  ];

  const tasks = [
    { name: 'Cho ăn buổi sáng', coop: 'B6', time: '07:00', status: 'Hoàn thành' },
    { name: 'Cân mẫu định kỳ', coop: 'B6', time: '10:00', status: 'Chưa bắt đầu' },
    { name: 'Vệ sinh lối đi chuồng', coop: 'B6', time: '14:00', status: 'Đang thực hiện' },
  ];

  return (
    <DashboardLayout breadcrumbs={BREADCRUMBS} pageTitle="Trang chủ">
      {/* ── Note banner (Exact FarmShift.html) ─────────────── */}
      <div className="note">
        Chào Bình, hôm nay có 3 công việc tại chuồng B6. Anh có thể ghi nhật ký trực tiếp từ Ghi nhanh.
      </div>

      {/* ── Actions ────────────────────────────────────────── */}
      <div className="actions" style={{ marginBottom: 20 }}>
        <Link to="/worker-dashboard/log" className="btn primary">
          ＋ Ghi nhanh
        </Link>
        <button
          className="btn"
          onClick={() => alert('Ghi âm bằng giọng nói: tính năng mô phỏng.')}
        >
          <Mic size={16} /> Nhập bằng giọng nói
        </button>
      </div>

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

      {/* ── Công việc hôm nay (Task Table) ────────────────── */}
      <section className="card">
        <h2>Công việc hôm nay</h2>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Công việc</th>
                <th>Chuồng</th>
                <th>Giờ</th>
                <th>Trạng thái</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t, idx) => (
                <tr key={idx}>
                  <td><b>{t.name}</b></td>
                  <td>{t.coop}</td>
                  <td>{t.time}</td>
                  <td>
                    <span className={`badge ${t.status === 'Hoàn thành' ? '' : 'warn'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="num">
                    <button className="btn small">
                      {t.status === 'Chưa bắt đầu' ? 'Bắt đầu' : 'Chi tiết'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Chuồng phụ trách ──────────────────────────────── */}
      <div className="grid two">
        <div className="card coop">
          <span className="temp">30,1°C</span>
          <h2>Chuồng B6</h2>
          <span className="badge">Đang nuôi</span>
          <p className="muted">MB-2026-08 · Gà lông màu</p>

          <div className="row">
            <span>Tổng đàn</span>
            <strong>1.498 con</strong>
          </div>
          <div className="row">
            <span>Người phụ trách</span>
            <span>Trần Văn Bình</span>
          </div>

          <div className="progress">
            <i style={{ width: '74.9%' }} />
          </div>
          <small>Sức chứa 2.000 con (74.9%)</small>

          <div style={{ marginTop: 16 }}>
            <Link to="/worker-dashboard/log" className="btn primary">
              Ghi nhật ký chuồng B6
            </Link>
          </div>
        </div>

        <div className="card">
          <h2>Thao tác nhanh tại chuồng</h2>
          <div className="quick">
            <Link to="/worker-dashboard/log" className="btn">
              Cho ăn
            </Link>
            <Link to="/worker-dashboard/log" className="btn">
              Hao hụt
            </Link>
            <Link to="/worker-dashboard/log" className="btn">
              Cân mẫu
            </Link>
            <Link to="/worker-dashboard/log" className="btn">
              Thuốc / Vac
            </Link>
            <Link to="/worker-dashboard/log" className="btn">
              Sức khỏe
            </Link>
            <Link to="/worker-dashboard/log" className="btn">
              Công việc
            </Link>
          </div>
          <div className="note" style={{ marginTop: 12 }}>
            Nhật ký ghi nhận sử dụng thực tế; xuất kho được theo dõi bằng phiếu riêng để tránh trừ tồn hai lần.
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
