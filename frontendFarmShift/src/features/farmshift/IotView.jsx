import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, Camera, ChevronRight, Droplets, Fan, Lightbulb, Pencil, Plus, Search, Trash2, Warehouse } from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { FARM_AREAS_CHANGED, listBarns, listFarmAreas } from '../../services/farmAreaService';
import { apiErrorMessage } from './farmAreaOptions';
import { Dialog } from './FarmAreaDialogs';
import { IotEnvironment } from './IotEnvironment';
import styles from './IotView.module.css';

const TYPES = {
  FAN: { label: 'Quạt thông gió', icon: Fan },
  LIGHT: { label: 'Đèn chiếu sáng', icon: Lightbulb },
  WATER: { label: 'Nước / phun sương', icon: Droplets },
};
const defaultDevices = () => [
  { id: 'fan', name: 'Quạt thông gió (Quạt hút)', type: 'FAN', enabled: false, speed: 1, power: '1.2' },
  { id: 'light', name: 'Hệ thống Đèn chiếu sáng', type: 'LIGHT', enabled: false, power: '' },
  { id: 'water', name: 'Hệ thống Nước / phun sương', type: 'WATER', enabled: false, power: '' },
];

function CameraScreen({ barnName }) {
  return <div className={styles.camera} aria-label={`Camera ${barnName}`}>
    <span className={styles.cameraBadge}><span />Chưa kết nối</span>
    <div><Camera size={38} strokeWidth={1.3} /><strong>Camera</strong><span>{barnName}</span></div>
    <small>Hình ảnh sẽ hiển thị khi camera được kết nối</small>
  </div>;
}

function DeviceDialog({ device, onClose, onSave }) {
  const [form, setForm] = useState(device || { name: '', type: 'FAN', power: '' });
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));
  return <Dialog title={device ? 'Chỉnh sửa thiết bị' : 'Thêm thiết bị'} labelId="iot-device-title" onClose={onClose}>
    <form onSubmit={event => {
      event.preventDefault();
      if (form.name.trim()) onSave({ ...form, name: form.name.trim() });
    }}>
      <div className={styles.form}>
        <label htmlFor="iot-name">Tên thiết bị <span>*</span></label>
        <input id="iot-name" className="farmshift-form-control" autoFocus required maxLength={100} value={form.name} onChange={event => set('name', event.target.value)} />
        <label htmlFor="iot-type">Loại thiết bị</label>
        <select id="iot-type" className="farmshift-form-control" value={form.type} onChange={event => set('type', event.target.value)}>
          {Object.entries(TYPES).map(([value, type]) => <option key={value} value={value}>{type.label}</option>)}
        </select>
        <label htmlFor="iot-power">Công suất (kW, không bắt buộc)</label>
        <input id="iot-power" className="farmshift-form-control" type="number" min="0" step="0.01" value={form.power} onChange={event => set('power', event.target.value)} />
        <small>Thiết bị xem thử, chưa kết nối phần cứng.</small>
      </div>
      <footer className={styles.dialogFooter}>
        <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={onClose}>Bỏ qua</button>
        <button type="submit" className="farmshift-btn farmshift-btn-mint">Lưu thiết bị</button>
      </footer>
    </form>
  </Dialog>;
}

