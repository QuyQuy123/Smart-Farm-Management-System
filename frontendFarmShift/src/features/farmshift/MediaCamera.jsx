import { useEffect, useState } from 'react';
import { RefreshCw, Save, Video } from 'lucide-react';
import { api } from '../../utils/api';
import styles from './IotView.module.css';

export function MediaCamera({ barn }) {
  const [path, setPath] = useState('');
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [revision, setRevision] = useState(0);
  const base = import.meta.env.VITE_MEDIA_SERVER_URL || 'http://localhost:8889';
  let url = '';
  try {
    const server = new URL(base);
    if (!['http:', 'https:'].includes(server.protocol) || server.username || server.password) throw new Error();
    if (/^[A-Za-z0-9_-]{1,100}$/.test(saved)) {
      server.pathname = `${server.pathname.replace(/\/$/, '')}/${saved}/`;
      server.search = 'autoplay=true&muted=true&playsInline=true';
      url = server.href;
    }
  } catch { /* Invalid configuration is shown below. */ }
  useEffect(() => {
    let active = true;
    api.get(`/barns/${barn.id}/camera`, { skipCache: true }).then(response => {
      if (!active) return;
      const value = response.data.data?.streamPath || '';
      setPath(value); setSaved(value);
    }).catch(() => { if (active) setError('Không tải được cấu hình camera.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [barn.id]);
  async function save(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await api.put(`/barns/${barn.id}/camera`, { streamPath: path.trim() });
      setSaved(response.data.data.streamPath); setRevision(value => value + 1);
    } catch { setError('Không lưu được camera. Cần quyền chủ trang trại và stream path hợp lệ.'); }
    finally { setBusy(false); }
  }
  return <section className={styles.environment} aria-label={`Camera ${barn.name}`}>
    <header className={styles.environmentHeading}><h3 className={styles.mediaTitle}><Video size={20} aria-hidden="true" />Camera trực tiếp · {barn.name}</h3>
      {url && <button className={styles.mediaButton} type="button" onClick={() => setRevision(value => value + 1)}><RefreshCw size={16} aria-hidden="true" />Kết nối lại</button>}
    </header>
    {url ? <iframe key={revision} className={styles.mediaFrame} src={url} title={`Camera trực tiếp ${barn.name}`}
      allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
      : <p>{busy ? 'Đang tải camera…' : saved ? 'URL máy chủ video không hợp lệ.' : 'Nhập stream path để kết nối camera MediaMTX.'}</p>}
    <form className={styles.mediaSettings} onSubmit={save}>
      <label className={styles.mediaField}>Stream path <input required pattern="[A-Za-z0-9_-]{1,100}" maxLength={100} placeholder="cam-chuong-1" value={path} onChange={event => setPath(event.target.value)} /></label>
      <button className={styles.mediaButton} disabled={busy}><Save size={17} aria-hidden="true" />Lưu camera</button>
    </form>
    {error && <p role="alert">{error}</p>}
  </section>;
}
