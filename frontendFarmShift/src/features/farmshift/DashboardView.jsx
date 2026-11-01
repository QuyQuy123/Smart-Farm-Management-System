import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle2, ChevronRight, ClipboardList, Coins, HeartCrack, Info, ListChecks, Syringe, Truck,
  Users, Wheat, Pill, Flag, RefreshCw, Map as MapIcon, PackageOpen,
} from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { listBarns } from '../../services/farmAreaService';
import { DashboardCharts } from './DashboardCharts';
import { useAuth } from '../../context/AuthContext';
import { getDashboard } from '../../services/dashboardService';
import { formatDay } from './farmAreaOptions';
import styles from './DashboardView.module.css';

const num = (value, digits = 0) => value == null ? '—' : Number(value).toLocaleString('vi-VN', { maximumFractionDigits: digits });
const money = value => value == null ? '—' : `${Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 0 })}đ`;
const LEVEL_ICON = { DANGER: AlertTriangle, WARN: AlertTriangle, INFO: Info };
const KIND = { VACCINE: { icon: Syringe, label: 'Vắc-xin' }, MEDICINE: { icon: Pill, label: 'Thuốc' }, FEED: { icon: Wheat, label: 'Đổi cám' },
  HARVEST: { icon: Flag, label: 'Xuất chuồng' } };
const STATUS = { OK: 'Ổn định', WARN: 'Cần chú ý', DANGER: 'Cần xử lý' };

/** Việc cần xử lý mở đúng chỗ: chuồng, Phân công, hoặc Nhập hàng (công nợ). */
const alertLink = alert => alert.type === 'DEBT' ? '/purchases' : alert.type === 'UNASSIGNED' ? '/today-tasks?view=assign'
  : alert.barnId ? `/barns/${alert.barnId}` : null;
/** "Chuong 3: 5 việc quá giờ chưa làm" → tên chuồng in nghiêng, phần còn lại, và con số đầu tiên làm huy hiệu. */
const splitAlert = alert => {
  const at = alert.barnId ? alert.title.indexOf(': ') : -1;
  const barn = at > 0 ? alert.title.slice(0, at) : null;
  const text = at > 0 ? alert.title.slice(at + 2) : alert.title;
  const badge = ['OVERDUE', 'LOSS', 'DEBT'].includes(alert.type) ? text.match(/\d[\d.]*/)?.[0] : null;
  return { barn, text, badge };
};
/** Hết hàng / thiếu cho hôm nay / còn đủ mấy ngày theo lượng dùng của phiếu việc hôm nay. */
const restockText = item => Number(item.stock) <= 0 ? 'Hết hàng' : item.daysLeft === 0 ? 'Thiếu hôm nay' : `Đủ ${item.daysLeft} ngày`;

/**
 * Bảng tin: trả lời nhanh "hôm nay trại có ổn không, việc gì cần xử lý". Số liệu thật từ /api/dashboard;
 * công nhân chỉ thấy chuồng mình phụ trách, không có tiền.
 */