export function IotView() {
  const [params, setParams] = useSearchParams();
  const barnId = params.get('barn');
  const [data, setData] = useState({ areas: [], barns: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState('');
  const [devicesByBarn, setDevicesByBarn] = useState({});
  const [modal, setModal] = useState(null);
  useEffect(() => {
    let cancelled = false;
    Promise.all([listFarmAreas(), listBarns()]).then(([areas, barns]) => {
      if (!cancelled) { setData({ areas, barns }); setError(''); setLoading(false); }
    }).catch(requestError => { if (!cancelled) { setError(apiErrorMessage(requestError)); setLoading(false); } });
    return () => { cancelled = true; };
  }, [revision]);
  useEffect(() => {
    const reload = () => setRevision(value => value + 1);
    window.addEventListener(FARM_AREAS_CHANGED, reload);
    return () => window.removeEventListener(FARM_AREAS_CHANGED, reload);
  }, []);
  const barn = data.barns.find(item => String(item.id) === barnId);
  const devices = devicesByBarn[barnId] ?? defaultDevices();
  const changeDevices = update => setDevicesByBarn(current => ({ ...current, [barnId]: update(current[barnId] ?? defaultDevices()) }));
  const updateDevice = (id, values) => changeDevices(items => items.map(item => item.id === id ? { ...item, ...values } : item));
  const groups = data.areas.map(area => ({ ...area, barns: data.barns.filter(item => item.areaId === area.id)
    .filter(item => `${area.name} ${item.name}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi').trim())) }));
  return <FarmShiftLayout pageTitle="Thiết bị IoT" breadcrumbTitle={barn?.name || 'Thiết bị IoT'}
    breadcrumbs={barn ? [{ label: 'Thiết bị IoT', path: '/iot' }] : []}>
    <div className={styles.root}>
      {loading ? <p role="status" className={styles.state}>Đang tải khu nuôi và chuồng...</p> : error ? <div role="alert" className={styles.state}>{error}
        <button className="farmshift-btn farmshift-btn-secondary" onClick={() => { setLoading(true); setRevision(value => value + 1); }}>Thử lại</button></div>
        : barnId && !barn ? <div className={styles.state}>Không tìm thấy chuồng.<button className="farmshift-btn farmshift-btn-secondary" onClick={() => setParams({})}>Về tổng quan</button></div>
          : barn ? <>
            <div className={styles.detailHeading}>
              <button type="button" className={styles.back} onClick={() => setParams({})}><ArrowLeft size={18} />Tất cả camera</button>
              <div><h2>{barn.name}</h2><p>{data.areas.find(area => area.id === barn.areaId)?.name || barn.areaName}</p></div>
            </div>
            <div className={styles.detail}>
              <div className={styles.monitoring}>
                <section className={styles.cameraPanel}><header><Camera size={20} /><h3>Camera giám sát</h3></header><CameraScreen barnName={barn.name} /><footer><Warehouse size={16} />{barn.name}<span>Chưa có tín hiệu camera</span></footer></section>
                <IotEnvironment key={barn.id} barnName={barn.name} />
              </div>
              <section className={styles.controls} aria-label={`Thiết bị ${barn.name}`}>
                <header><div><h3>Điều khiển thiết bị</h3><p>{devices.length} thiết bị · {devices.filter(item => item.enabled).length} đang bật thử</p></div>
                  <button type="button" className="farmshift-btn farmshift-btn-mint" onClick={() => setModal({ kind: 'add' })}><Plus size={17} />Thêm thiết bị</button></header>
                {devices.length === 0 && <p className={styles.state}>Chưa có thiết bị. Nhấn “Thêm thiết bị” để bắt đầu.</p>}
                {devices.map(device => {
                  const Icon = TYPES[device.type].icon;
                  return <article key={device.id} className={`${styles.device} ${device.enabled ? styles.enabled : ''}`}>
                    <div className={styles.deviceTop}><span className={styles.deviceIcon}><Icon size={23} /></span>
                      <div className={styles.deviceInfo}><h4>{device.name}</h4><p>{device.power && `${device.power} kW · `}{device.enabled ? 'Đang bật thử' : 'Đang dừng'}<small>Chưa kết nối</small></p></div>
                      <button type="button" role="switch" aria-checked={device.enabled} aria-label={`Bật tắt ${device.name}`} className={styles.toggle}
                        onClick={() => updateDevice(device.id, { enabled: !device.enabled })}><span /></button></div>
                    {device.type === 'FAN' && <div className={styles.speed}><span>Cấp độ gió:</span><div role="group" aria-label={`Cấp độ ${device.name}`}>
                      {[1, 2, 3].map(speed => <button key={speed} type="button" aria-pressed={device.speed === speed} onClick={() => updateDevice(device.id, { speed })}>Số {speed}</button>)}
                    </div></div>}
                    <div className={styles.deviceActions}><button type="button" onClick={() => setModal({ kind: 'edit', device })}><Pencil size={14} />Chỉnh sửa</button>
                      <button type="button" onClick={() => setModal({ kind: 'delete', device })}><Trash2 size={14} />Xóa</button></div>
                  </article>;
                })}
              </section>
            </div>
          </> : <>
            <div className={styles.overviewHeading}><div><span className={styles.eyebrow}>GIÁM SÁT TRANG TRẠI</span><h2>Camera theo khu nuôi</h2><p>Theo dõi từng chuồng và mở nhanh bảng điều khiển thiết bị.</p></div>
              <label className={styles.search}><Search size={18} /><input aria-label="Tìm khu hoặc chuồng" placeholder="Tìm khu, chuồng..." value={query} onChange={event => setQuery(event.target.value)} /></label></div>
            <div className={styles.stats}><span><strong>{data.areas.length}</strong> khu nuôi</span><span><strong>{data.barns.length}</strong> chuồng / camera</span><span><span className={styles.statusDot} />Chờ kết nối thiết bị</span></div>
            {groups.filter(area => area.barns.length || !query).map(area => <section key={area.id} className={styles.area} aria-label={area.name}>
              <header><span className={styles.areaIcon}><Warehouse size={20} /></span><h3>{area.name}</h3><span>{area.barns.length} chuồng</span></header>
              {area.barns.length === 0 ? <p className={styles.empty}>Khu này chưa có chuồng.</p> : <div className={styles.grid}>{area.barns.map(item => <article key={item.id} className={styles.barn}>
                <CameraScreen barnName={item.name} /><div className={styles.cardSensors}><span>Nhiệt độ <strong>— °C</strong></span><span>Độ ẩm <strong>— %</strong></span></div><footer><div><h4>{item.name}</h4><small>Camera chưa kết nối</small></div>
                  <button type="button" aria-label={`Xem chi tiết ${item.name}`} onClick={() => setParams({ barn: String(item.id) })}>Xem chi tiết<ChevronRight size={17} /></button></footer>
              </article>)}</div>}
            </section>)}
            {data.areas.length === 0 && <p className={styles.state}>Chưa có khu nuôi. Tạo khu nuôi và chuồng trong menu Khu nuôi để bắt đầu.</p>}
            {query && !groups.some(area => area.barns.length) && <p className={styles.state}>Không tìm thấy khu hoặc chuồng phù hợp.</p>}
          </>}
      {modal && modal.kind !== 'delete' && <DeviceDialog device={modal.device} onClose={() => setModal(null)} onSave={values => {
        if (modal.kind === 'edit') updateDevice(modal.device.id, values);
        else changeDevices(items => [...items, { ...values, id: crypto.randomUUID(), enabled: false, speed: 1 }]);
        setModal(null);
      }} />}
      {modal?.kind === 'delete' && <Dialog title="Xóa thiết bị" labelId="iot-delete-title" onClose={() => setModal(null)}>
        <p className={styles.form}>Xóa thiết bị “{modal.device.name}” khỏi {barn?.name}?</p><footer className={styles.dialogFooter}>
          <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setModal(null)}>Bỏ qua</button>
          <button type="button" className="farmshift-btn farmshift-btn-mint" onClick={() => { changeDevices(items => items.filter(item => item.id !== modal.device.id)); setModal(null); }}>Xóa thiết bị</button>
        </footer></Dialog>}
    </div>
  </FarmShiftLayout>;
}
