// src/features/farmshift/BreedingSettingsView.jsx
// Thiết lập chăn nuôi & Quy trình kỹ thuật chuẩn FarmShift & DESIGN.md
import React, { useState } from 'react';
import { Settings, Thermometer, Activity, Calendar, CheckCircle, Plus, FileSpreadsheet, X } from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';

export const BreedingSettingsView = () => {
  const [activeTab, setActiveTab] = useState('program');
  const [showAddProgModal, setShowAddProgModal] = useState(false);

  return (
    <FarmShiftLayout
      pageTitle="Thiết lập chăn nuôi"
      breadcrumbs={[{ label: 'Thiết lập chăn nuôi' }]}
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="farmshift-btn farmshift-btn-excel">
            <FileSpreadsheet size={15} /> Xuất Excel
          </button>
          <button
            className="farmshift-btn farmshift-btn-primary"
            onClick={() => setShowAddProgModal(true)}
          >
            <Plus size={16} /> Tạo chương trình
          </button>
        </div>
      }
    >
      <div className="farmshift-tabs">
        <button
          className={`farmshift-tab-btn ${activeTab === 'program' ? 'active' : ''}`}
          onClick={() => setActiveTab('program')}
        >
          Chương trình & Lịch nuôi chuẩn
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'standards' ? 'active' : ''}`}
          onClick={() => setActiveTab('standards')}
        >
          Chỉ số vật nuôi theo ngày
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'env' ? 'active' : ''}`}
          onClick={() => setActiveTab('env')}
        >
          Chỉ số môi trường nuôi (IoT)
        </button>
      </div>

      {activeTab === 'program' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Quy trình chăm sóc gà thịt thương phẩm (75 ngày)</h3>
            <span className="farmshift-badge farmshift-badge-neutral">Áp dụng toàn trại</span>
          </div>
          <div className="farmshift-card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ borderLeft: '4px solid var(--color-primary)', paddingLeft: '14px' }}>
                <strong style={{ color: 'var(--color-ink)', fontSize: '15px' }}>Giai đoạn 1: Úm gà con (Ngày 1 - 21)</strong>
                <div style={{ fontSize: '13px', color: 'var(--color-body)', marginTop: '4px', lineHeight: 1.6 }}>
                  • Thức ăn: Cám Higro 01 (Hàm lượng đạm &gt; 21%)<br />
                  • Phòng bệnh: Vắc-xin Newcastle Lasota lần 1 (ngày 3-5), Gumboro lần 1 (ngày 7-10)<br />
                  • Nhiệt độ úm: 32°C - 34°C tuần 1, giảm dần 2°C mỗi tuần.
                </div>
              </div>

              <div style={{ borderLeft: '4px solid var(--color-link)', paddingLeft: '14px' }}>
                <strong style={{ color: 'var(--color-ink)', fontSize: '15px' }}>Giai đoạn 2: Nuôi lớn sinh trưởng (Ngày 22 - 50)</strong>
                <div style={{ fontSize: '13px', color: 'var(--color-body)', marginTop: '4px', lineHeight: 1.6 }}>
                  • Thức ăn: Cám Higro 02<br />
                  • Phòng bệnh: Newcastle Lasota lần 2 (ngày 25), phòng cầu trùng và hen CRD<br />
                  • Thả sân chơi: Cho gà vận động tắm nắng tăng cơ bắp và chất lượng thịt.
                </div>
              </div>

              <div style={{ borderLeft: '4px solid var(--color-signature-coral)', paddingLeft: '14px' }}>
                <strong style={{ color: 'var(--color-ink)', fontSize: '15px' }}>Giai đoạn 3: Vỗ béo & Xuất chuồng (Ngày 51 - 75)</strong>
                <div style={{ fontSize: '13px', color: 'var(--color-body)', marginTop: '4px', lineHeight: 1.6 }}>
                  • Thức ăn: Cám Higro 03 kết hợp ngô mảnh<br />
                  • Ngừng kháng sinh trước xuất bán tối thiểu 14 ngày đảm bảo an toàn sinh học<br />
                  • Trọng lượng mục tiêu: 2.1kg - 2.4kg / con.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'standards' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Bảng chuẩn tăng trọng & lượng ăn (Giống J-Dabaco)</h3>
          </div>
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th>Tuần tuổi</th>
                  <th>Số ngày</th>
                  <th>Trọng lượng chuẩn (g/con)</th>
                  <th>Lượng ăn ngày (g/con)</th>
                  <th>FCR lũy kế chuẩn</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Tuần 1</strong></td>
                  <td>1 - 7 ngày</td>
                  <td>120 - 150g</td>
                  <td>15 - 20g</td>
                  <td>1.10</td>
                </tr>
                <tr>
                  <td><strong>Tuần 2</strong></td>
                  <td>8 - 14 ngày</td>
                  <td>280 - 320g</td>
                  <td>28 - 35g</td>
                  <td>1.35</td>
                </tr>
                <tr>
                  <td><strong>Tuần 4</strong></td>
                  <td>22 - 28 ngày</td>
                  <td>850 - 950g</td>
                  <td>55 - 65g</td>
                  <td>1.75</td>
                </tr>
                <tr>
                  <td><strong>Tuần 6</strong></td>
                  <td>36 - 42 ngày</td>
                  <td>1,500 - 1,650g</td>
                  <td>90 - 105g</td>
                  <td>2.05</td>
                </tr>
                <tr>
                  <td><strong>Tuần 8</strong></td>
                  <td>50 - 56 ngày</td>
                  <td>2,000 - 2,200g</td>
                  <td>120 - 135g</td>
                  <td>2.25</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'env' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Cấu hình ngưỡng cảm biến nhiệt độ & độ ẩm chuồng trại</h3>
          </div>
          <div className="farmshift-card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              <div style={{ border: '1px solid var(--color-hairline)', borderRadius: 'var(--rounded-md)', padding: '16px' }}>
                <strong style={{ fontSize: '14px', color: 'var(--color-ink)' }}>Nhiệt độ môi trường</strong>
                <div style={{ marginTop: '10px', fontSize: '13px', color: 'var(--color-body)', lineHeight: 1.6 }}>
                  • Ngưỡng lý tưởng: <strong>25.0°C - 28.5°C</strong><br />
                  • Cảnh báo cao: <strong>&gt; 29.5°C</strong> (Kích hoạt giàn quạt hút & cooling pad)<br />
                  • Nguy hiểm khẩn cấp: <strong>&gt; 32.0°C</strong> (Báo động còi & tin nhắn cho chủ trại)
                </div>
              </div>

              <div style={{ border: '1px solid var(--color-hairline)', borderRadius: 'var(--rounded-md)', padding: '16px' }}>
                <strong style={{ fontSize: '14px', color: 'var(--color-ink)' }}>Độ ẩm không khí</strong>
                <div style={{ marginTop: '10px', fontSize: '13px', color: 'var(--color-body)', lineHeight: 1.6 }}>
                  • Ngưỡng lý tưởng: <strong>60% - 70%</strong><br />
                  • Cảnh báo ẩm ướt: <strong>&gt; 78%</strong> (Yêu cầu tăng thông gió, rải thêm đệm lót trấu)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Tạo chương trình nuôi mới ──────────────── */}
      {showAddProgModal && (
        <div className="farmshift-modal-backdrop">
          <div className="farmshift-modal">
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title">Tạo chương trình chăn nuôi mới</h3>
              <button
                onClick={() => setShowAddProgModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="farmshift-modal-body">
              <div className="farmshift-form-group">
                <label className="farmshift-form-label">Tên chương trình *</label>
                <input
                  type="text"
                  placeholder="VD: Nuôi gà thả vườn 90 ngày, Úm gà thịt siêu tốc..."
                  className="farmshift-form-control"
                />
              </div>
              <div className="farmshift-form-group">
                <label className="farmshift-form-label">Giống vật nuôi áp dụng</label>
                <input
                  type="text"
                  placeholder="Gà J-Dabaco, Gà Mía, Vịt Grimaud..."
                  className="farmshift-form-control"
                />
              </div>
              <div className="farmshift-form-group">
                <label className="farmshift-form-label">Số ngày dự kiến xuất chuồng</label>
                <input
                  type="number"
                  placeholder="75"
                  className="farmshift-form-control"
                />
              </div>
            </div>
            <div className="farmshift-modal-footer">
              <button
                className="farmshift-btn farmshift-btn-secondary"
                onClick={() => setShowAddProgModal(false)}
              >
                Hủy bỏ
              </button>
              <button
                className="farmshift-btn farmshift-btn-primary"
                onClick={() => {
                  alert('Đã lưu chương trình nuôi mới!');
                  setShowAddProgModal(false);
                }}
              >
                Lưu chương trình
              </button>
            </div>
          </div>
        </div>
      )}
    </FarmShiftLayout>
  );
};