export const DashboardView = () => {
  const { user } = useAuth();
  const role = user?.role;
  const isWorker = role === 'ROLE_FARM_WORKER';
  const [revision, setRevision] = useState(0);
  // Kết quả gắn với lượt tải (revision); lượt mới chưa về thì đang tải.
  const [state, setState] = useState({ revision: -1, data: null, error: '' });

  useEffect(() => {
    let cancelled = false;
    getDashboard()
      .then(data => { if (!cancelled) setState({ revision, data: data && data.kpis ? data : null, error: data && data.kpis ? '' : 'Không có dữ liệu bảng tin.' }); })
      .catch(error => { if (!cancelled) setState({ revision, data: null, error: error?.response?.data?.message || 'Không tải được bảng tin. Vui lòng thử lại.' }); });
    return () => { cancelled = true; };
  }, [revision]);

  const loading = state.revision !== revision;
  const { data } = state;
  const error = loading ? '' : state.error;
  const greeting = user?.fullName ? `Chào ${user.fullName}` : 'Bảng tin';

  return <FarmShiftLayout pageTitle="Bảng tin" breadcrumbTitle="Bảng tin">
    <div className={styles.head}>
      <div>
        <h2>{greeting}</h2>
        <p>{data ? `Hôm nay ${formatDay(data.date)} · ${isWorker ? 'các chuồng bạn phụ trách' : 'toàn trại'}` : 'Tình hình trại trong ngày'}</p>
      </div>
      <div className={styles.headActions}>
        <Link to="/today-tasks" className="farmshift-btn farmshift-btn-mint"><ListChecks size={16} />Việc hôm nay</Link>
        <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setRevision(value => value + 1)} disabled={loading}
          aria-label="Tải lại bảng tin"><RefreshCw size={15} /></button>
      </div>
    </div>

    {loading && !data ? <p className={styles.state} role="status">Đang tải bảng tin...</p>
      : error ? <div className={styles.state} role="alert"><p>{error}</p>
        <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setRevision(value => value + 1)}>Thử lại</button></div>
        : <>
          <Kpis kpis={data.kpis} isWorker={isWorker} />

          <div className={styles.columns}>
            {/* "Cần xử lý" như một trang sổ trực trại: bìa xanh rêu, giấy ngà kẻ dòng, lề đỏ, ruy-băng — cùng kiểu sổ giao việc ở Phân công. */}
            <section className={`${styles.card} ${styles.notebook}`} aria-label="Cần xử lý">
              <span className={styles.rings} aria-hidden="true">{Array.from({ length: 7 }, (_, index) => <i key={index} />)}</span>
              <div className={styles.paper}>
                <header>
                  <div><small className={styles.kicker}>Sổ trực trại · {formatDay(data.date)}</small><h3><ClipboardList size={17} />Cần xử lý</h3></div>
                  <span className={styles.count}>{data.alerts.length}</span>
                </header>
                {data.alerts.length === 0 ? <p className={styles.allGood}><CheckCircle2 size={18} />Không có việc gì cần xử lý. Mọi chuồng đang ổn.</p>
                  : <ul className={styles.alerts}>{data.alerts.map((alert, index) => {
                    const Icon = LEVEL_ICON[alert.level] || Info;
                    const link = alertLink(alert);
                    const { barn, text, badge } = splitAlert(alert);
                    const body = <><Icon size={16} className={styles.alertIcon} />
                      <span><strong>{barn && <em className={styles.barnName}>{barn}</em>}{barn ? `: ${text}` : text}</strong>{alert.detail && <small>{alert.detail}</small>}</span>
                      {badge && <b className={styles.badge}>{badge}</b>}
                      {link && <ChevronRight size={16} className={styles.chevron} />}</>;
                    return <li key={`${alert.type}-${alert.barnId}-${index}`} className={styles[`alert_${alert.level}`]}>
                      {link ? <Link to={link}>{body}</Link> : <div>{body}</div>}
                    </li>;
                  })}</ul>}
              </div>
            </section>

            <section className={styles.card} aria-label="Kho cần bổ sung">
              <header><h3><PackageOpen size={17} />Kho cần bổ sung</h3>
                <Link to="/inventory" className={styles.more}>Kho hàng <ChevronRight size={15} /></Link></header>
              {(data.restock || []).length === 0 ? <p className={styles.empty}>Kho đủ dùng cho tuần tới theo phiếu việc hôm nay.</p>
                : <ul className={styles.upcoming}>{data.restock.map(item => {
                  const Icon = (KIND[item.category] || KIND.FEED).icon;
                  return <li key={item.itemId}>
                    <span className={`${styles.kind} ${styles[`kind_${item.category}`]}`}><Icon size={15} /></span>
                    <span className={styles.upText}><strong>{item.productName}</strong>
                      <small>{item.warehouseName} · còn {num(item.stock, 1)} {item.unitName} · dùng {num(item.dailyNeed, 1)} {item.unitName}/ngày</small></span>
                    <em className={styles[`restock_${item.level}`]}>{restockText(item)}</em>
                  </li>;
                })}</ul>}
            </section>
          </div>

          {/* Mặt bằng trang trại: chuồng 3D theo khu, mái theo trạng thái; công nhân chỉ thấy chuồng mình phụ trách. */}
          <FarmPlan cards={data.barns} isWorker={isWorker} />

          {data.finance && <Finance finance={data.finance} />}

          <DashboardCharts data={data} />

        </>}
  </FarmShiftLayout>;
};

