import { useEffect, useRef, useState } from 'react';
import { connectEsp32, ESP32_TOPIC_PREFIX, relayStatusTopics } from '../../services/esp32MqttService';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, Camera, ChevronRight, Droplets, Fan, Lightbulb, Pencil, Plus, Search, Trash2, Warehouse } from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { FARM_AREAS_CHANGED, listBarns, listFarmAreas } from '../../services/farmAreaService';
import { apiErrorMessage } from './farmAreaOptions';
import { Dialog } from './FarmAreaDialogs';
import { IotEnvironment } from './IotEnvironment';
import { PhoneCamera } from './PhoneCamera';
import styles from './IotView.module.css';

const TYPES = {
  FAN: { label: 'Quạt thông gió', icon: Fan },
  LIGHT: { label: 'Đèn chiếu sáng', icon: Lightbulb },
  WATER: { label: 'Nước / phun sương', icon: Droplets },
};
const defaultDevices = () => [
  { id: 'fan', name: 'Quạt gió', type: 'FAN', enabled: false, speed: 1, power: '1.2' },
  { id: 'light', name: 'Hệ thống Đèn chiếu sáng', type: 'LIGHT', enabled: false, power: '' },
  { id: 'water', name: 'Hệ thống phun sương', type: 'WATER', enabled: false, power: '' },
];

function CameraScreen({ barnName }) {
  return <div className={styles.camera} aria-label={`Camera ${barnName}`}>
    <span className={styles.cameraBadge}><span />Chưa kết nối</span>
    <div><Camera size={38} strokeWidth={1.3} /><strong>Camera</strong><span>{barnName}</span></div>
    <small>Hình ảnh sẽ hiển thị khi camera được kết nối</small>
  </div>;
}

