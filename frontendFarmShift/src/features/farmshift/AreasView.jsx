import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronLeft, ChevronRight,
  Eye, FileSpreadsheet, Info, Layers, MoreVertical, Pencil, PlusCircle, Trash2, Warehouse,
} from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { getFarmArea, listBarns, listFarmAreas } from '../../services/farmAreaService';
import { BARN_PURPOSES, BARN_STATUSES, apiErrorMessage, labelOf } from './farmAreaOptions';
import { AreaDialog, BarnDialog, DeleteDialog } from './FarmAreaDialogs';
import styles from './AreasView.module.css';

const PAGE_SIZES = [10, 15, 20, 25, 30, 40, 50];
const formatDate = value => value ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value)) : '—';
const formatNumber = value => Number(value || 0).toLocaleString('vi-VN');
const contains = (value, needle) => !needle || String(value ?? '').toLocaleLowerCase('vi').includes(needle.trim().toLocaleLowerCase('vi'));
const sameDay = (value, day) => !day || String(value || '').slice(0, 10) === day;
const byCreated = direction => (a, b) => direction * (String(a.createdAt).localeCompare(String(b.createdAt)) || a.id - b.id);

function RowMenu({ label, items }) {
  // Fixed positioning keeps the menu above the table's scroll container instead of being clipped by it.
  const [position, setPosition] = useState(null);
  const ref = useRef(null);
  const open = position !== null;
  useEffect(() => {
    if (!open) return undefined;
    const close = event => { if (!ref.current?.contains(event.target)) setPosition(null); };
    const escape = event => { if (event.key === 'Escape') setPosition(null); };
    const dismiss = () => setPosition(null);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', dismiss);
    window.addEventListener('scroll', dismiss, true);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('scroll', dismiss, true);
    };
  }, [open]);
  const toggle = event => {
    if (open) { setPosition(null); return; }
    const rect = event.currentTarget.getBoundingClientRect();
    const menuHeight = items.length * 38 + 12;
    const top = rect.bottom + 4 + menuHeight > window.innerHeight ? Math.max(8, rect.top - 4 - menuHeight) : rect.bottom + 4;
    setPosition({ top, right: Math.max(8, window.innerWidth - rect.right) });
  };
  return <div className={styles.rowMenu} ref={ref}>
    <button type="button" className={styles.kebab} aria-label={`Thao tác ${label}`} aria-haspopup="menu" aria-expanded={open} onClick={toggle}>
      <MoreVertical size={18} />
    </button>
    {open && <div role="menu" className={styles.menu} style={position}>
      {items.map(({ label: text, icon: Icon, onClick, danger }) => <button key={text} type="button" role="menuitem"
        className={danger ? styles.menuDanger : ''} onClick={() => { setPosition(null); onClick(); }}>
        <Icon size={15} />{text}
      </button>)}
    </div>}
  </div>;
}

