// src/components/common/ResponsiveDataTable.jsx
// Standardized responsive table supporting 3 modes: card-on-mobile, sticky-table, timeline
import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { useViewport } from '../../hooks/useViewport';
import styles from './ResponsiveDataTable.module.css';

const resolveRowKey = (row, rowKey, index) => {
  if (typeof rowKey === 'function') return rowKey(row, index);
  if (typeof rowKey === 'string' && row && row[rowKey] !== undefined) return row[rowKey];
  return row?.id ?? index;
};

const renderCellValue = (col, row, index) => {
  if (typeof col.render === 'function') return col.render(row?.[col.key], row, index);
  const val = row?.[col.key];
  return val === null || val === undefined || val === '' ? '—' : val;
};

const DefaultMobileCard = ({ row, index, columns, isExpanded, onToggleExpand, onRowClick }) => {
  const actionCol = columns.find(c => c.isAction || c.key === 'actions');
  const badgeCol = columns.find(c => c.isBadge || c.key === 'status');
  const contentCols = columns.filter(c => c !== actionCol && c !== badgeCol);
  const titleCol = contentCols.find(c => c.primary) || contentCols[0];
  const restCols = contentCols.filter(c => c !== titleCol);
  const metricCols = restCols.filter(c => !c.hideOnMobileSummary).slice(0, 4);
  const extraCols = restCols.filter(c => !metricCols.includes(c));

  return (
    <div
      className={`${styles.mobileCard} ${onRowClick ? styles.mobileCardClickable : ''}`}
      data-testid="responsive-mobile-card"
      onClick={() => onRowClick?.(row)}
    >
      {/* Tier 1: Header */}
      <div className={styles.cardHeader}>
        <div className={styles.cardTitle}>
          {titleCol ? renderCellValue(titleCol, row, index) : '—'}
        </div>
        {badgeCol && (
          <div className={styles.cardBadge}>
            {renderCellValue(badgeCol, row, index)}
          </div>
        )}
      </div>

      {/* Tier 2: 2-Column KPI Body */}
      {metricCols.length > 0 && (
        <div className={styles.cardBodyGrid}>
          {metricCols.map(col => (
            <div key={col.key} className={styles.cardMetric}>
              <span className={styles.cardMetricLabel}>{col.label}</span>
              <span className={styles.cardMetricVal}>{renderCellValue(col, row, index)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tier 3: Expandable Secondary Details + Action Buttons */}
      {isExpanded && extraCols.length > 0 && (
        <div className={styles.cardExtraDetails}>
          {extraCols.map(col => (
            <div key={col.key} className={styles.cardExtraRow}>
              <span className={styles.cardExtraLabel}>{col.label}</span>
              <span className={styles.cardExtraVal}>{renderCellValue(col, row, index)}</span>
            </div>
          ))}
        </div>
      )}

      {(extraCols.length > 0 || actionCol) && (
        <div
          className={styles.cardFooter}
          onClick={e => e.stopPropagation()}
        >
          {extraCols.length > 0 && (
            <button
              type="button"
              className={styles.expandBtn}
              aria-expanded={isExpanded}
              onClick={onToggleExpand}
            >
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              <span>{isExpanded ? 'Thu gọn' : 'Chi tiết'}</span>
            </button>
          )}
          {actionCol && (
            <div className={styles.cardActions}>
              {renderCellValue(actionCol, row, index)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const ResponsiveDataTable = ({
  columns = [],
  data = [],
  rowKey = 'id',
  mode = 'card-on-mobile',
  renderMobileCard,
  renderTimelineItem,
  getTimelineDate,
  summaryItems = [],
  pagination = null,
  initialVisibleCount = 0,
  loadMoreStep = 40,
  emptyState = 'Không có dữ liệu',
  loading = false,
  onRowClick,
  className = '',
  tableClassName = '',
}) => {
  const { isMobile, isTablet } = useViewport();
  const [expandedKeys, setExpandedKeys] = useState(() => new Set());
  const [extraLoaded, setExtraLoaded] = useState(0);

  const toggleExpand = (key) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const rows = Array.isArray(data) ? data : [];
  const effectiveLimit = initialVisibleCount > 0 ? initialVisibleCount + extraLoaded : Infinity;
  const displayedRows = initialVisibleCount > 0 ? rows.slice(0, effectiveLimit) : rows;
  const remainingCount = Math.max(0, rows.length - displayedRows.length);

  const visibleColumns = useMemo(() => {
    if (isTablet && mode === 'card-on-mobile') {
      return columns.filter(col => !col.hideOnTablet);
    }
    return columns;
  }, [columns, isTablet, mode]);

  const timelineGroups = useMemo(() => {
    if (mode !== 'timeline' || !isMobile) return [];
    const map = new Map();
    displayedRows.forEach((row, idx) => {
      const groupLabel = typeof getTimelineDate === 'function'
        ? (getTimelineDate(row) || 'Khác')
        : (row?.dateLabel || row?.date || 'Khác');
      if (!map.has(groupLabel)) map.set(groupLabel, []);
      map.get(groupLabel).push({ row, idx });
    });
    return Array.from(map.entries());
  }, [mode, isMobile, displayedRows, getTimelineDate]);

  const renderSummaryStrip = () => {
    if (!Array.isArray(summaryItems) || summaryItems.length === 0) return null;
    return (
      <div className={styles.summaryStrip} data-testid="responsive-summary-strip">
        {summaryItems.map((item, idx) => (
          <div
            key={item.key || item.label || idx}
            className={`${styles.summaryCard} ${item.tone ? styles[`tone_${item.tone}`] || '' : ''}`}
          >
            <span className={styles.summaryLabel}>{item.label}</span>
            <strong className={styles.summaryValue}>{item.value}</strong>
            {item.sub && <span className={styles.summarySub}>{item.sub}</span>}
          </div>
        ))}
      </div>
    );
  };

  const renderPagination = () => {
    if (!pagination || !pagination.totalPages || pagination.totalPages <= 1) return null;
    const { page = 1, totalPages = 1, onPageChange, totalItems } = pagination;

    return (
      <div className={styles.pagination} data-testid="responsive-pagination">
        {!isMobile && totalItems !== undefined && (
          <span className={styles.pageMeta}>Tổng {totalItems} mục</span>
        )}
        <div className={styles.pageControls}>
          <button
            type="button"
            className={styles.pageBtn}
            disabled={page <= 1}
            onClick={() => onPageChange?.(Math.max(1, page - 1))}
            aria-label="Trang trước"
          >
            <ChevronLeft size={16} />
            <span>Trước</span>
          </button>
          <span className={styles.pageCurrent}>
            Trang {page} / {totalPages}
          </span>
          <button
            type="button"
            className={styles.pageBtn}
            disabled={page >= totalPages}
            onClick={() => onPageChange?.(Math.min(totalPages, page + 1))}
            aria-label="Trang sau"
          >
            <span>Sau</span>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  };

  const renderLoadMore = () => {
    if (remainingCount <= 0) return null;
    return (
      <div className={styles.loadMoreWrap}>
        <button
          type="button"
          className={styles.loadMoreBtn}
          data-testid="responsive-load-more-btn"
          onClick={() => setExtraLoaded(prev => prev + loadMoreStep)}
        >
          Xem thêm ({remainingCount} dòng còn lại)
        </button>
      </div>
    );
  };

  const renderContent = () => {
    if (loading) {
      return <div className={styles.stateBox}>Đang tải dữ liệu...</div>;
    }

    if (displayedRows.length === 0) {
      return (
        <div className={styles.stateBox} data-testid="responsive-empty-state">
          {emptyState}
        </div>
      );
    }

    // Mode 1: Mobile Cards (< 768px)
    if (isMobile && mode === 'card-on-mobile') {
      return (
        <div className={styles.cardList} data-testid="responsive-card-list">
          {displayedRows.map((row, idx) => {
            const key = resolveRowKey(row, rowKey, idx);
            const isExpanded = expandedKeys.has(key);
            if (typeof renderMobileCard === 'function') {
              return (
                <div key={key} className={styles.customCardSlot} data-testid="responsive-mobile-card">
                  {renderMobileCard(row, {
                    index: idx,
                    isExpanded,
                    toggleExpand: () => toggleExpand(key),
                  })}
                </div>
              );
            }
            return (
              <DefaultMobileCard
                key={key}
                row={row}
                index={idx}
                columns={columns}
                isExpanded={isExpanded}
                onToggleExpand={() => toggleExpand(key)}
                onRowClick={onRowClick}
              />
            );
          })}
        </div>
      );
    }

    // Mode 3: Mobile Timeline (< 768px) with sticky date headers
    if (isMobile && mode === 'timeline') {
      return (
        <div className={styles.timelineList} data-testid="responsive-timeline">
          {timelineGroups.map(([dateLabel, items]) => (
            <div key={dateLabel} className={styles.timelineGroup}>
              <div className={styles.timelineDateHeader} data-testid="timeline-date-header">
                {dateLabel}
              </div>
              <div className={styles.timelineItems}>
                {items.map(({ row, idx }) => {
                  const key = resolveRowKey(row, rowKey, idx);
                  return (
                    <div
                      key={key}
                      className={styles.timelineCard}
                      onClick={() => onRowClick?.(row)}
                    >
                      {typeof renderTimelineItem === 'function'
                        ? renderTimelineItem(row, idx)
                        : (
                          <div className={styles.timelineDefault}>
                            {columns.slice(0, 4).map(col => (
                              <div key={col.key} className={styles.timelineField}>
                                <span className={styles.timelineFieldLabel}>{col.label}:</span>{' '}
                                <span className={styles.timelineFieldVal}>{renderCellValue(col, row, idx)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Desktop Table / Tablet Condensed Table / Sticky Comparison Table
    const isStickyMode = mode === 'sticky-table';
    return (
      <div
        className={`${styles.tableScrollWrap} ${isStickyMode ? styles.stickyTableWrap : ''}`}
        data-testid={isStickyMode ? 'responsive-sticky-table' : 'responsive-table'}
      >
        <table className={`${styles.table} ${tableClassName}`}>
          <thead>
            <tr>
              {visibleColumns.map((col, colIdx) => {
                const pinned = isStickyMode && (col.sticky || colIdx === 0);
                return (
                  <th
                    key={col.key}
                    className={`${styles.th} ${pinned ? styles.stickyCol : ''}`}
                    style={{
                      width: col.width || undefined,
                      textAlign: col.align || 'left',
                    }}
                  >
                    {col.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {displayedRows.map((row, rIdx) => {
              const key = resolveRowKey(row, rowKey, rIdx);
              return (
                <tr
                  key={key}
                  className={`${styles.tr} ${onRowClick ? styles.trClickable : ''}`}
                  onClick={() => onRowClick?.(row)}
                >
                  {visibleColumns.map((col, colIdx) => {
                    const pinned = isStickyMode && (col.sticky || colIdx === 0);
                    return (
                      <td
                        key={col.key}
                        className={`${styles.td} ${pinned ? styles.stickyCol : ''}`}
                        style={{ textAlign: col.align || 'left' }}
                      >
                        {renderCellValue(col, row, rIdx)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className={`${styles.root} ${className}`}>
      {renderSummaryStrip()}
      {renderContent()}
      {renderLoadMore()}
      {renderPagination()}
    </div>
  );
};
