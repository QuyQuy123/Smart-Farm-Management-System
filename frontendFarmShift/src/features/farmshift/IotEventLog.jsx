import { useEffect, useState } from 'react';
import { api } from '../../utils/api';
import styles from './IotView.module.css';

const temperature = value => value == null ? 'Chưa có số đo mới' : `${value.toLocaleString('vi-VN')} °C`;

export function IotEventLog({ barnId, revision }) {
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [state, setState] = useState({ loading: true, rows: [], error: '' });
  useEffect(() => { setPage(0); }, [revision]);
  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, rows: [], error: '' });
    api.get(`/barns/${barnId}/iot-events`, { params: { page }, skipCache: true }).then(response => {
      if (!cancelled) setState({ loading: false, rows: response.data.data, error: '' });
    }).catch(() => {
      if (!cancelled) setState({ loading: false, rows: [], error: 'Không tải được nhật ký thiết bị.' });
    });
    return () => { cancelled = true; };
  }, [barnId, page, revision, reload]);
  return <section className={styles.environment} aria-label="Nhật ký bật thiết bị">
    <header className={styles.environmentHeading}><div><h3>Nhật ký bật thiết bị</h3>
      <p>Nhiệt độ khi gửi lệnh bật quạt hoặc phun sương</p></div>
      <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setReload(value => value + 1)}>Làm mới nhật ký</button>
    </header>
    {state.loading ? <p>Đang tải nhật ký…</p> : state.error ? <p role="alert">{state.error}</p> : state.rows.length === 0 ? <p>Chưa có sự kiện trong trang này.</p> :
      <div className={styles.chartScroll}><table className={styles.eventTable}>
        <thead><tr><th>Thời điểm</th><th>Sự kiện</th><th>Chế độ / Người gửi</th><th>Cảm biến 1</th><th>Cảm biến 3</th><th>Trung bình</th></tr></thead>
        <tbody>{state.rows.map(event => <tr key={event.id}>
          <td>{new Date(event.occurredAt).toLocaleString('vi-VN', { timeZone: 'Asia/Bangkok' })}</td>
          <td>Đã gửi lệnh bật {event.deviceName} · Relay {event.relay}</td>
          <td>{event.mode === 'AUTO' ? 'Tự động' : 'Thủ công'}<br />{event.actor}</td>
          <td>{temperature(event.temperature1)}</td><td>{temperature(event.temperature3)}</td>
          <td>{temperature(event.temperature1 == null || event.temperature3 == null ? null : Math.round((event.temperature1 + event.temperature3) * 5) / 10)}</td>
        </tr>)}</tbody>
      </table></div>}
    <div className={styles.deviceActions}>
      <button type="button" disabled={page === 0 || state.loading} onClick={() => setPage(value => value - 1)}>Trang trước</button>
      <span>Trang {page + 1}</span>
      <button type="button" disabled={state.rows.length < 20 || state.loading} onClick={() => setPage(value => value + 1)}>Trang sau</button>
    </div>
  </section>;
}