function Kpis({ kpis, isWorker }) {
  const tiles = [
    { icon: Users, label: 'Đang nuôi', value: `${num(kpis.liveQuantity)} con`, hint: `${kpis.activeBarns} chuồng có lứa` },
    { icon: HeartCrack, label: 'Hao hụt hôm nay', value: `${num(kpis.lossToday)} con`, hint: `7 ngày: ${num(kpis.loss7d)} con (${num(kpis.loss7dRate, 2)}%)`,
      tone: kpis.lossToday > 0 ? 'warn' : null },
    { icon: ListChecks, label: 'Việc hôm nay', value: `${kpis.tasksDone}/${kpis.tasksTotal}`, hint: kpis.overdueTasks ? `${kpis.overdueTasks} việc quá giờ` : 'Không có việc quá giờ',
      tone: kpis.overdueTasks ? 'warn' : null, progress: kpis.tasksTotal ? Math.round((kpis.tasksDone / kpis.tasksTotal) * 100) : 0 },
    ...(!isWorker && kpis.supplierDebt != null ? [{ icon: Truck, label: 'Công nợ nhà cung cấp', value: money(kpis.supplierDebt),
      hint: kpis.unpaidInvoices ? `${kpis.unpaidInvoices} hóa đơn chưa trả đủ` : 'Không còn nợ' }] : []),
  ];
  return <div className={styles.kpis}>{tiles.map(({ icon: Icon, label, value, hint, tone, progress }) => <div key={label}
    className={`${styles.kpi} ${tone ? styles[`kpi_${tone}`] : ''}`}>
    <span className={styles.kpiIcon}><Icon size={18} /></span>
    <div><span>{label}</span><strong>{value}</strong><small>{hint}</small>
      {progress != null && <i className={styles.bar}><b style={{ width: `${progress}%` }} /></i>}</div>
  </div>)}</div>;
}

/** Một dòng cần chú ý nhất của chuồng: hao hụt hôm nay > việc quá giờ > chưa có người phụ trách > tiến độ việc. */
const barnNote = card => card.lossToday > 0 ? { text: `Hao hụt ${num(card.lossToday)} con`, bad: true }
  : card.overdueTasks > 0 ? { text: `${card.overdueTasks} quá giờ`, bad: true }
    : !card.workers.length ? { text: 'Chưa có người phụ trách', bad: true }
      : { text: `Việc ${card.tasksDone}/${card.tasksTotal}`, bad: false };

/** Cửa sổ dọc tường dài của nhà chuồng (tường nghiêng 15/60). */
const BARN_WINDOWS = [14, 26, 38, 50];

/**
 * Nhà chuồng vẽ nghiêng kiểu 3D (tường dài, tường hồi, mái hai mái). Mái tô theo trạng thái chuồng; chuồng trống mờ, viền nét đứt.
 */
function Barn3D({ status }) {
  return <svg viewBox="0 0 112 82" className={styles.barn3d} aria-hidden="true">
    <ellipse cx="56" cy="70" rx="50" ry="9" className={styles.barnShadow} />
    <polygon points="26,15 86,30 106,37 46,22" className={styles.roofBack} />
    <polygon points="66,73 106,59 106,37 66,51" className={styles.wallSide} />
    <polygon points="66,51 106,37 86,30" className={styles.gable} />
    <polygon points="78,68.8 88,65.3 88,53.3 78,56.8" className={styles.door} />
    <polygon points="6,58 66,73 66,51 6,36" className={styles.wallFront} />
    {BARN_WINDOWS.map(x => <polygon key={x} points={`${x},${50 + x / 4} ${x + 6},${51.5 + x / 4} ${x + 6},${45.5 + x / 4} ${x},${44 + x / 4}`}
      className={styles.window} />)}
    <polygon points="3,36.5 67,52.5 87,29 25,13.5" className={`${styles.roof} ${styles[`roof_${status}`]}`} />
    <line x1="25" y1="13.5" x2="87" y2="29" className={styles.ridge} />
  </svg>;
}

/**
 * Sơ đồ trang trại: mọi chuồng (kể cả chuồng trống) nhóm theo khu, như mặt bằng. Trạng thái, ngày tuổi, việc quá giờ lấy từ
 * thẻ chuồng của bảng tin; chuồng không có lứa thì xám nhạt. Bấm ô mở chuồng.
 */
