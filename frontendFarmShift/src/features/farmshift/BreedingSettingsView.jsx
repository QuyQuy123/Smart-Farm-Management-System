// src/features/farmshift/BreedingSettingsView.jsx
// Thiết lập chăn nuôi & Quy trình kỹ thuật chuẩn FarmShift & DESIGN.md
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Settings, Thermometer, Activity, Calendar, CheckCircle, Plus,
  FileSpreadsheet, X, Target, Scissors, Clock, UserCheck, AlertTriangle, Edit3, Trash2
} from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';

export const BreedingSettingsView = () => {
  const location = useLocation();

  // Auto-detect tab from URL path
  const getInitialTab = () => {
    if (location.pathname.includes('growth-targets')) return 'growth_targets';
    if (location.pathname.includes('harvest-types')) return 'harvest_types';
    if (location.pathname.includes('tasks')) return 'tasks';
    return 'program';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [showAddProgModal, setShowAddProgModal] = useState(false);
  const [showAddGrowthModal, setShowAddGrowthModal] = useState(false);
  const [showAddHarvestModal, setShowAddHarvestModal] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);

  useEffect(() => {
    if (location.pathname.includes('growth-targets')) setActiveTab('growth_targets');
    else if (location.pathname.includes('harvest-types')) setActiveTab('harvest_types');
    else if (location.pathname.includes('tasks')) setActiveTab('tasks');
  }, [location.pathname]);

  // Mock data for Growth Targets
  const [growthTargets, setGrowthTargets] = useState([
    { id: 'MT001', name: 'Gà Mía thương phẩm (Giai đoạn úm)', from: 1, to: 21, weight: '0.45 kg', feed: '35 g', fcr: '1.25', notes: 'Giai đoạn úm chuồng kín, kiểm soát nhiệt độ nghiêm ngặt' },
    { id: 'MT002', name: 'Gà Mía thương phẩm (Sinh trưởng)', from: 22, to: 50, weight: '1.40 kg', feed: '85 g', fcr: '1.80', notes: 'Thả sân chơi tắm nắng, tăng cơ bắp' },
    { id: 'MT003', name: 'Gà J-Dabaco thương phẩm (Vỗ béo)', from: 51, to: 75, weight: '2.35 kg', feed: '125 g', fcr: '2.10', notes: 'Giảm kháng sinh, xuất chuồng đạt chuẩn VietGAP' },
    { id: 'MT004', name: 'Gà Ta Lạc Thủy thả đồi', from: 45, to: 90, weight: '2.10 kg', feed: '110 g', fcr: '2.35', notes: 'Nuôi thả vườn kết hợp thức ăn ủ men vi sinh' }
  ]);

  // Mock data for Harvest Types
  const [harvestTypes, setHarvestTypes] = useState([
    { id: 'TH001', code: 'TH-LOAI-1', group: 'Thu hoạch chính', name: 'Gà thịt biểu lớn (Loại 1)', weightSpec: '>= 2.3 kg', notes: 'Mào đỏ, ức dày, lông bóng mượt, không tật lỗi', price: '78,000 đ/kg' },
    { id: 'TH002', code: 'TH-LOAI-2', group: 'Thu hoạch chính', name: 'Gà thịt biểu vừa (Loại 2)', weightSpec: '1.9 - 2.2 kg', notes: 'Thể trạng tốt, da chân vàng, đồng đều', price: '74,000 đ/kg' },
    { id: 'TH003', code: 'TH-XO', group: 'Bán xô', name: 'Gà xô nguyên đàn', weightSpec: 'Trung bình đàn', notes: 'Thương lái bao tiêu cả chuồng, trừ hao 3% bù diều', price: '72,000 đ/kg' },
    { id: 'TH004', code: 'TH-LOC', group: 'Thu tỉa / Loại thải', name: 'Gà lọc còi / Loại thải', weightSpec: '< 1.7 kg', notes: 'Gà chậm lớn hoặc dị tật nhẹ, bán tiêu thụ nhanh', price: '52,000 đ/kg' },
    { id: 'TH005', code: 'TH-TRUNG', group: 'Sản phẩm phụ', name: 'Trứng gà chuồng', weightSpec: 'Quả', notes: 'Trứng gà đẻ bói hoặc thu gom định kỳ', price: '3,200 đ/quả' }
  ]);

  // Mock data for Tasks (Lịch chăm sóc & Công việc)
  const [tasks, setTasks] = useState([
    { id: 'TSK01', date: '2026-10-08', time: '06:30', house: 'Chuồng 01 (Lứa L01-26)', name: 'Rải trấu đệm lót sinh học & xới xáo', worker: 'Nguyễn Văn Bình', status: 'Đã hoàn thành' },
    { id: 'TSK02', date: '2026-10-08', time: '08:00', house: 'Chuồng 02 (Lứa L02-26)', name: 'Nhỏ vắc-xin Newcastle Lasota lần 2', worker: 'Trần Thị Mai', status: 'Chưa làm' },
    { id: 'TSK03', date: '2026-10-08', time: '14:30', house: 'Chuồng 03 (Lứa L03-26)', name: 'Cân mẫu ngẫu nhiên 30 con kiểm tra tăng trọng', worker: 'Lê Văn Cường', status: 'Chưa làm' },
    { id: 'TSK04', date: '2026-10-08', time: '17:00', house: 'Khu chuồng 01 - 04', name: 'Vệ sinh khử trùng máng ăn tự động', worker: 'Nguyễn Văn Bình', status: 'Chưa làm' }
  ]);

  // Form states
  const [newGrowth, setNewGrowth] = useState({ name: '', from: '', to: '', weight: '', feed: '', fcr: '', notes: '' });
  const [newHarvest, setNewHarvest] = useState({ name: '', group: 'Thu hoạch chính', weightSpec: '', price: '', notes: '' });
  const [newTask, setNewTask] = useState({ date: '2026-10-08', time: '07:00', house: 'Chuồng 01', name: '', worker: 'Nguyễn Văn Bình' });

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

  const handleAddHarvest = (e) => {
    e.preventDefault();
    const item = {
      id: `TH00${harvestTypes.length + 1}`,
      code: `TH-0${harvestTypes.length + 1}`,
      name: newHarvest.name,
      group: newHarvest.group,
      weightSpec: newHarvest.weightSpec,
      price: newHarvest.price,
      notes: newHarvest.notes
    };
    setHarvestTypes([...harvestTypes, item]);
    setShowAddHarvestModal(false);
    setNewHarvest({ name: '', group: 'Thu hoạch chính', weightSpec: '', price: '', notes: '' });
  };

  const handleAddTask = (e) => {
    e.preventDefault();
    const item = {
      id: `TSK0${tasks.length + 1}`,
      date: newTask.date,
      time: newTask.time,
      house: newTask.house,
      name: newTask.name,
      worker: newTask.worker,
      status: 'Chưa làm'
    };
    setTasks([item, ...tasks]);
    setShowAddTaskModal(false);
    setNewTask({ date: '2026-10-08', time: '07:00', house: 'Chuồng 01', name: '', worker: 'Nguyễn Văn Bình' });
  };

  const toggleTaskStatus = (id) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, status: t.status === 'Đã hoàn thành' ? 'Chưa làm' : 'Đã hoàn thành' } : t));
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
          {activeTab === 'program' && (
            <button
              className="farmshift-btn farmshift-btn-primary"
              onClick={() => setShowAddProgModal(true)}
            >
              <Plus size={16} /> Tạo chương trình
            </button>
          )}
          {activeTab === 'growth_targets' && (
            <button
              className="farmshift-btn farmshift-btn-primary"
              onClick={() => setShowAddGrowthModal(true)}
            >
              <Plus size={16} /> Thêm mục tiêu
            </button>
          )}
          {activeTab === 'harvest_types' && (
            <button
              className="farmshift-btn farmshift-btn-primary"
              onClick={() => setShowAddHarvestModal(true)}
            >
              <Plus size={16} /> Thêm loại thu hoạch
            </button>
          )}
          {activeTab === 'tasks' && (
            <button
              className="farmshift-btn farmshift-btn-primary"
              onClick={() => setShowAddTaskModal(true)}
            >
              <Plus size={16} /> Giao việc mới
            </button>
          )}
        </div>
      }
    >
      {/* ── Subsystem Tabs (All 6 Husbandry Subsystems) ─────── */}
      <div className="farmshift-tabs">
        <button
          className={`farmshift-tab-btn ${activeTab === 'program' ? 'active' : ''}`}
          onClick={() => setActiveTab('program')}
        >
          Chương trình & Lịch nuôi chuẩn
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'growth_targets' ? 'active' : ''}`}
          onClick={() => setActiveTab('growth_targets')}
        >
          Mục tiêu tăng trưởng & Định mức cám
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'harvest_types' ? 'active' : ''}`}
          onClick={() => setActiveTab('harvest_types')}
        >
          Loại thu hoạch & Biểu cân
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          Công việc & Lịch chăm sóc
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

      {/* ── Tab 1: Chương trình nuôi ───────────────────────── */}
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

      {/* ── Tab 2: Mục tiêu tăng trưởng & Định mức cám ─────── */}
      {activeTab === 'growth_targets' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <div>
              <h3 className="farmshift-card-title">Mục tiêu tăng trọng & Định mức cám theo tuần tuổi</h3>
              <p style={{ fontSize: '12px', color: 'var(--color-muted)', margin: '4px 0 0 0' }}>
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
                    <td style={{ fontSize: '12px', color: 'var(--color-muted)' }}>{target.notes}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="farmshift-btn farmshift-btn-secondary"
                        style={{ padding: '3px 8px', fontSize: '12px' }}
                        onClick={() => alert(`Chỉnh sửa định mức ${target.id}`)}
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

      {/* ── Tab 3: Loại thu hoạch & Biểu cân ─────────────────── */}
      {activeTab === 'harvest_types' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <div>
              <h3 className="farmshift-card-title">Tiêu chuẩn phân loại gà xuất chuồng & Sản phẩm thu hoạch</h3>
              <p style={{ fontSize: '12px', color: 'var(--color-muted)', margin: '4px 0 0 0' }}>
                Phục vụ tạo phiếu xuất bán hàng, phân loại biểu cân và định giá xuất trại
              </p>
            </div>
            <button
              className="farmshift-btn farmshift-btn-primary"
              onClick={() => setShowAddHarvestModal(true)}
            >
              <Plus size={15} /> Thêm loại thu hoạch
            </button>
          </div>
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th>Mã loại</th>
                  <th>Nhóm thu hoạch</th>
                  <th>Tên loại xuất bán</th>
                  <th>Biểu cân chuẩn</th>
                  <th>Giá tham chiếu</th>
                  <th>Tiêu chuẩn & Mô tả phẩm cấp</th>
                  <th style={{ textAlign: 'center' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {harvestTypes.map(h => (
                  <tr key={h.id}>
                    <td><strong style={{ color: 'var(--color-primary)' }}>{h.code || h.id}</strong></td>
                    <td>
                      <span className="farmshift-badge farmshift-badge-neutral">{h.group}</span>
                    </td>
                    <td><strong>{h.name}</strong></td>
                    <td><strong style={{ color: 'var(--color-signature-coral)' }}>{h.weightSpec}</strong></td>
                    <td style={{ fontWeight: 600, color: 'var(--color-success)' }}>{h.price}</td>
                    <td style={{ fontSize: '12px', color: 'var(--color-body)' }}>{h.notes}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="farmshift-btn farmshift-btn-secondary"
                        style={{ padding: '3px 8px', fontSize: '12px' }}
                        onClick={() => alert(`Cập nhật tiêu chuẩn ${h.name}`)}
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

      {/* ── Tab 4: Công việc & Lịch chăm sóc ───────────────── */}
      {activeTab === 'tasks' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div className="farmshift-stat-card">
              <div className="farmshift-stat-label">Tổng công việc hôm nay</div>
              <div className="farmshift-stat-val">{tasks.length}</div>
              <div className="farmshift-stat-sub">Đã lên lịch phân công</div>
            </div>
            <div className="farmshift-stat-card">
              <div className="farmshift-stat-label">Chưa thực hiện</div>
              <div className="farmshift-stat-val" style={{ color: '#d9a441' }}>
                {tasks.filter(t => t.status === 'Chưa làm').length}
              </div>
              <div className="farmshift-stat-sub">Cần hoàn thành trong ca</div>
            </div>
            <div className="farmshift-stat-card">
              <div className="farmshift-stat-label">Đã hoàn thành</div>
              <div className="farmshift-stat-val" style={{ color: 'var(--color-success)' }}>
                {tasks.filter(t => t.status === 'Đã hoàn thành').length}
              </div>
              <div className="farmshift-stat-sub">Tỉ lệ hoàn thành 25%</div>
            </div>
            <div className="farmshift-stat-card">
              <div className="farmshift-stat-label">Chuồng được phân công</div>
              <div className="farmshift-stat-val" style={{ color: 'var(--color-primary)' }}>4</div>
              <div className="farmshift-stat-sub">Toàn bộ 4 chuồng nuôi</div>
            </div>
          </div>

          <div className="farmshift-card">
            <div className="farmshift-card-header">
              <h3 className="farmshift-card-title">Lịch phân công công việc & Giám sát ca làm</h3>
              <button
                className="farmshift-btn farmshift-btn-primary"
                onClick={() => setShowAddTaskModal(true)}
              >
                <Plus size={15} /> Giao việc mới
              </button>
            </div>
            <div className="farmshift-table-container" style={{ border: 'none' }}>
              <table className="farmshift-table">
                <thead>
                  <tr>
                    <th>Ngày</th>
                    <th>Giờ</th>
                    <th>Chuồng áp dụng</th>
                    <th>Nội dung công việc</th>
                    <th>Người phụ trách</th>
                    <th>Trạng thái</th>
                    <th style={{ textAlign: 'center' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map(t => (
                    <tr key={t.id}>
                      <td>{t.date}</td>
                      <td><strong>{t.time}</strong></td>
                      <td>{t.house}</td>
                      <td><strong>{t.name}</strong></td>
                      <td>{t.worker}</td>
                      <td>
                        <span className={`farmshift-badge ${t.status === 'Đã hoàn thành' ? 'farmshift-badge-success' : 'farmshift-badge-warning'}`}>
                          {t.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className={`farmshift-btn ${t.status === 'Đã hoàn thành' ? 'farmshift-btn-secondary' : 'farmshift-btn-primary'}`}
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={() => toggleTaskStatus(t.id)}
                        >
                          {t.status === 'Đã hoàn thành' ? 'Mở lại' : '✓ Hoàn thành'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 5: Bảng chuẩn tăng trọng ───────────────────── */}
      {activeTab === 'standards' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Bảng chuẩn tăng trọng & Lượng ăn theo ngày (Giống J-Dabaco)</h3>
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

      {/* ── Tab 6: Ngưỡng IoT ───────────────────────────────── */}
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

      {/* ── Modal: Thêm loại thu hoạch ────────────────────── */}
      {showAddHarvestModal && (
        <div className="farmshift-modal-backdrop">
          <div className="farmshift-modal">
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title">Thêm loại thu hoạch & Phân cấp</h3>
              <button onClick={() => setShowAddHarvestModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddHarvest}>
              <div className="farmshift-modal-body">
                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Tên loại thu hoạch *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Gà thịt biểu lớn, Gà xô..."
                    className="farmshift-form-control"
                    value={newHarvest.name}
                    onChange={(e) => setNewHarvest({ ...newHarvest, name: e.target.value })}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Nhóm thu hoạch</label>
                    <select
                      className="farmshift-form-control"
                      value={newHarvest.group}
                      onChange={(e) => setNewHarvest({ ...newHarvest, group: e.target.value })}
                    >
                      <option value="Thu hoạch chính">Thu hoạch chính</option>
                      <option value="Bán xô">Bán xô</option>
                      <option value="Thu tỉa / Loại thải">Thu tỉa / Loại thải</option>
                      <option value="Sản phẩm phụ">Sản phẩm phụ</option>
                    </select>
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Biểu cân chuẩn *</label>
                    <input
                      type="text"
                      required
                      placeholder=">= 2.2 kg"
                      className="farmshift-form-control"
                      value={newHarvest.weightSpec}
                      onChange={(e) => setNewHarvest({ ...newHarvest, weightSpec: e.target.value })}
                    />
                  </div>
                </div>
                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Giá tham chiếu xuất chuồng</label>
                  <input
                    type="text"
                    placeholder="75,000 đ/kg"
                    className="farmshift-form-control"
                    value={newHarvest.price}
                    onChange={(e) => setNewHarvest({ ...newHarvest, price: e.target.value })}
                  />
                </div>
                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Tiêu chuẩn phẩm cấp & Ghi chú</label>
                  <textarea
                    rows={2}
                    placeholder="Đặc điểm nhận diện, yêu cầu ngoại hình..."
                    className="farmshift-form-control"
                    value={newHarvest.notes}
                    onChange={(e) => setNewHarvest({ ...newHarvest, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="farmshift-modal-footer">
                <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setShowAddHarvestModal(false)}>
                  Hủy
                </button>
                <button type="submit" className="farmshift-btn farmshift-btn-primary">
                  Lưu loại thu hoạch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Giao việc mới ───────────────────────────── */}
      {showAddTaskModal && (
        <div className="farmshift-modal-backdrop">
          <div className="farmshift-modal">
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title">Giao việc & Lên lịch chăm sóc mới</h3>
              <button onClick={() => setShowAddTaskModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddTask}>
              <div className="farmshift-modal-body">
                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Nội dung công việc *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Cân gà mẫu, Rải trấu, Phun thuốc sát trùng chuồng..."
                    className="farmshift-form-control"
                    value={newTask.name}
                    onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Ngày thực hiện *</label>
                    <input
                      type="date"
                      required
                      className="farmshift-form-control"
                      value={newTask.date}
                      onChange={(e) => setNewTask({ ...newTask, date: e.target.value })}
                    />
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Thời gian *</label>
                    <input
                      type="time"
                      required
                      className="farmshift-form-control"
                      value={newTask.time}
                      onChange={(e) => setNewTask({ ...newTask, time: e.target.value })}
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Chuồng nuôi</label>
                    <select
                      className="farmshift-form-control"
                      value={newTask.house}
                      onChange={(e) => setNewTask({ ...newTask, house: e.target.value })}
                    >
                      <option value="Chuồng 01">Chuồng 01 (Lứa L01-26)</option>
                      <option value="Chuồng 02">Chuồng 02 (Lứa L02-26)</option>
                      <option value="Chuồng 03">Chuồng 03 (Lứa L03-26)</option>
                      <option value="Chuồng 04">Chuồng 04 (Lứa L04-26)</option>
                      <option value="Toàn bộ chuồng trại">Toàn bộ chuồng trại</option>
                    </select>
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Người phụ trách *</label>
                    <input
                      type="text"
                      required
                      className="farmshift-form-control"
                      value={newTask.worker}
                      onChange={(e) => setNewTask({ ...newTask, worker: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="farmshift-modal-footer">
                <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setShowAddTaskModal(false)}>
                  Hủy
                </button>
                <button type="submit" className="farmshift-btn farmshift-btn-primary">
                  Giao công việc
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </FarmShiftLayout>
  );
};
