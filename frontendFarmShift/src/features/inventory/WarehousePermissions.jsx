// src/features/inventory/WarehousePermissions.jsx
// Phân quyền quản lý kho hàng — UI_FarmShift.pdf pages 5 + 6 (with modal)
import React, { useState } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { Modal } from '../../components/Modal/Modal';
import { Button } from '../../components/Button/Button';
import { Badge } from '../../components/Badge/Badge';
import { Plus } from 'lucide-react';
import styles from './Inventory.module.css';

/* ── Mock data ─────────────────────────────────────────────── */
const ZONES = [
  {
    id: 'KhoA',
    name: 'Kho cám Khu A',
    workers: [
      { id: 'w1', name: 'Nguyễn A', avatar: '👷', role: 'Xem', color: '#fef9c3' },
      { id: 'w2', name: 'Trần B',   avatar: '👷', role: 'Phân bổ', color: '#dcfce7' },
    ],
  },
  {
    id: 'KhoB',
    name: 'Kho Cám Khu B',
    workers: [
      { id: 'w3', name: 'Lê C',   avatar: '👷', role: 'Xem', color: '#fef9c3' },
      { id: 'w4', name: 'Phạm D', avatar: '🚫', role: 'Không', color: '#fee2e2' },
    ],
  },
  { id: 'KhoC', name: 'Kho thuốc', workers: [
    { id: 'w5', name: 'Hoàng E', avatar: '👷', role: 'Xem', color: '#fef9c3' },
    { id: 'w6', name: 'Đỗ F',    avatar: '🚫', role: 'Không', color: '#fee2e2' },
  ]},
  { id: 'KhoD', name: 'Kho vắc-xin', workers: [
    { id: 'w7', name: 'Vũ G', avatar: '👷', role: 'Xem', color: '#fef9c3' },
  ]},
  { id: 'GiaSuc', name: 'Gia súc', workers: [
    { id: 'w8', name: 'Bùi H', avatar: '👷', role: 'Xem', color: '#fef9c3' },
  ]},
  { id: 'GiaGem', name: 'Gia cầm', workers: [
    { id: 'w9', name: 'Ngô I', avatar: '👷', role: 'Xem', color: '#fef9c3' },
  ]},
  { id: 'TrangTrai', name: 'Trang trại nuôi cá', workers: [
    { id: 'w10', name: 'Mai J', avatar: '👷', role: 'Xem', color: '#fef9c3' },
  ]},
  { id: 'KhoYeu', name: 'Kho yếu phẩm vào ở', workers: [
    { id: 'w11', name: 'Cao K', avatar: '👷', role: 'Xem', color: '#fef9c3' },
  ]},
];

/* ── Detail Modal for one zone ──────────────────────────────── */
function ZoneDetailModal({ zone, onClose }) {
  return (
    <Modal
      isOpen={!!zone}
      onClose={onClose}
      title={zone?.name || ''}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Đóng lại</Button>
          <Button variant="green">Lưu thay đổi</Button>
        </>
      }
    >
      {zone && (
        <div>
          <div style={{ marginBottom: 'var(--sp-sm)', fontWeight: 500, color: 'var(--color-ink)' }}>
            Danh sách nhân công ({zone.workers.length})
          </div>
          {/* Permission filter tabs */}
          <div style={{ display: 'flex', gap: 'var(--sp-xs)', marginBottom: 'var(--sp-md)' }}>
            <Badge variant="active">Xem Phần bổ</Badge>
            <Badge variant="info">Lọc theo người +</Badge>
          </div>
          {/* Worker list */}
          <div>
            {zone.workers.map(w => (
              <div key={w.id} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)',
                padding: '8px 0', borderBottom: '1px solid var(--color-surface-soft)'
              }}>
                <div className={styles.permAvatar} style={{ backgroundColor: w.color, fontSize: 18 }}>
                  {w.avatar}
                </div>
                <span style={{ flex: 1, fontSize: 'var(--fs-body-md)', color: 'var(--color-ink)' }}>
                  {w.name}
                </span>
                <Badge variant={w.role === 'Xem' ? 'info' : w.role === 'Phân bổ' ? 'active' : 'error'}>
                  {w.role}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ── WarehousePermissions ─────────────────────────────────── */
export const WarehousePermissions = () => {
  const [selectedZone, setSelectedZone] = useState(null);

  const BREADCRUMBS = [
    { label: 'Livestock Farm', path: '/owner-dashboard' },
    { label: 'Hàng hóa', path: '/owner-dashboard/inventory' },
    { label: 'Phân quyền quản lý kho hàng' },
  ];

  return (
    <DashboardLayout breadcrumbs={BREADCRUMBS}>
      {/* Page header */}
      <div style={{ marginBottom: 'var(--sp-lg)' }}>
        <h2 style={{ fontSize: 'var(--fs-title-md)', fontWeight: 'var(--fw-medium)', color: 'var(--color-ink)', margin: 0 }}>
          Phân quyền quản lý kho hàng
        </h2>
      </div>

      {/* Permissions table */}
      <div style={{
        background: 'var(--color-canvas)',
        border: '1px solid var(--color-hairline)',
        borderRadius: 'var(--rounded-md)',
        overflow: 'hidden',
      }}>
        {/* Header row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px var(--sp-md)',
          background: 'var(--color-surface-soft)',
          borderBottom: '1px solid var(--color-hairline)',
          fontSize: '11px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.4px',
          color: 'var(--color-muted)',
          gap: 'var(--sp-md)',
        }}>
          <span style={{ minWidth: 160 }}>Tên khu vực</span>
          <span style={{ flex: 1 }}>NHÂN CÔNG</span>
          <span style={{ minWidth: 80, textAlign: 'right' }}></span>
        </div>

        {/* Zone rows */}
        {ZONES.map(zone => (
          <div key={zone.id} className={styles.permRow}>
            <span className={styles.permZoneName}>{zone.name}</span>
            <div className={styles.permAvatars}>
              {zone.workers.slice(0, 4).map(w => (
                <div
                  key={w.id}
                  className={styles.permAvatar}
                  style={{ backgroundColor: w.color }}
                  title={w.name}
                >
                  {w.avatar}
                </div>
              ))}
              {zone.workers.length > 4 && (
                <div className={styles.permAvatar} style={{ background: 'var(--color-surface-strong)', fontSize: 12, fontWeight: 600, color: 'var(--color-muted)' }}>
                  +{zone.workers.length - 4}
                </div>
              )}
            </div>
            <button
              className={styles.editLink}
              onClick={() => setSelectedZone(zone)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Chỉnh sửa
            </button>
          </div>
        ))}
      </div>

      {/* Zone Detail Modal (page 6) */}
      <ZoneDetailModal zone={selectedZone} onClose={() => setSelectedZone(null)} />
    </DashboardLayout>
  );
};