function FarmPlan({ cards, isWorker }) {
  const [barns, setBarns] = useState(null);
  useEffect(() => {
    let cancelled = false;
    listBarns().then(data => { if (!cancelled) setBarns(Array.isArray(data) ? data : []); }).catch(() => { if (!cancelled) setBarns([]); });
    return () => { cancelled = true; };
  }, []);
  const byBarn = new Map(cards.map(card => [card.barnId, card]));
  const areas = [];
  // Công nhân chỉ thấy chuồng đang nuôi mình phụ trách (có trong thẻ chuồng của bảng tin).
  (barns || []).filter(barn => !isWorker || byBarn.has(barn.id)).forEach(barn => {
    let area = areas.find(item => item.id === barn.areaId);
    if (!area) areas.push(area = { id: barn.areaId, name: barn.areaName, barns: [] });
    area.barns.push(barn);
  });
  return <section className={styles.card} aria-label="Sơ đồ trang trại">
    <header><h3><MapIcon size={17} />{isWorker ? 'Chuồng bạn phụ trách' : 'Sơ đồ trang trại'}</h3><Link to="/areas" className={styles.more}>Khu nuôi <ChevronRight size={15} /></Link></header>
    {barns === null ? <p className={styles.empty} role="status">Đang tải sơ đồ...</p>
      : areas.length === 0 ? <p className={styles.empty}>{isWorker ? 'Bạn chưa được giao chuồng nào.' : 'Chưa có khu nuôi nào.'}</p>
        : <div className={styles.farmPlan}>{areas.map(area => {
          const live = area.barns.reduce((sum, barn) => sum + (barn.currentQuantity || 0), 0);
          return <div key={area.id} className={styles.planArea} aria-label={`Khu ${area.name}`} role="group">
            <div className={styles.planHead}><strong>{area.name}</strong><small>{area.barns.length} chuồng · {num(live)} con</small></div>
            <div className={styles.plan}>{area.barns.map(barn => {
              const card = byBarn.get(barn.id);
              const status = card ? card.status : 'EMPTY';
              return <Link key={barn.id} to={`/barns/${barn.id}`} className={`${styles.planTile} ${styles[`tile_${status}`]}`}
                aria-label={`Sơ đồ ${barn.name}`} title={card ? `${barn.name}: ${STATUS[status]}` : `${barn.name}: chuồng trống`}>
                <Barn3D status={status} />
                <strong>{barn.name}</strong>
                {card ? <>
                  <span><b>{num(card.quantity)}</b> con · <b>{card.ageDays ?? '—'}</b> ngày</span>
                  {barnNote(card).bad ? <em>{barnNote(card).text}</em> : <small>{barnNote(card).text}</small>}
                </> : <small>{barn.currentQuantity > 0 ? `${num(barn.currentQuantity)} con` : 'Trống'}</small>}
              </Link>;
            })}</div>
          </div>;
        })}</div>}
    <div className={styles.legend} aria-label="Chú thích màu">
      {[['OK', 'Ổn định'], ['WARN', 'Cần chú ý'], ['DANGER', 'Cần xử lý'], ['EMPTY', 'Chuồng trống']].map(([key, label]) =>
        <span key={key}><i className={styles[`dot_${key}`]} />{label}</span>)}
    </div>
  </section>;
}

function Finance({ finance }) {
  const items = [
    ['Con giống', finance.chickCost], ['Cám', finance.feedCost], ['Tổng chi phí', finance.totalCost], ['Doanh thu xuất bán', finance.revenue],
  ];
  const profit = Number(finance.profit || 0);
  return <section className={styles.card} aria-label="Tài chính các lứa đang nuôi">
    <header><h3><Coins size={17} />Tài chính các lứa đang nuôi</h3><Link to="/reports" className={styles.more}>Báo cáo <ChevronRight size={15} /></Link></header>
    <div className={styles.finance}>
      {items.map(([label, value]) => <div key={label}><span>{label}</span><strong>{money(value)}</strong></div>)}
      <div className={profit >= 0 ? styles.profit : styles.lossMoney}><span>{profit >= 0 ? 'Lãi tạm tính' : 'Lỗ tạm tính'}</span><strong>{money(finance.profit)}</strong></div>
    </div>
  </section>;
}
