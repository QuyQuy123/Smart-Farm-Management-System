import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, CalendarClock, CheckCircle2, ChevronRight, ClipboardList, Coins, HeartCrack, Info, ListChecks, Syringe, Truck,
  Users, Warehouse, Wheat, Pill, Flag, RefreshCw, Map as MapIcon,
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
const inDaysText = days => days === 0 ? 'Hôm nay' : days === 1 ? 'Ngày mai' : `${days} ngày nữa`;

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

            <section className={styles.card} aria-label="7 ngày tới">
              <header><h3><CalendarClock size={17} />7 ngày tới</h3></header>
              {data.upcoming.length === 0 ? <p className={styles.empty}>Không có mốc vắc-xin, đổi cám hay xuất chuồng trong 7 ngày tới.</p>
                : <ul className={styles.upcoming}>{data.upcoming.map((item, index) => {
                  const kind = KIND[item.kind] || KIND.FEED;
                  const Icon = kind.icon;
                  return <li key={`${item.barnId}-${item.kind}-${index}`}>
                    <span className={`${styles.kind} ${styles[`kind_${item.kind}`]}`}><Icon size={15} /></span>
                    <span className={styles.upText}><strong>{item.title}</strong><small>{item.barnName} · {formatDay(item.date)}</small></span>
                    <em>{inDaysText(item.inDays)}</em>
                  </li>;
                })}</ul>}
            </section>
          </div>

          <section className={styles.card} aria-label="Các chuồng đang nuôi">
            <header><h3><Warehouse size={17} />{isWorker ? 'Chuồng bạn phụ trách' : 'Các chuồng đang nuôi'}</h3>
              <Link to="/areas" className={styles.more}>Khu nuôi <ChevronRight size={15} /></Link></header>
            {data.barns.length === 0 ? <p className={styles.empty}>{isWorker ? 'Bạn chưa được giao chuồng nào.' : 'Chưa có chuồng đang nuôi.'}</p>
              : <div className={styles.barns}>{data.barns.map(barn => <BarnTile key={barn.cycleId} barn={barn} />)}</div>}
          </section>

          {data.finance && <Finance finance={data.finance} />}

          <DashboardCharts data={data} />

          {/* Mặt bằng trang trại: mỗi khu một khối, chuồng thành ô tô màu theo trạng thái; công nhân không cần nên không hiện. */}
          {!isWorker && <FarmPlan cards={data.barns} />}
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

function BarnTile({ barn }) {
  const progress = barn.tasksTotal ? Math.round((barn.tasksDone / barn.tasksTotal) * 100) : 0;
  // Số chính in to (số con, ngày tuổi); cân / FCR chỉ hiện khi có số; khu và người phụ trách gộp một dòng nhỏ.
  const extras = [Number(barn.avgWeightKg) > 0 && `Cân TB ${num(barn.avgWeightKg, 2)} kg`, Number(barn.fcr) > 0 && `FCR ${num(barn.fcr, 2)}`].filter(Boolean);
  return <Link to={`/barns/${barn.barnId}`} className={styles.barn} aria-label={`Chuồng ${barn.barnName}`}>
    <div className={styles.barnHead}>
      <strong>{barn.barnName}</strong>
      <em className={styles[`status_${barn.status}`]}><i />{STATUS[barn.status] || barn.status}</em>
    </div>
    <div className={styles.barnMain}>
      <span><b>{num(barn.quantity)}</b> con</span>
      <span className={styles.age}>Ngày tuổi <b>{barn.ageDays ?? '—'}</b></span>
    </div>
    {extras.length > 0 && <small className={styles.extras}>{extras.join(' · ')}</small>}
    <div className={styles.barnFoot}>
      <span>Việc <b>{barn.tasksDone}/{barn.tasksTotal}</b></span>
      {barn.overdueTasks > 0 && <span className={styles.overdue}>{barn.overdueTasks} quá giờ</span>}
      {barn.lossToday > 0 && <span className={styles.loss}>Hao hụt {num(barn.lossToday)} con</span>}
    </div>
    <i className={styles.bar}><b style={{ width: `${progress}%` }} /></i>
    <small className={styles.workers}>{barn.areaName} · {barn.workers.length ? barn.workers.join(', ') : <span>Chưa có người phụ trách</span>}</small>
  </Link>;
}

/**
 * Sơ đồ trang trại: mọi chuồng (kể cả chuồng trống) nhóm theo khu, như mặt bằng. Trạng thái, ngày tuổi, việc quá giờ lấy từ
 * thẻ chuồng của bảng tin; chuồng không có lứa thì xám nhạt. Bấm ô mở chuồng.
 */
function FarmPlan({ cards }) {
  const [barns, setBarns] = useState(null);
  useEffect(() => {
    let cancelled = false;
    listBarns().then(data => { if (!cancelled) setBarns(Array.isArray(data) ? data : []); }).catch(() => { if (!cancelled) setBarns([]); });
    return () => { cancelled = true; };
  }, []);
  const byBarn = new Map(cards.map(card => [card.barnId, card]));
  const areas = [];
  (barns || []).forEach(barn => {
    let area = areas.find(item => item.id === barn.areaId);
    if (!area) areas.push(area = { id: barn.areaId, name: barn.areaName, barns: [] });
    area.barns.push(barn);
  });
  return <section className={styles.card} aria-label="Sơ đồ trang trại">
    <header><h3><MapIcon size={17} />Sơ đồ trang trại</h3><Link to="/areas" className={styles.more}>Khu nuôi <ChevronRight size={15} /></Link></header>
    {barns === null ? <p className={styles.empty} role="status">Đang tải sơ đồ...</p>
      : areas.length === 0 ? <p className={styles.empty}>Chưa có khu nuôi nào.</p>
        : <div className={styles.farmPlan}>{areas.map(area => {
          const live = area.barns.reduce((sum, barn) => sum + (barn.currentQuantity || 0), 0);
          return <div key={area.id} className={styles.planArea} aria-label={`Khu ${area.name}`} role="group">
            <div className={styles.planHead}><strong>{area.name}</strong><small>{area.barns.length} chuồng · {num(live)} con</small></div>
            <div className={styles.plan}>{area.barns.map(barn => {
              const card = byBarn.get(barn.id);
              const status = card ? card.status : 'EMPTY';
              return <Link key={barn.id} to={`/barns/${barn.id}`} className={`${styles.planTile} ${styles[`tile_${status}`]}`}
                aria-label={`Sơ đồ ${barn.name}`} title={card ? `${barn.name}: ${STATUS[status]}` : `${barn.name}: chuồng trống`}>
                <strong>{barn.name}</strong>
                {card ? <>
                  <span><b>{num(card.quantity)}</b> con · ngày {card.ageDays ?? '—'}</span>
                  {card.overdueTasks > 0 ? <em>{card.overdueTasks} quá giờ</em> : <small>Việc {card.tasksDone}/{card.tasksTotal}</small>}
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
