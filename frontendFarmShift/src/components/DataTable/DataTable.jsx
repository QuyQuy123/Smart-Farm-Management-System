// src/components/DataTable/DataTable.jsx
// Generic table component — used by all listing pages in farmgo PDF
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import styles from './DataTable.module.css';

/**
 * @param {Array}  columns  — [{ key, label, render?, width?, align? }]
 * @param {Array}  data     — array of row objects
 * @param {string} rowKey   — unique key field name (default 'id')
 * @param {number} pageSize — rows per page (default 10)
 * @param {boolean} loading
 * @param {React.ReactNode} toolbar — slot above table (buttons, filters)
 * @param {React.ReactNode} emptyState
 */
export const DataTable = ({
  columns   = [],
  data      = [],
  rowKey    = 'id',
  pageSize  = 15,
  loading   = false,
  toolbar,
  emptyState,
  onRowClick,
}) => {
  const [page, setPage] = useState(1);
  const total      = data.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start      = (page - 1) * pageSize;
  const pageData   = data.slice(start, start + pageSize);

  const goTo = (p) => setPage(Math.min(Math.max(1, p), totalPages));

  return (
    <div className={styles.wrap}>
      {/* Toolbar slot */}
      {toolbar && <div className={styles.toolbar}>{toolbar}</div>}

      {/* Table wrapper — horizontal scroll on small screens */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  className={styles.th}
                  style={{
                    width:     col.width  || undefined,
                    textAlign: col.align  || 'left',
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className={styles.emptyCell}>
                  <span className={styles.loadingDots}>Đang tải...</span>
                </td>
              </tr>
            ) : pageData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className={styles.emptyCell}>
                  {emptyState || 'Không có dữ liệu'}
                </td>
              </tr>
            ) : (
              pageData.map((row, rIdx) => (
                <tr
                  key={row[rowKey] ?? rIdx}
                  className={`${styles.tr} ${onRowClick ? styles.trClickable : ''}`}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map(col => (
                    <td
                      key={col.key}
                      className={styles.td}
                      style={{ textAlign: col.align || 'left' }}
                    >
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > pageSize && (
        <div className={styles.pagination}>
          <span className={styles.pageInfo}>
            {start + 1}–{Math.min(start + pageSize, total)} / {total}
          </span>
          <div className={styles.pageControls}>
            <button className={styles.pageBtn} onClick={() => goTo(1)} disabled={page === 1} aria-label="Trang đầu">
              <ChevronsLeft size={14} />
            </button>
            <button className={styles.pageBtn} onClick={() => goTo(page - 1)} disabled={page === 1} aria-label="Trang trước">
              <ChevronLeft size={14} />
            </button>
            <span className={styles.pageCurrent}>{page} / {totalPages}</span>
            <button className={styles.pageBtn} onClick={() => goTo(page + 1)} disabled={page === totalPages} aria-label="Trang sau">
              <ChevronRight size={14} />
            </button>
            <button className={styles.pageBtn} onClick={() => goTo(totalPages)} disabled={page === totalPages} aria-label="Trang cuối">
              <ChevronsRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
