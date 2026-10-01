// src/features/dashboard/OwnerDashboard.jsx
// Farm Owner Dashboard — Exact FarmShift.html UI/UX Clone
import React from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import {
  Bird, TrendingUp, Warehouse, DollarSign,
  AlertTriangle, CheckCircle, Clock
} from 'lucide-react';

export const OwnerDashboard = () => {
  const BREADCRUMBS = [{ label: 'FarmShift' }, { label: 'Tổng quan' }];

  const kpiData = [
    { title: 'Tổng đàn hiện tại', value: '2.998', unit: 'con · 1 lứa đang nuôi', icon: Bird },
    { title: 'Tỷ lệ sống', value: '99.93%', unit: 'hao hụt đầu kỳ 2 con', icon: TrendingUp },
    { title: 'Chuồng đang nuôi', value: '2/2', unit: 'chuồng', icon: Warehouse },
    { title: 'Chi phí đã ghi', value: '70.000.000 ₫', unit: 'lứa MB-2026-08', icon: DollarSign },
  ];

  const coops = [
    { id: 'B5', n: 1500, temp: 29.2, worker: 'Nguyễn Văn An', capacity: 2000 },
    { id: 'B6', n: 1498, temp: 30.1, worker: 'Trần Văn Bình', capacity: 2000 },
  ];

  const alerts = [
    { name: 'Vitamin bổ sung sắp hết hạn', detail: 'Lô BS-0926 · 10 gói · HSD 05/11/2026', status: 'Mới' },
    { name: 'Tồn dung dịch vệ sinh thấp', detail: '20 lít / mức tối thiểu 30 lít', status: 'Đang xử lý' },
  ];

  const tasks = [
    { name: 'Cho ăn buổi sáng', coop: 'B6', time: '07:00', status: 'Hoàn thành' },
    { name: 'Cân mẫu định kỳ', coop: 'B6', time: '10:00', status: 'Chưa bắt đầu' },
    { name: 'Vệ sinh lối đi chuồng', coop: 'B5', time: '14:00', status: 'Đang thực hiện' },
  ];

  const logs = [
    { date: '2026-10-21', time: '07:00', coop: 'B6', type: 'Cho ăn', amount: '60 kg', note: 'Thức ăn tăng trưởng', person: 'Trần Văn Bình' },
    { date: '2026-10-21', time: '09:15', coop: 'B6', type: 'Hao hụt', amount: '2 con', note: 'Đã báo chủ trại, chờ xác minh nguyên nhân', person: 'Trần Văn Bình' },
    { date: '2026-10-21', time: '10:00', coop: 'B5', type: 'Cân mẫu', amount: '460 g/con', note: '30 mẫu, tổng 13,8 kg', person: 'Nguyễn Văn An' },
  ];

  return (
    <DashboardLayout breadcrumbs={BREADCRUMBS} pageTitle="Tổng quan">
      {/* ── 4 KPI Cards (Exact FarmShift.html) ────────────── */}
      <div className="grid four">
        {kpiData.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <div key={i} className="card kpi">
              <span className="round">
                <Icon size={22} />
              </span>
              <div>
                <span className="muted">{kpi.title}</span>
                <strong>{kpi.value}</strong>
                <small>{kpi.unit}</small>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Grid 2 columns: Chart + Alerts ────────────────── */}
      <div className="grid two">
        {/* Tăng trưởng của lứa */}
        <section className="card">
          <h2>Tăng trưởng của lứa</h2>
          <div className="legend">
            <span><i className="dot"></i>Thực tế</span>
            <span><i className="dot" style={{ background: '#a9bbad' }}></i>Mục tiêu</span>
          </div>

          <svg
            className="chart"
            viewBox="0 0 600 190"
            role="img"
            aria-label="Cân nặng ngày 1, 7, 14, 21: thực tế 45, 130, 290, 450 gram; mục tiêu 45, 140, 300, 470 gram"
          >
            <g stroke="#e7eee8">
              <path d="M45 20H580M45 60H580M45 100H580M45 140H580" />
            </g>
            <g fill="#84948b" fontSize="11">
              <text x="5" y="25">500 g</text>
              <text x="12" y="145">0 g</text>
              <text x="40" y="178">Ngày 1</text>
              <text x="205" y="178">Ngày 7</text>
              <text x="365" y="178">Ngày 14</text>
              <text x="530" y="178">Ngày 21</text>
            </g>
            <path
              d="M50 129 220 106 390 68 555 27"
              fill="none"
              stroke="#a9bbad"
              strokeWidth="3"
              strokeDasharray="6 6"
            />
            <path
              d="M50 129 220 109 390 70 555 32"
              fill="none"
              stroke="#367957"
              strokeWidth="3"
            />
            <g fill="#367957">
              <circle cx="50" cy="129" r="4" />
              <circle cx="220" cy="109" r="4" />
              <circle cx="390" cy="70" r="4" />
              <circle cx="555" cy="32" r="4" />
            </g>
          </svg>

          <div style={{ marginTop: 16 }}>
            <Link to="/owner-dashboard/batches" className="btn">
              Xem tăng trưởng
            </Link>
          </div>
        </section>

        {/* Cần chú ý (Alerts) */}
        <section className="card">
          <h2>Cần chú ý</h2>
          {alerts.map((a, i) => (
            <div key={i} className="row">
              <div>
                <b>{a.name}</b>
                <p><small>{a.detail}</small></p>
              </div>
              <span className={`badge ${a.status === 'Mới' ? 'warn' : ''}`}>
                {a.status}
              </span>
            </div>
          ))}

          <div className="note" style={{ marginTop: 18 }}>
            Môi trường được mô phỏng tại thời điểm 21/10/2026; không phải dữ liệu trực tiếp.
          </div>
        </section>
      </div>

      {/* ── Coop Cards (Chuồng nuôi) ──────────────────────── */}
      <div className="grid three">
        {coops.map(c => {
          const pct = Math.min((c.n / c.capacity) * 100, 100);
          return (
            <div key={c.id} className="card coop">
              <span className="temp">{c.temp}°C</span>
              <h2>Chuồng {c.id}</h2>
              <span className="badge">Đang nuôi</span>
              <p className="muted">MB-2026-08 · Gà lông màu</p>

              <div className="row">
                <span>Tổng đàn</span>
                <strong>{c.n.toLocaleString('vi-VN')} con</strong>
              </div>
              <div className="row">
                <span>Người phụ trách</span>
                <span>{c.worker}</span>
              </div>

              <div className="progress">
                <i style={{ width: `${pct}%` }} />
              </div>
              <small>Sức chứa {c.capacity.toLocaleString('vi-VN')} con ({pct.toFixed(1)}%)</small>

              <div style={{ marginTop: 16 }}>
                <Link to="/owner-dashboard/barns" className="btn">
                  Xem chi tiết
                </Link>
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
                    <Link to="/owner-dashboard/batches" className="btn small">
                      Chi tiết
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Nhật ký gần đây ───────────────────────────────── */}
      <section className="card">
        <h2>Nhật ký chăn nuôi gần đây</h2>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Ngày / Giờ</th>
                <th>Hoạt động</th>
                <th>Chuồng</th>
                <th>Giá trị</th>
                <th>Ghi chú</th>
                <th>Người ghi</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l, idx) => (
                <tr key={idx}>
                  <td>{l.date} {l.time}</td>
                  <td><span className="badge gray">{l.type}</span></td>
                  <td>{l.coop}</td>
                  <td><b>{l.amount}</b></td>
                  <td>{l.note}</td>
                  <td>{l.person}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardLayout>
  );
};