function Pager({ total, page, pageSize, unit, onPage, onPageSize }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return <div className={styles.pager}>
    <label className={styles.pageSize}>Hiển thị:
      <select value={pageSize} onChange={event => onPageSize(Number(event.target.value))} aria-label="Số dòng mỗi trang">
        {PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
      </select>
    </label>
    <span className={styles.range}>{from}-{to}/{total} {unit}</span>
    {pages > 1 && <span className={styles.pageButtons}>
      <button type="button" className={styles.iconButton} onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Trang trước"><ChevronLeft size={16} /></button>
      <span>{page}/{pages}</span>
      <button type="button" className={styles.iconButton} onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Trang sau"><ChevronRight size={16} /></button>
    </span>}
  </div>;
}

const exportCsv = (filename, header, rows) => {
  const escape = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map(row => row.map(escape).join(',')).join('\r\n');
  // The BOM makes Excel open Vietnamese text as UTF-8.
  const url = URL.createObjectURL(new Blob([`${String.fromCharCode(0xfeff)}${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const usePaging = (items, filterKey) => {
  // The page is remembered per filter combination, so changing a filter returns to page 1.
  const [paging, setPaging] = useState({ key: filterKey, page: 1 });
  const [pageSize, setPageSize] = useState(15);
  const page = paging.key === filterKey ? paging.page : 1;
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pages);
  const setPage = value => setPaging({ key: filterKey, page: value });
  return {
    rows: items.slice((current - 1) * pageSize, current * pageSize),
    pager: { total: items.length, page: current, pageSize, onPage: setPage, onPageSize: size => { setPageSize(size); setPage(1); } },
  };
};

function SortButton({ direction, onToggle }) {
  return <button type="button" className={styles.filterButton} onClick={onToggle}
    aria-label={direction > 0 ? 'Sắp xếp ngày tạo giảm dần' : 'Sắp xếp ngày tạo tăng dần'} title="Đổi thứ tự sắp xếp">
    {direction > 0 ? <ArrowUpNarrowWide size={16} /> : <ArrowDownWideNarrow size={16} />}
  </button>;
}

function AreaList({ areas, canEdit, onOpen }) {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ name: '', barns: '', description: '', date: '' });
  const [direction, setDirection] = useState(1);
  const set = key => event => setFilters(current => ({ ...current, [key]: event.target.value }));
  const filtered = useMemo(() => areas.filter(area => contains(area.name, filters.name)
    && (filters.barns === '' || area.barnCount === Number(filters.barns))
    && contains(area.description, filters.description)
    && sameDay(area.createdAt, filters.date)).sort(byCreated(direction)), [areas, filters, direction]);
  const { rows, pager } = usePaging(filtered, JSON.stringify([filters, direction]));

  const exportAreas = () => exportCsv('danh-sach-khu-nuoi.csv',
    ['Mã khu', 'Tên khu nuôi', 'Số chuồng', 'Chuồng đang hoạt động', 'Tổng số con', 'Mô tả', 'Ngày tạo'],
    filtered.map(area => [area.code, area.name, area.barnCount, area.activeBarnCount, area.animalCount, area.description, formatDate(area.createdAt)]));

  return <>
    <div className={styles.toolbar}>
      <Pager {...pager} unit="khu nuôi" />
      <div className={styles.toolbarActions}>
        <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => navigate(-1)}><ArrowLeft size={15} />Quay lại</button>
        <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={exportAreas} disabled={!filtered.length}><FileSpreadsheet size={15} />Excel</button>
        {canEdit && <button type="button" className="farmshift-btn farmshift-btn-mint" onClick={() => onOpen({ type: 'area' })}><PlusCircle size={16} />Tạo khu nuôi</button>}
      </div>
    </div>
    <div className="farmshift-table-container" style={{ border: 0 }}>
      <table className={`farmshift-table ${styles.table}`}>
        <thead>
          <tr><th>Tên khu nuôi</th><th>Số chuồng</th><th>Mô tả</th><th>Ngày tạo</th><th aria-label="Thao tác" /></tr>
          <tr className={styles.filterRow}>
            <th><input aria-label="Lọc tên khu nuôi" placeholder="Tìm kiếm..." value={filters.name} onChange={set('name')} /></th>
            <th><input aria-label="Lọc số chuồng" type="number" min="0" value={filters.barns} onChange={set('barns')} /></th>
            <th><input aria-label="Lọc mô tả" placeholder="Tìm kiếm..." value={filters.description} onChange={set('description')} /></th>
            <th><div className={styles.dateFilter}><input aria-label="Lọc ngày tạo khu nuôi" type="date" value={filters.date} onChange={set('date')} />
              <SortButton direction={direction} onToggle={() => setDirection(value => -value)} /></div></th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? <tr><td colSpan={5} className={styles.empty}>{areas.length ? 'Không có khu nuôi phù hợp với bộ lọc.' : canEdit ? 'Chưa có khu nuôi. Bấm "Tạo khu nuôi" để quy hoạch khu đầu tiên.' : 'Chưa có khu nuôi nào.'}</td></tr>
            : rows.map(area => <tr key={area.id}>
              <td><Link to={`/areas/${area.id}`} className={styles.nameLink}>{area.name}</Link></td>
              <td><strong>{formatNumber(area.barnCount)}</strong> <span className={styles.muted}>({formatNumber(area.activeBarnCount)} đang nuôi)</span></td>
              <td className={styles.description}>{area.description || '—'}</td>
              <td className={styles.date}>{formatDate(area.createdAt)}</td>
              <td className={styles.actionCell}><RowMenu label={area.name} items={[
                { label: 'Xem danh sách chuồng', icon: Eye, onClick: () => navigate(`/areas/${area.id}`) },
                ...(canEdit ? [
                  { label: 'Thêm chuồng vào khu', icon: PlusCircle, onClick: () => onOpen({ type: 'barn', defaultAreaId: area.id }) },
                  { label: 'Chỉnh sửa khu nuôi', icon: Pencil, onClick: () => onOpen({ type: 'area', item: area }) },
                  { label: 'Xóa khu nuôi', icon: Trash2, danger: true, onClick: () => onOpen({ type: 'delete', kind: 'area', item: area }) },
                ] : []),
              ]} /></td>
            </tr>)}
        </tbody>
      </table>
    </div>
  </>;
}

function BarnList({ barns, areas, area, canEdit, onOpen }) {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ name: '', areaId: '', purpose: '', status: '', quantity: '', target: '', date: '' });
  const [direction, setDirection] = useState(1);
  const set = key => event => setFilters(current => ({ ...current, [key]: event.target.value }));
  const filtered = useMemo(() => barns.filter(barn => contains(barn.name, filters.name)
    && (!filters.areaId || String(barn.areaId) === filters.areaId)
    && (!filters.purpose || barn.purpose === filters.purpose)
    && (!filters.status || barn.status === filters.status)
    && contains(barn.currentQuantity, filters.quantity)
    && contains(barn.targetWeight ?? '', filters.target)
    && sameDay(barn.createdAt, filters.date)).sort(byCreated(direction)), [barns, filters, direction]);
  const { rows, pager } = usePaging(filtered, JSON.stringify([filters, direction]));
  const columns = area ? 8 : 7;

  return <>
    <div className={styles.toolbar}>
      <Pager {...pager} unit="chuồng" />
      <div className={styles.toolbarActions}>
        {canEdit && <button type="button" className="farmshift-btn farmshift-btn-mint" onClick={() => onOpen({ type: 'barn', defaultAreaId: area?.id })} disabled={!areas.length}
          title={areas.length ? undefined : 'Cần tạo khu nuôi trước khi tạo chuồng'}><PlusCircle size={16} />Tạo Chuồng</button>}
        <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => navigate('/areas')}><Layers size={15} />Danh sách khu nuôi</button>
      </div>
    </div>
    <div className="farmshift-table-container" style={{ border: 0 }}>
      <table className={`farmshift-table ${styles.table}`}>
        <thead>
          <tr><th>Chuồng</th><th>Khu nuôi</th><th>Mục đích sử dụng</th><th>Trạng thái hoạt động</th><th>Số con</th>{area && <th>Mục tiêu (kg)</th>}<th>Ngày tạo</th><th aria-label="Thao tác" /></tr>
          <tr className={styles.filterRow}>
            <th><input aria-label="Lọc tên chuồng" placeholder="Tìm kiếm..." value={filters.name} onChange={set('name')} /></th>
            <th><select aria-label="Lọc khu nuôi" value={filters.areaId} onChange={set('areaId')} disabled={Boolean(area)}>
              <option value="">Tất cả</option>{areas.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select></th>
            <th><select aria-label="Lọc mục đích sử dụng" value={filters.purpose} onChange={set('purpose')}>
              <option value="">Tất cả</option>{BARN_PURPOSES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select></th>
            <th><select aria-label="Lọc trạng thái hoạt động" value={filters.status} onChange={set('status')}>
              <option value="">Tất cả</option>{BARN_STATUSES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select></th>
            <th><input aria-label="Lọc số con" placeholder="Tìm kiếm..." value={filters.quantity} onChange={set('quantity')} /></th>
            {area && <th><input aria-label="Lọc mục tiêu" placeholder="Tìm kiếm..." value={filters.target} onChange={set('target')} /></th>}
            <th><div className={styles.dateFilter}><input aria-label="Lọc ngày tạo chuồng" type="date" value={filters.date} onChange={set('date')} />
              <SortButton direction={direction} onToggle={() => setDirection(value => -value)} /></div></th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? <tr><td colSpan={columns} className={styles.empty}>{barns.length ? 'Không có chuồng phù hợp với bộ lọc.' : canEdit ? 'Chưa có chuồng. Bấm "Tạo Chuồng" để thêm chuồng nuôi.' : 'Chưa có chuồng nào.'}</td></tr>
            : rows.map(barn => {
              const status = BARN_STATUSES.find(option => option.value === barn.status);
              const fill = barn.capacity ? Math.min(100, Math.round((barn.currentQuantity / barn.capacity) * 100)) : 0;
              return <tr key={barn.id}>
                <td><Link to={`/barns/${barn.id}`} className={styles.nameLink}>{barn.name}</Link>{barn.description && <small className={styles.subtext}>{barn.description}</small>}</td>
                <td><Link to={`/areas/${barn.areaId}`} className={styles.areaLink}>{barn.areaName}</Link></td>
                <td>{labelOf(BARN_PURPOSES, barn.purpose)}</td>
                <td><span className={`${styles.badge} ${styles[`badge_${status?.tone || 'neutral'}`]}`}>{status?.label || barn.status}</span></td>
                <td><span className={styles.quantity}><strong>{formatNumber(barn.currentQuantity)}</strong> /{formatNumber(barn.capacity)}</span>
                  <span className={styles.fillTrack} aria-hidden="true"><span style={{ width: `${fill}%` }} /></span></td>
                {area && <td>{barn.targetWeight == null ? '—' : Number(barn.targetWeight).toLocaleString('vi-VN')}</td>}
                <td className={styles.date}>{formatDate(barn.createdAt)}</td>
                <td className={styles.actionCell}><RowMenu label={barn.name} items={[
                  { label: 'Xem chi tiết chuồng', icon: Eye, onClick: () => navigate(`/barns/${barn.id}`) },
                  ...(canEdit ? [
                    { label: 'Chỉnh sửa chuồng', icon: Pencil, onClick: () => onOpen({ type: 'barn', item: barn }) },
                    { label: 'Xóa chuồng', icon: Trash2, danger: true, onClick: () => onOpen({ type: 'delete', kind: 'barn', item: barn }) },
                  ] : []),
                ]} /></td>
              </tr>;
            })}
        </tbody>
      </table>
    </div>
  </>;
}

function AreaSummary({ area }) {
  const fill = area.totalCapacity ? Math.round((area.animalCount / area.totalCapacity) * 100) : 0;
  const stats = [
    ['Tổng số chuồng', formatNumber(area.barnCount), `${formatNumber(area.activeBarnCount)} chuồng đang hoạt động`],
    ['Tổng đàn hiện tại', `${formatNumber(area.animalCount)} con`, `Sức chứa ${formatNumber(area.totalCapacity)} con`],
    ['Tỷ lệ lấp đầy', `${fill}%`, 'Gà thịt'],
    ['Chỗ còn trống', `${formatNumber(Math.max(area.totalCapacity - area.animalCount, 0))} con`, area.description || 'Chưa có ghi chú'],
  ];
  return <div className={styles.summary}>
    {stats.map(([label, value, hint]) => <div key={label} className={styles.stat}><span>{label}</span><strong>{value}</strong><small>{hint}</small></div>)}
  </div>;
}

export const AreasView = () => {
  const { id } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useNotification();
  const canEdit = user?.role === 'ROLE_FARM_OWNER';
  const mode = id ? 'area' : pathname.startsWith('/barns') ? 'barns' : 'areas';
  const [revision, setRevision] = useState(0);
  const [modal, setModal] = useState(null);
  // Data is tagged with the request it answers; while the tags differ the page shows the loading state.
  const requestKey = `${mode}|${id || ''}|${revision}`;
  const [data, setData] = useState({ key: null, areas: [], barns: [], area: null, error: '' });
  const loading = data.key !== requestKey;
  const { areas, barns, area, error } = loading ? { areas: data.areas, barns: [], area: null, error: '' } : data;

  useEffect(() => {
    let cancelled = false;
    Promise.all([listFarmAreas(), mode === 'areas' ? Promise.resolve([]) : listBarns(id), id ? getFarmArea(id) : Promise.resolve(null)])
      .then(([areaList, barnList, current]) => {
        if (!cancelled) setData({ key: requestKey, areas: areaList, barns: barnList, area: current, error: '' });
      })
      .catch(requestError => {
        if (cancelled) return;
        const message = requestError.response?.status === 404 ? 'Không tìm thấy khu nuôi. Khu nuôi có thể đã bị xóa.' : apiErrorMessage(requestError);
        setData(current => ({ ...current, key: requestKey, barns: [], area: null, error: message }));
      });
    return () => { cancelled = true; };
  }, [mode, id, requestKey]);

  const done = message => { setModal(null); showToast(message, 'success'); setRevision(value => value + 1); };
  const title = mode === 'area' ? (area?.name || 'Khu nuôi') : mode === 'barns' ? 'Danh sách Chuồng' : 'Khu nuôi';

  const breadcrumbs = [{ label: 'Quản lý khu nuôi', path: '/areas' }, ...(mode === 'area' ? [{ label: 'Danh sách Chuồng', path: '/barns' }] : [])];

  return <FarmShiftLayout pageTitle={title} breadcrumbs={breadcrumbs} showShortcuts>
    {!canEdit && <p className={styles.readOnly} role="note"><Info size={16} />Bạn đang xem ở chế độ chỉ đọc. Chỉ chủ trang trại được thêm, sửa hoặc xóa khu nuôi và chuồng.</p>}
    {mode === 'area' && area && <>
      <div className={styles.areaHeader}>
        <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => navigate('/areas')}><ArrowLeft size={15} />Quay lại</button>
        <h2><Warehouse size={20} />{area.name}</h2>
        {canEdit && <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setModal({ type: 'area', item: area })}><Pencil size={15} />Sửa khu nuôi</button>}
      </div>
      <AreaSummary area={area} />
    </>}
    <div className={`farmshift-card ${styles.card}`}>
      {loading ? <p className={styles.empty} role="status">Đang tải dữ liệu khu nuôi...</p>
        : error ? <div role="alert" className={styles.empty}><p>{error}</p>
          <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => (mode === 'area' ? navigate('/areas') : setRevision(value => value + 1))}>{mode === 'area' ? 'Về danh sách khu nuôi' : 'Thử lại'}</button></div>
          : mode === 'areas' ? <AreaList areas={areas} canEdit={canEdit} onOpen={setModal} />
            : <BarnList key={mode} barns={barns} areas={areas} area={area} canEdit={canEdit} onOpen={setModal} />}
    </div>
    {modal?.type === 'area' && <AreaDialog area={modal.item} onClose={() => setModal(null)} onSaved={done} />}
    {modal?.type === 'barn' && <BarnDialog barn={modal.item} areas={areas} defaultAreaId={modal.defaultAreaId} onClose={() => setModal(null)} onSaved={done} />}
    {modal?.type === 'delete' && <DeleteDialog kind={modal.kind} item={modal.item} onClose={() => setModal(null)}
      onDeleted={message => { if (modal.kind === 'area' && mode === 'area') { setModal(null); showToast(message, 'success'); navigate('/areas'); } else done(message); }} />}
  </FarmShiftLayout>;
};
