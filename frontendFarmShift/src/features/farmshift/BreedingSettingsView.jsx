// src/features/farmshift/BreedingSettingsView.jsx
// Thiết lập chăn nuôi & Quy trình kỹ thuật chuẩn FarmShift & DESIGN.md
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Calendar, ClipboardList, Edit3, FileSpreadsheet, Plus, Target, X } from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { useNotification } from '../../context/NotificationContext';
import { FarmingProgramsPanel } from './FarmingProgramsPanel';
import tabStyles from './BreedingSettingsTabs.module.css';

// A card with `to` opens another screen instead of a tab here: care work is assigned on Việc hôm nay › Phân công.
const SETTING_TABS = [
  { key: 'program', label: 'Chương trình nuôi', sub: 'Cám, vắc-xin, nhiệt độ theo giống', icon: ClipboardList },
  { key: 'tasks', label: 'Công việc & Lịch chăm sóc', sub: 'Phân công chuồng và giao việc cho công nhân', icon: Calendar, to: '/today-tasks?view=assign' },
  { key: 'growth_targets', label: 'Mục tiêu tăng trưởng & Định mức cám', sub: 'Cân nặng, FCR theo ngày tuổi', icon: Target },
];

export const BreedingSettingsView = () => {
  const { showToast } = useNotification();
  const location = useLocation();
  const navigate = useNavigate();

  // The URL is the source of truth: ?tab=… wins, the legacy /growth-targets route still maps to its tab.
  const tabParam = new URLSearchParams(location.search).get('tab');
  const activeTab = SETTING_TABS.some(tab => tab.key === tabParam && !tab.to) ? tabParam
    : location.pathname.includes('growth-targets') ? 'growth_targets' : 'program';
  const openTab = key => navigate(`/breeding-settings?tab=${key}`);

  const [showAddGrowthModal, setShowAddGrowthModal] = useState(false);

  // Mock data for Growth Targets
  const [growthTargets, setGrowthTargets] = useState([
    { id: 'MT001', name: 'Gà Mía thương phẩm (Giai đoạn úm)', from: 1, to: 21, weight: '0.45 kg', feed: '35 g', fcr: '1.25', notes: 'Giai đoạn úm chuồng kín, kiểm soát nhiệt độ nghiêm ngặt' },
    { id: 'MT002', name: 'Gà Mía thương phẩm (Sinh trưởng)', from: 22, to: 50, weight: '1.40 kg', feed: '85 g', fcr: '1.80', notes: 'Thả sân chơi tắm nắng, tăng cơ bắp' },
    { id: 'MT003', name: 'Gà J-Dabaco thương phẩm (Vỗ béo)', from: 51, to: 75, weight: '2.35 kg', feed: '125 g', fcr: '2.10', notes: 'Giảm kháng sinh, xuất chuồng đạt chuẩn VietGAP' },
    { id: 'MT004', name: 'Gà Ta Lạc Thủy thả đồi', from: 45, to: 90, weight: '2.10 kg', feed: '110 g', fcr: '2.35', notes: 'Nuôi thả vườn kết hợp thức ăn ủ men vi sinh' }
  ]);

  // Form states
  const [newGrowth, setNewGrowth] = useState({ name: '', from: '', to: '', weight: '', feed: '', fcr: '', notes: '' });

  const handleAddGrowth = (e) => {
    e.preventDefault();
    const item = {
      id: `MT00${growthTargets.length + 1}`,
      name: newGrowth.name,
      from: Number(newGrowth.from) || 1,
      to: Number(newGrowth.to) || 30,
      weight: `${newGrowth.weight} kg`,
      feed: `${newGrowth.feed} g`,
      fcr: newGrowth.fcr || '1.85',
      notes: newGrowth.notes
    };
    setGrowthTargets([...growthTargets, item]);
    setShowAddGrowthModal(false);
    setNewGrowth({ name: '', from: '', to: '', weight: '', feed: '', fcr: '', notes: '' });
  };

  return (
    <FarmShiftLayout
      pageTitle="Thiết lập chăn nuôi"
      breadcrumbs={[{ label: 'Thiết lập chăn nuôi' }]}
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="farmshift-btn farmshift-btn-excel">
            <FileSpreadsheet size={15} /> Xuất Excel
          </button>
          {activeTab === 'growth_targets' && (
            <button
              className="farmshift-btn farmshift-btn-primary"
              onClick={() => setShowAddGrowthModal(true)}
            >
              <Plus size={16} /> Thêm mục tiêu
            </button>
          )}
        </div>
      }
    >
      {/* ── Subsystem cards: each one addressable as /breeding-settings?tab=… ── */}
      <nav className={tabStyles.cards} aria-label="Mục thiết lập chăn nuôi">
        {SETTING_TABS.map(({ key, label, sub, icon: Icon, to }) => {
          const content = <>
            <span className={tabStyles.icon}><Icon size={20} /></span>
            <span className={tabStyles.text}>
              <span className={tabStyles.title}>{label}</span>
              <span className={tabStyles.sub}>{sub}</span>
            </span>
          </>;
          return to
            ? <Link key={key} to={to} className={tabStyles.card}>{content}</Link>
            : <button
              key={key}
              type="button"
              className={`${tabStyles.card} ${activeTab === key ? tabStyles.active : ''}`}
              aria-current={activeTab === key ? 'page' : undefined}
              onClick={() => openTab(key)}
            >
              {content}
            </button>;
        })}
      </nav>

      {/* ── Tab 1: Chương trình nuôi theo giống (dữ liệu thật từ API) ── */}
      {activeTab === 'program' && <FarmingProgramsPanel />}

      {/* ── Tab 2: Mục tiêu tăng trưởng & Định mức cám ─────── */}
      {activeTab === 'growth_targets' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <div>
              <h3 className="farmshift-card-title">Mục tiêu tăng trọng & Định mức cám theo tuần tuổi</h3>
              <p style={{ fontSize: '13.5px', color: 'var(--color-muted)', margin: '4px 0 0 0' }}>
                Định mức kỹ thuật làm căn cứ so sánh chỉ số FCR thực tế và cảnh báo hao hụt cám
              </p>
            </div>
            <button
              className="farmshift-btn farmshift-btn-primary"
              onClick={() => setShowAddGrowthModal(true)}
            >
              <Plus size={15} /> Thêm định mức
            </button>
          </div>
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th>Mã định mức</th>
                  <th>Giống & Giai đoạn nuôi</th>
                  <th>Từ ngày tuổi</th>
                  <th>Đến ngày tuổi</th>
                  <th>Trọng lượng chuẩn</th>
                  <th>Cám / con / ngày</th>
                  <th>FCR mục tiêu</th>
                  <th>Ghi chú chuyên môn</th>
                  <th style={{ textAlign: 'center' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {growthTargets.map(target => (
                  <tr key={target.id}>
                    <td><strong style={{ color: 'var(--color-primary)' }}>{target.id}</strong></td>
                    <td><strong>{target.name}</strong></td>
                    <td>{target.from} ngày</td>
                    <td>{target.to} ngày</td>
                    <td><strong style={{ color: 'var(--color-ink)' }}>{target.weight}</strong></td>
                    <td>{target.feed}</td>
                    <td>
                      <span className="farmshift-badge farmshift-badge-success">{target.fcr}</span>
                    </td>
                    <td style={{ fontSize: '13.5px', color: 'var(--color-muted)' }}>{target.notes}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="farmshift-btn farmshift-btn-secondary"
                        style={{ padding: '3px 8px', fontSize: '13.5px' }}
                        onClick={() => showToast(`Chỉnh sửa định mức ${target.id}`, 'info')}
                      >
                        <Edit3 size={13} /> Sửa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal: Thêm mục tiêu tăng trưởng ──────────────── */}
      {showAddGrowthModal && (
        <div className="farmshift-modal-backdrop">
          <div className="farmshift-modal">
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title">Thêm mục tiêu tăng trưởng & cám</h3>
              <button onClick={() => setShowAddGrowthModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddGrowth}>
              <div className="farmshift-modal-body">
                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Tên giống / Giai đoạn nuôi *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Gà Mía thương phẩm giai đoạn vỗ béo..."
                    className="farmshift-form-control"
                    value={newGrowth.name}
                    onChange={(e) => setNewGrowth({ ...newGrowth, name: e.target.value })}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Từ ngày tuổi *</label>
                    <input
                      type="number"
                      required
                      placeholder="1"
                      className="farmshift-form-control"
                      value={newGrowth.from}
                      onChange={(e) => setNewGrowth({ ...newGrowth, from: e.target.value })}
                    />
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Đến ngày tuổi *</label>
                    <input
                      type="number"
                      required
                      placeholder="21"
                      className="farmshift-form-control"
                      value={newGrowth.to}
                      onChange={(e) => setNewGrowth({ ...newGrowth, to: e.target.value })}
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Trọng lượng (kg) *</label>
                    <input
                      type="text"
                      required
                      placeholder="1.45"
                      className="farmshift-form-control"
                      value={newGrowth.weight}
                      onChange={(e) => setNewGrowth({ ...newGrowth, weight: e.target.value })}
                    />
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Cám/con/ngày (g)</label>
                    <input
                      type="text"
                      placeholder="85"
                      className="farmshift-form-control"
                      value={newGrowth.feed}
                      onChange={(e) => setNewGrowth({ ...newGrowth, feed: e.target.value })}
                    />
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">FCR mục tiêu</label>
                    <input
                      type="text"
                      placeholder="1.85"
                      className="farmshift-form-control"
                      value={newGrowth.fcr}
                      onChange={(e) => setNewGrowth({ ...newGrowth, fcr: e.target.value })}
                    />
                  </div>
                </div>
                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Ghi chú chuyên môn</label>
                  <textarea
                    rows={2}
                    placeholder="Lưu ý kỹ thuật hoặc chế độ cho ăn..."
                    className="farmshift-form-control"
                    value={newGrowth.notes}
                    onChange={(e) => setNewGrowth({ ...newGrowth, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="farmshift-modal-footer">
                <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setShowAddGrowthModal(false)}>
                  Hủy
                </button>
                <button type="submit" className="farmshift-btn farmshift-btn-primary">
                  Lưu định mức
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </FarmShiftLayout>
  );
};
