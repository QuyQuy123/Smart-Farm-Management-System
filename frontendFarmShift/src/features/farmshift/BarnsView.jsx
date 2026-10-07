// src/features/farmshift/BarnsView.jsx
// Quản lý Khu nuôi & Chuồng trại chuẩn FarmShift & DESIGN.md
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Warehouse, Plus, Search, FileSpreadsheet, Edit2, Trash2,
  ChevronDown, AlertCircle, CheckCircle, Thermometer, Droplets,
  Activity, ArrowRightLeft, X, Utensils, HeartPulse, Calendar,
  ShoppingCart, Video, Grid, Maximize2, Tv
} from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { INITIAL_FARMSHIFT_DATA } from '../../data/farmshiftMockData';
import { CctvPlayer } from '../../components/CctvPlayer';
import { StockTempChart } from '../../components/StockTempChart';

export const BarnsView = () => {
  const [areas, setAreas] = useState(INITIAL_FARMSHIFT_DATA.areas);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('ALL');
  const [selectedAreaTab, setSelectedAreaTab] = useState('ALL'); // 'ALL' | 'Khu Mía Thịt' | 'Khu J Thịt'

  // Modals & Views
  const [showAddAreaModal, setShowAddAreaModal] = useState(false);
  const [showAddBarnModal, setShowAddBarnModal] = useState(false);
  const [selectedBarnDetail, setSelectedBarnDetail] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'cctv_wall'

  // New Area Form
  const [newArea, setNewArea] = useState({
    name: '',
    livestockType: 'Gia cầm (Gà thịt)',
    barnCount: 2,
    description: ''
  });

  // New Barn Form (Tạo Chuồng.html parity)
  const [newBarn, setNewBarn] = useState({
    areaId: areas[0]?.id || '',
    name: '',
    capacity: 2500,
    current: 2500,
    ageDays: 1,
    avgWeight: 0.05
  });

  const handleCreateArea = (e) => {
    e.preventDefault();
    if (!newArea.name) return;
    const created = {
      id: `area-${Date.now()}`,
      name: newArea.name,
      barnCount: Number(newArea.barnCount),
      livestockType: newArea.livestockType,
      description: newArea.description,
      barns: Array.from({ length: Number(newArea.barnCount) }, (_, i) => ({
        id: `barn-${Date.now()}-${i + 1}`,
        name: `Chuồng ${i + 1}`,
        capacity: 2500,
        current: 0,
        ageDays: 0,
        avgWeight: 0,
        temp: 26.0,
        humidity: 65,
        status: 'Trống'
      }))
    };
    setAreas([...areas, created]);
    setShowAddAreaModal(false);
    setNewArea({ name: '', livestockType: 'Gia cầm (Gà thịt)', barnCount: 2, description: '' });
  };

  const handleCreateBarn = (e) => {
    e.preventDefault();
    const targetArea = areas.find(a => a.id === newBarn.areaId) || areas[0];
    if (!targetArea) return;
    const createdBarn = {
      id: `barn-${Date.now()}`,
      name: newBarn.name || `Nhà ${targetArea.barns.length + 1}`,
      capacity: Number(newBarn.capacity) || 2500,
      current: Number(newBarn.current) || 0,
      ageDays: Number(newBarn.ageDays) || 0,
      avgWeight: Number(newBarn.avgWeight) || 0,
      temp: 28.0,
      humidity: 70,
      status: Number(newBarn.current) > 0 ? 'Đang nuôi' : 'Trống'
    };
    const updatedAreas = areas.map(a => {
      if (a.id === targetArea.id) {
        return {
          ...a,
          barns: [...a.barns, createdBarn]
        };
      }
      return a;
    });
    setAreas(updatedAreas);
    setShowAddBarnModal(false);
  };

  const filteredAreas = areas.filter(a => {
    const matchSearch = a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.livestockType.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchSearch) return false;
    if (selectedFilter !== 'ALL' && !a.livestockType.includes(selectedFilter)) return false;
    if (selectedAreaTab !== 'ALL' && a.name !== selectedAreaTab) return false;
    return true;
  });

  return (
    <FarmShiftLayout
      pageTitle="Quản lý khu nuôi & Chuồng trại"
      breadcrumbs={[{ label: 'Khu nuôi' }]}
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="farmshift-btn farmshift-btn-excel">
            <FileSpreadsheet size={15} /> Xuất Excel
          </button>
          <button
            className="farmshift-btn farmshift-btn-secondary"
            onClick={() => setShowAddBarnModal(true)}
          >
            <Plus size={16} /> Tạo Chuồng
          </button>
          <button
            className="farmshift-btn farmshift-btn-primary"
            onClick={() => setShowAddAreaModal(true)}
          >
            <Plus size={16} /> Thêm mới khu nuôi
          </button>
        </div>
      }
    >
      {/* ── Area Navigation Tabs (Khu Mía Thịt vs Khu J Thịt parity) ── */}
      <div className="farmshift-tabs">
        <button
          className={`farmshift-tab-btn ${selectedAreaTab === 'ALL' ? 'active' : ''}`}
          onClick={() => setSelectedAreaTab('ALL')}
        >
          Danh sách khu nuôi (Tất cả)
        </button>
        {areas.map(a => (
          <button
            key={a.id}
            className={`farmshift-tab-btn ${selectedAreaTab === a.name ? 'active' : ''}`}
            onClick={() => setSelectedAreaTab(a.name)}
          >
            {a.name} ({a.barns.length} chuồng)
          </button>
        ))}
      </div>

      {/* ── Toolbar: Search, Filters & View Mode Switcher ── */}
      <div className="farmshift-toolbar">
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
          <div className="farmshift-search-box" style={{ flex: 1, minWidth: '220px' }}>
            <Search size={16} color="var(--color-muted)" />
            <input
              type="text"
              placeholder="Tìm theo tên khu nuôi, chuồng, loại vật nuôi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="farmshift-filter-group">
            <select
              className="farmshift-select"
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value)}
            >
              <option value="ALL">Tất cả loại vật nuôi</option>
              <option value="Gia cầm">Gia cầm (Gà, Vịt)</option>
              <option value="Gia súc">Gia súc (Heo, Bò)</option>
              <option value="Thủy sản">Thủy sản</option>
            </select>
          </div>
        </div>

        {/* View Mode Toggle: Danh sách vs Tường Camera Trực Tiếp */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            type="button"
            className={`farmshift-btn ${viewMode === 'list' ? 'farmshift-btn-secondary' : 'farmshift-btn-ghost'}`}
            style={{ fontSize: '12.5px', padding: '6px 12px' }}
            onClick={() => setViewMode('list')}
            title="Xem danh sách bảng dữ liệu khu nuôi"
          >
            <Warehouse size={14} /> Danh sách chuồng
          </button>
          <button
            type="button"
            className={`farmshift-btn ${viewMode === 'cctv_wall' ? 'farmshift-btn-primary' : 'farmshift-btn-secondary'}`}
            style={{ fontSize: '12.5px', padding: '6px 12px' }}
            onClick={() => setViewMode('cctv_wall')}
            title="Mở tường camera giám sát trực tiếp toàn bộ chuồng trại"
          >
            <Video size={14} /> 📹 Tường Camera Trực Tiếp
          </button>
        </div>
      </div>

      {/* ── VIEW MODE 1: Tường Camera Giám Sát Trực Tiếp (Multi-Cam Grid) ── */}
      {viewMode === 'cctv_wall' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header Banner Trung tâm Camera */}
          <div style={{
            padding: '16px 20px',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            borderRadius: 'var(--rounded-md)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '14px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#019788', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Video size={22} color="#ffffff" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#f8fafc' }}>
                  Trung Tâm Giám Sát Camera An Ninh Sinh Học Toàn Trại
                </h3>
                <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                  Truyền hình trực tiếp đồng bộ thời gian thực từ camera chuồng nuôi · Tích hợp chỉ số vi khí hậu IoT
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'rgba(220, 38, 38, 0.2)',
                color: '#f87171',
                border: '1px solid rgba(220, 38, 38, 0.4)',
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 600
              }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                ĐANG PHÁT TRỰC TIẾP
              </span>
              <button
                type="button"
                className="farmshift-btn farmshift-btn-secondary"
                style={{ fontSize: '12px', padding: '6px 12px', backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155' }}
                onClick={() => setViewMode('list')}
              >
                ← Quay lại danh sách
              </button>
            </div>
          </div>

          {/* Lưới Camera Toàn Trại */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))',
            gap: '20px'
          }}>
            {filteredAreas.flatMap(area =>
              area.barns.map(barn => ({
                ...barn,
                areaName: area.name,
                livestockType: area.livestockType
              }))
            ).map((barn, idx) => (
              <div
                key={barn.id}
                className="farmshift-card"
                style={{
                  margin: 0,
                  overflow: 'hidden',
                  border: '1px solid #1e293b',
                  boxShadow: '0 4px 18px rgba(0,0,0,0.1)'
                }}
              >
                {/* Header camera */}
                <div style={{
                  padding: '10px 14px',
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid #1e293b'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      backgroundColor: '#019788',
                      color: '#ffffff',
                      fontSize: '10.5px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '3px'
                    }}>
                      CAM 0{idx + 1}
                    </span>
                    <strong style={{ fontSize: '13.5px', color: '#f8fafc' }}>
                      {barn.name} ({barn.areaName})
                    </strong>
                  </div>
                  <button
                    type="button"
                    className="farmshift-btn"
                    style={{
                      fontSize: '11.5px',
                      padding: '3px 8px',
                      backgroundColor: '#1e293b',
                      color: '#38bdf8',
                      border: '1px solid #334155'
                    }}
                    onClick={() => setSelectedBarnDetail(barn)}
                    title="Phóng to camera và điều khiển PTZ chuồng này"
                  >
                    <Maximize2 size={12} /> Phóng to & PTZ
                  </button>
                </div>

                {/* Video Stream Player */}
                <CctvPlayer
                  barn={{
                    ...barn,
                    fan: { on: barn.current > 0, speed: 2 },
                    light: { on: barn.current > 0 }
                  }}
                  compact={true}
                />

                {/* Footer bar below camera */}
                <div style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--color-surface-soft)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '12px'
                }}>
                  <div style={{ display: 'flex', gap: '14px', color: 'var(--color-body)' }}>
                    <span>Đang nuôi: <strong>{barn.current.toLocaleString()} con</strong></span>
                    <span>Ngày tuổi: <strong>{barn.ageDays} ngày</strong></span>
                    <span>Nhiệt độ: <strong>{barn.temp}°C</strong></span>
                  </div>
                  <button
                    type="button"
                    className="farmshift-btn farmshift-btn-secondary"
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                    onClick={() => setSelectedBarnDetail(barn)}
                  >
                    Xem chi tiết →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ── VIEW MODE 2: Areas List Grid (Mặc định) ─────────── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {filteredAreas.map(area => (
            <div key={area.id} className="farmshift-card" style={{ margin: 0 }}>
              <div className="farmshift-card-header" style={{ backgroundColor: 'var(--color-canvas)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: 'var(--rounded-md)',
                      backgroundColor: 'var(--color-surface-soft)',
                      color: 'var(--color-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--color-hairline)'
                    }}
                  >
                    <Warehouse size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 500, color: 'var(--color-ink)' }}>
                      {area.name}
                    </h3>
                    <div style={{ fontSize: '12.5px', color: 'var(--color-muted)', marginTop: '2px' }}>
                      {area.livestockType} · {area.barns.length} chuồng trại · {area.description}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="farmshift-badge farmshift-badge-neutral">
                    Tổng đàn: {area.barns.reduce((acc, b) => acc + b.current, 0).toLocaleString()} con
                  </span>
                  <button
                    className="farmshift-btn farmshift-btn-secondary"
                    style={{ fontSize: '12px', padding: '4px 10px' }}
                    onClick={() => {
                      setNewBarn({ ...newBarn, areaId: area.id });
                      setShowAddBarnModal(true);
                    }}
                  >
                    <Plus size={13} /> Thêm chuồng vào khu
                  </button>
                </div>
              </div>

              {/* Barns Table */}
              <div className="farmshift-table-container" style={{ border: 'none' }}>
                <table className="farmshift-table">
                  <thead>
                    <tr>
                      <th>Tên chuồng</th>
                      <th>Quy mô thiết kế</th>
                      <th>Đang nuôi</th>
                      <th>Ngày tuổi</th>
                      <th>Trọng lượng TB</th>
                      <th>Môi trường (IoT)</th>
                      <th>Trạng thái</th>
                      <th style={{ textAlign: 'right' }}>Camera & Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {area.barns.map(barn => (
                      <tr key={barn.id}>
                        <td>
                          <strong
                            style={{ color: 'var(--color-link)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            onClick={() => setSelectedBarnDetail({ ...barn, areaName: area.name, livestockType: area.livestockType })}
                          >
                            <Video size={13} color="#019788" />
                            {barn.name}
                          </strong>
                        </td>
                        <td>{barn.capacity.toLocaleString()} con</td>
                        <td>
                          <strong style={{ color: barn.current > 0 ? 'var(--color-ink)' : 'var(--color-muted)' }}>
                            {barn.current.toLocaleString()} con
                          </strong>
                        </td>
                        <td>{barn.ageDays > 0 ? `${barn.ageDays} ngày` : '—'}</td>
                        <td>{barn.avgWeight > 0 ? `${barn.avgWeight} kg` : '—'}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12.5px' }}>
                              <Thermometer size={14} color="var(--color-info)" /> {barn.temp}°C
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12.5px' }}>
                              <Droplets size={14} color="var(--fg-teal)" /> {barn.humidity}%
                            </span>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`farmshift-badge ${barn.status === 'Đang nuôi' ? 'farmshift-badge-success' : 'farmshift-badge-neutral'
                              }`}
                          >
                            {barn.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="farmshift-btn farmshift-btn-secondary"
                            style={{ fontSize: '12px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                            onClick={() => setSelectedBarnDetail({ ...barn, areaName: area.name, livestockType: area.livestockType })}
                          >
                            <Video size={13} color="#019788" /> Xem Camera & Chi tiết
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal: Chi tiết chuồng nuôi & Camera Trực Tiếp ────── */}
      {selectedBarnDetail && (
        <div className="farmshift-modal-backdrop">
          <div className="farmshift-modal" style={{ maxWidth: '850px' }}>
            <div className="farmshift-modal-header" style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-hairline)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: '#019788', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Video size={16} color="#ffffff" />
                </div>
                <div>
                  <h3 className="farmshift-modal-title" style={{ margin: 0, fontSize: '16px' }}>
                    Chi tiết & Giám sát Chuồng: {selectedBarnDetail.name} ({selectedBarnDetail.areaName})
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--color-muted)', marginTop: '2px' }}>
                    Giống: {selectedBarnDetail.livestockType} · Trạng thái: {selectedBarnDetail.status}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedBarnDetail(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="farmshift-modal-body" style={{ padding: '20px' }}>
              {/* 📹 CCTV Live Video Player Section */}
              <div style={{ marginBottom: '22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 600, color: 'var(--color-ink)' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }} />
                    <span>Camera Giám Sát Trực Tiếp (1080p HD Live Stream)</span>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                    Góc quay điều chỉnh PTZ · Hồng ngoại nhìn đêm · Đo nhiệt độ & quạt
                  </span>
                </div>

                <CctvPlayer
                  barn={{
                    name: selectedBarnDetail.name,
                    areaName: selectedBarnDetail.areaName,
                    livestockType: selectedBarnDetail.livestockType,
                    current: selectedBarnDetail.current,
                    capacity: selectedBarnDetail.capacity,
                    temp: selectedBarnDetail.temp,
                    humidity: selectedBarnDetail.humidity,
                    ageDays: selectedBarnDetail.ageDays,
                    fan: { on: selectedBarnDetail.current > 0, speed: 2 },
                    light: { on: selectedBarnDetail.current > 0 }
                  }}
                />
              </div>

              {/* Quick Summary Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                <div style={{ padding: '12px', borderRadius: 'var(--rounded-md)', backgroundColor: 'var(--color-surface-soft)', border: '1px solid var(--color-hairline)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>Số lượng đang nuôi</div>
                  <div style={{ fontSize: '20px', fontWeight: 500, color: 'var(--color-ink)', marginTop: '4px' }}>
                    {selectedBarnDetail.current.toLocaleString()} con
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: '2px' }}>
                    Sức chứa: {selectedBarnDetail.capacity.toLocaleString()}
                  </div>
                </div>

                <div style={{ padding: '12px', borderRadius: 'var(--rounded-md)', backgroundColor: 'var(--color-surface-soft)', border: '1px solid var(--color-hairline)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>Ngày tuổi & Cân nặng</div>
                  <div style={{ fontSize: '20px', fontWeight: 500, color: 'var(--color-ink)', marginTop: '4px' }}>
                    {selectedBarnDetail.ageDays} ngày ({selectedBarnDetail.avgWeight} kg)
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-success)', marginTop: '2px' }}>
                    Tăng trưởng chuẩn
                  </div>
                </div>

                <div style={{ padding: '12px', borderRadius: 'var(--rounded-md)', backgroundColor: 'var(--color-surface-soft)', border: '1px solid var(--color-hairline)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>Cảm biến môi trường (IoT)</div>
                  <div style={{ fontSize: '20px', fontWeight: 500, color: 'var(--color-ink)', marginTop: '4px' }}>
                    {selectedBarnDetail.temp}°C · {selectedBarnDetail.humidity}%
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-info)', marginTop: '2px' }}>
                    Quạt thông gió: Đang hoạt động
                  </div>
                </div>
              </div>

              {/* 📈 Biểu đồ biến động Nhiệt độ & Độ ẩm dạng chứng khoán */}
              <div style={{ marginBottom: '20px' }}>
                <StockTempChart
                  barnName={selectedBarnDetail.name}
                  areaName={selectedBarnDetail.areaName}
                  currentTemp={selectedBarnDetail.temp}
                  currentHumidity={selectedBarnDetail.humidity}
                  tempThreshold={29.5}
                  fan={{ on: selectedBarnDetail.current > 0, speed: 2 }}
                  onLiveTempChange={(bName, newT, newH) => {
                    setSelectedBarnDetail(prev => prev ? ({ ...prev, temp: newT, humidity: newH }) : prev);
                  }}
                />
              </div>

              {/* Livestock flock info */}
              <div style={{ marginBottom: '18px', padding: '14px', borderRadius: 'var(--rounded-md)', backgroundColor: 'var(--color-surface-soft)', border: '1px solid var(--color-hairline)' }}>
                <strong style={{ fontSize: '13.5px', color: 'var(--color-ink)' }}>Thông tin lứa nuôi & Giống</strong>
                <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--color-body)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>• Giống vật nuôi: <strong>{selectedBarnDetail.livestockType}</strong></div>
                  <div>• Nguồn gốc giống: <strong>Tập đoàn Dabaco</strong></div>
                  <div>• Ngày vào giống: <strong>01/09/2026</strong></div>
                  <div>• Dự kiến xuất chuồng: <strong>15/11/2026 (75 ngày)</strong></div>
                </div>
              </div>

              {/* Action buttons inside barn detail */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <Link
                  to="/journal"
                  className="farmshift-btn farmshift-btn-primary"
                  style={{ fontSize: '13px', padding: '8px 16px' }}
                >
                  <Utensils size={14} /> Ghi nhật ký chuồng này
                </Link>
                <Link
                  to="/sales"
                  className="farmshift-btn farmshift-btn-secondary"
                  style={{ fontSize: '13px', padding: '8px 16px' }}
                >
                  <ShoppingCart size={14} /> Lập phiếu xuất bán
                </Link>
              </div>
            </div>
            <div className="farmshift-modal-footer">
              <button
                className="farmshift-btn farmshift-btn-secondary"
                onClick={() => setSelectedBarnDetail(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Thêm mới khu nuôi (Thêm mới khu nuôi.html) ── */}
      {showAddAreaModal && (
        <div className="farmshift-modal-backdrop">
          <div className="farmshift-modal">
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title">Thêm mới khu nuôi</h3>
              <button
                onClick={() => setShowAddAreaModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateArea}>
              <div className="farmshift-modal-body">
                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Tên khu nuôi *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Khu C Thịt, Khu Vịt đẻ..."
                    className="farmshift-form-control"
                    value={newArea.name}
                    onChange={(e) => setNewArea({ ...newArea, name: e.target.value })}
                  />
                </div>

                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Loại vật nuôi</label>
                  <select
                    className="farmshift-form-control"
                    value={newArea.livestockType}
                    onChange={(e) => setNewArea({ ...newArea, livestockType: e.target.value })}
                  >
                    <option value="Gia cầm (Gà thịt)">Gia cầm (Gà thịt)</option>
                    <option value="Gia cầm (Gà đẻ trứng)">Gia cầm (Gà đẻ trứng)</option>
                    <option value="Gia cầm (Vịt, Ngan)">Gia cầm (Vịt, Ngan)</option>
                    <option value="Gia súc (Heo thịt)">Gia súc (Heo thịt)</option>
                    <option value="Thủy sản">Thủy sản</option>
                  </select>
                </div>

                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Số chuồng ban đầu</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    className="farmshift-form-control"
                    value={newArea.barnCount}
                    onChange={(e) => setNewArea({ ...newArea, barnCount: e.target.value })}
                  />
                </div>

                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Mô tả hạ tầng chuồng trại</label>
                  <textarea
                    rows="3"
                    placeholder="Mô tả quạt hút, cooling pad, diện tích..."
                    className="farmshift-form-control"
                    value={newArea.description}
                    onChange={(e) => setNewArea({ ...newArea, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="farmshift-modal-footer">
                <button
                  type="button"
                  className="farmshift-btn farmshift-btn-secondary"
                  onClick={() => setShowAddAreaModal(false)}
                >
                  Hủy bỏ
                </button>
                <button type="submit" className="farmshift-btn farmshift-btn-primary">
                  Lưu khu nuôi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Tạo Chuồng (Khu J Thịt.html / Tạo Chuồng parity) ── */}
      {showAddBarnModal && (
        <div className="farmshift-modal-backdrop">
          <div className="farmshift-modal">
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title">Tạo Chuồng nuôi mới</h3>
              <button
                onClick={() => setShowAddBarnModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateBarn}>
              <div className="farmshift-modal-body">
                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Thuộc khu nuôi *</label>
                  <select
                    className="farmshift-form-control"
                    value={newBarn.areaId}
                    onChange={(e) => setNewBarn({ ...newBarn, areaId: e.target.value })}
                  >
                    {areas.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>

                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Tên chuồng *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Nhà A4, Nhà B3, Nhà Úm 1..."
                    className="farmshift-form-control"
                    value={newBarn.name}
                    onChange={(e) => setNewBarn({ ...newBarn, name: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Quy mô thiết kế (con)</label>
                    <input
                      type="number"
                      required
                      className="farmshift-form-control"
                      value={newBarn.capacity}
                      onChange={(e) => setNewBarn({ ...newBarn, capacity: e.target.value })}
                    />
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Số con nhập ban đầu</label>
                    <input
                      type="number"
                      className="farmshift-form-control"
                      value={newBarn.current}
                      onChange={(e) => setNewBarn({ ...newBarn, current: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Ngày tuổi</label>
                    <input
                      type="number"
                      className="farmshift-form-control"
                      value={newBarn.ageDays}
                      onChange={(e) => setNewBarn({ ...newBarn, ageDays: e.target.value })}
                    />
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Cân nặng trung bình (kg)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="farmshift-form-control"
                      value={newBarn.avgWeight}
                      onChange={(e) => setNewBarn({ ...newBarn, avgWeight: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="farmshift-modal-footer">
                <button
                  type="button"
                  className="farmshift-btn farmshift-btn-secondary"
                  onClick={() => setShowAddBarnModal(false)}
                >
                  Bỏ qua
                </button>
                <button type="submit" className="farmshift-btn farmshift-btn-primary">
                  Tạo chuồng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </FarmShiftLayout>
  );
};