function DeviceDialog({ device, devices, onClose, onSave }) {
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
        <label htmlFor="iot-relay">Relay ESP32</label>
        <select id="iot-relay" className="farmshift-form-control" value={form.relay ?? ''} onChange={event => set('relay', Number(event.target.value) || null)}>
          <option value="">Chưa gán</option>
          {[1, 2, 3, 4].map(relay => <option key={relay} value={relay}
            disabled={devices.some(item => item.id !== device?.id && item.relay === relay)}>Relay {relay}</option>)}
        </select>
        <label htmlFor="iot-power">Công suất (kW, không bắt buộc)</label>
        <input id="iot-power" className="farmshift-form-control" type="number" min="0" step="0.01" value={form.power} onChange={event => set('power', event.target.value)} />
        <small>Chọn relay theo dây đang nối trên ESP32.</small>
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
  const mqtt = useRef(null);
  const [connection, setConnection] = useState('disconnected');
  const [relayStates, setRelayStates] = useState({});
  const [sensorReadings, setSensorReadings] = useState({});
  const [mqttError, setMqttError] = useState('');
  const hasBarn = Boolean(barn);
  useEffect(() => {
    if (!hasBarn) return;
    let cancelled = false;
    connectEsp32({
      onConnection: status => {
        if (cancelled) return;
        setConnection(status);
        if (status !== 'connected') {
          setRelayStates({});
          setSensorReadings({});
        }
        else setMqttError('');
      },
      onMessage: ({ topic, payload }) => {
        if (cancelled) return;
        const value = payload.trim();
        const sensor = ['temp1', 'humi1', 'temp3', 'humi3'].find(key => topic === `${ESP32_TOPIC_PREFIX}/${key}`);
        if (sensor && value && Number.isFinite(Number(value))) {
          setSensorReadings(current => ({ ...current, [sensor]: Number(value) }));
        }
        const relay = relayStatusTopics.indexOf(topic) + 1;
        const state = payload.trim();
        if (!cancelled && relay && ['ON', 'OFF'].includes(state)) {
          setRelayStates(current => ({ ...current, [relay]: state === 'ON' }));
        }
      },
      onError: () => { if (!cancelled) setMqttError('Không thể kết nối MQTT.'); },
    }).then(client => {
      if (cancelled) client.disconnect();
      else mqtt.current = client;
    }).catch(() => { if (!cancelled) setMqttError('Không thể khởi tạo MQTT.'); });
    return () => {
      cancelled = true;
      mqtt.current?.disconnect();
      mqtt.current = null;
    };
  }, [hasBarn]);
  async function send(devices, enabled) {
    if (connection !== 'connected' || !mqtt.current) return;
    setMqttError('');
    const results = await Promise.allSettled(devices.map(device => mqtt.current.publishRelay(device.relay, enabled ? 'ON' : 'OFF')));
    if (results.some(result => result.status === 'rejected')) setMqttError('Có lệnh MQTT gửi thất bại. Kiểm tra trạng thái từng relay trước khi thử lại.');
  }
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
                <PhoneCamera key={barn.id} barn={barn}><CameraScreen barnName={barn.name} /></PhoneCamera>
                <IotEnvironment key={`environment:${barn.id}`} barnName={barn.name} readings={sensorReadings} connected={connection === 'connected'} />
              </div>
              <section className={styles.controls} aria-label={`Thiết bị ${barn.name}`}>
                <header><div><h3>Điều khiển thiết bị</h3><p>{connection === 'connected' ? 'Đã kết nối MQTT' : connection === 'connecting' ? 'Đang kết nối MQTT…' : 'MQTT chưa kết nối'} · 4 relay dùng chung</p></div>
                  <button type="button" className="farmshift-btn farmshift-btn-mint" onClick={() => setModal({ kind: 'add' })}><Plus size={17} />Thêm thiết bị</button></header>
                {mqttError && <p role="alert">{mqttError}</p>}
                <section className={styles.device} aria-label="Điều khiển relay trực tiếp">
                  <h4>Relay ESP32</h4>
                  {[1, 2, 3, 4].map(relay => {
                    const enabled = relayStates[relay];
                    return <div key={relay} className={styles.directRelay}>
                      <span>Relay {relay} · {enabled === undefined ? 'Chưa nhận trạng thái' : enabled ? 'Đang bật' : 'Đang tắt'}</span>
                      <div>
                        <button type="button" className="farmshift-btn farmshift-btn-secondary" aria-label={`Bật relay ${relay}`}
                          disabled={connection !== 'connected'} onClick={() => send([{ relay }], true)}>Bật</button>
                        <button type="button" className="farmshift-btn farmshift-btn-secondary" aria-label={`Tắt relay ${relay}`}
                          disabled={connection !== 'connected'} onClick={() => send([{ relay }], false)}>Tắt</button>
                      </div>
                    </div>;
                  })}
                </section>
                {devices.length === 0 && <p className={styles.state}>Chưa có thiết bị. Nhấn “Thêm thiết bị” để bắt đầu.</p>}
                {['FAN', 'LIGHT', 'WATER'].map(type => {
                  const members = devices.filter(device => device.type === type);
                  if (!members.length) return null;
                  const assigned = members.filter(device => device.relay);
                  const count = assigned.filter(device => relayStates[device.relay] === true).length;
                  const allOn = assigned.length > 0 && count === assigned.length;
                  const title = type === 'FAN' ? 'Quạt gió' : 'Hệ thống đèn chiếu sáng';
                  const cards = members.map(device => {
                  const Icon = TYPES[device.type].icon;
                  const enabled = relayStates[device.relay];
                  return <article key={device.id} className={`${styles.device} ${enabled ? styles.enabled : ''}`}>
                    <div className={styles.deviceTop}><span className={styles.deviceIcon}><Icon size={23} /></span>
                      <div className={styles.deviceInfo}><h4>{device.name}</h4><p>{device.relay ? `Relay ${device.relay}` : 'Chưa gán relay'} · {enabled === undefined ? 'Chưa nhận trạng thái' : enabled ? 'Đang bật' : 'Đang tắt'}</p></div>
                      <button type="button" role="switch" aria-checked={enabled === true} aria-label={`Bật tắt ${device.name}`} className={styles.toggle}
                        disabled={!device.relay || connection !== 'connected'} onClick={() => send([device], !enabled)}><span /></button>
                      </div>
                    <div className={styles.deviceActions}><button type="button" onClick={() => setModal({ kind: 'edit', device })}><Pencil size={14} />Chỉnh sửa</button>
                      <button type="button" onClick={() => setModal({ kind: 'delete', device })}><Trash2 size={14} />Xóa</button></div>
                  </article>;
                  });
                  if (type === 'WATER') return <div key={type}>{cards}</div>;
                  const Icon = TYPES[type].icon;
                  return <article key={`${barnId}:${type}`} className={styles.device}>
                    <div className={styles.deviceTop}>
                      <span className={styles.deviceIcon}><Icon size={23} /></span>
                      <div className={styles.deviceInfo}><h4>{title}</h4><p>{count}/{assigned.length} relay đã gán đang bật</p></div>
                      <button type="button" role="switch" aria-checked={allOn} aria-label={`Bật tắt toàn bộ ${title}`} className={styles.toggle}
                        disabled={!assigned.length || connection !== 'connected'} onClick={() => send(assigned, !allOn)}><span /></button>
                    </div>
                    <details className={styles.deviceGroup}>
                      <summary>{members.length} thiết bị</summary>
                      {cards}
                    </details>
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
      {modal && modal.kind !== 'delete' && <DeviceDialog device={modal.device} devices={devices} onClose={() => setModal(null)} onSave={values => {
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
