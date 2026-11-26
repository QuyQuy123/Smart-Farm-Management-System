// src/features/farmshift/reports/ActivityLogTab.jsx
import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { ResponsiveDataTable } from '../../../components/common/ResponsiveDataTable';
import styles from '../ReportsView.module.css';
import { classifyActivityActionType, fmtDateTime } from './reportUtils';

const ACTION_TYPE_OPTIONS = [
  { value: 'ALL', label: 'Tất cả hành động' },
  { value: 'CREATE', label: 'Tạo mới' },
  { value: 'UPDATE', label: 'Cập nhật' },
  { value: 'DELETE', label: 'Xóa / Hủy' },
  { value: 'STOCK', label: 'Xuất nhập kho' },
];

export function ActivityLogTab({ activityBaseItems, renderActivityRefLink, searchTerm, onSearchChange }) {
  const [actorFilter, setActorFilter] = useState('ALL');
  const [actionTypeFilter, setActionTypeFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const actorOptions = useMemo(() => {
    const set = new Set(activityBaseItems.map((a) => a.actor).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [activityBaseItems]);

  const filteredItems = useMemo(() => {
    return activityBaseItems.filter((a) => {
      if (actorFilter !== 'ALL' && a.actor !== actorFilter) return false;
      if (actionTypeFilter !== 'ALL' && classifyActivityActionType(a) !== actionTypeFilter) return false;
      return true;
    });
  }, [activityBaseItems, actorFilter, actionTypeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, safePage]);

  const columns = useMemo(() => [
    {
      key: 'timestamp',
      label: 'Thời gian',
      primary: true,
      render: (_, a) => fmtDateTime(a.timestamp || a.date),
    },
    { key: 'actor', label: 'Nhân sự' },
    {
      key: 'module',
      label: 'Phân hệ',
      isBadge: true,
      render: (mod) => <span className={styles.sageBadge}>{mod || '—'}</span>,
    },
    { key: 'action', label: 'Hành động' },
    { key: 'detail', label: 'Nội dung chi tiết', hideOnTablet: true },
    {
      key: 'referenceCode',
      label: 'Chứng từ',
      render: (_, a) => renderActivityRefLink(a),
    },
  ], [renderActivityRefLink]);

  return (
    <div className={styles.stack}>
      <div className="farmshift-card">
        <div className={styles.sectionToolbar}>
          <div className={styles.activityFilterGroup}>
            <select
              aria-label="Lọc theo nhân sự thao tác"
              className={styles.selectFilter}
              value={actorFilter}
              onChange={(e) => {
                setActorFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">Tất cả nhân sự</option>
              {actorOptions.map((actor) => (
                <option key={actor} value={actor}>{actor}</option>
              ))}
            </select>

            <select
              aria-label="Lọc theo loại hành động"
              className={styles.selectFilter}
              value={actionTypeFilter}
              onChange={(e) => {
                setActionTypeFilter(e.target.value);
                setPage(1);
              }}
            >
              {ACTION_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.searchWrap}>
            <Search size={15} className={styles.searchIcon} />
            <input
              type="search"
              className={styles.searchInput}
              aria-label="Tìm kiếm nhật ký hoạt động"
              placeholder="Tìm nhân sự, thao tác, chứng từ..."
              value={searchTerm}
              onChange={(e) => {
                onSearchChange(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        <ResponsiveDataTable
          columns={columns}
          data={pagedItems}
          rowKey={(row, idx) => row.id ?? `${row.timestamp}-${idx}`}
          mode="card-on-mobile"
          tableClassName={styles.compactTable}
          emptyState="Chưa có hoạt động nào khớp với bộ lọc."
          pagination={{
            page: safePage,
            totalPages,
            totalItems: filteredItems.length,
            onPageChange: setPage,
          }}
        />
      </div>
    </div>
  );
}
