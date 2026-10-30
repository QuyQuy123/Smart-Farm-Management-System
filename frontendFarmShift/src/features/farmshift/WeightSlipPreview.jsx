import { useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, ExternalLink } from 'lucide-react';
import { previewWeightSlip } from '../../services/weightSlipService';
import styles from './SalesView.module.css';

const initial = { scale: 1, x: 0, y: 0 };
export function WeightSlipPreview({ file, imageUrl }) {
  const viewport = useRef(null), current = useRef(initial), drag = useRef(null);
  const [view, setView] = useState(initial), [pages, setPages] = useState([]), [error, setError] = useState(''), [loading, setLoading] = useState(false);

  const update = value => { current.current = value; setView(value); };

  useEffect(() => {
    const controller = new AbortController();
    current.current = initial; setView(initial); drag.current = null; setError(''); setPages([]);
    if (file.type !== 'application/pdf') { setLoading(false); return () => controller.abort(); }
    setLoading(true);
    previewWeightSlip(file, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      if (!Array.isArray(result) || !result.length) throw new Error('Không có trang PDF để hiển thị.');
      setPages(result);
    }).catch(failure => { if (!controller.signal.aborted) setError(failure.response?.data?.message || failure.message || 'Không mở được bản xem trước.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [file]);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const wheel = event => {
      event.preventDefault();
      const rect = element.getBoundingClientRect(), previous = current.current;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1);
      const scale = Math.min(8, Math.max(0.3, previous.scale * Math.exp(-delta * 0.0015)));
      const x = event.clientX - rect.left, y = event.clientY - rect.top;
      drag.current = null;
      update({ scale, x: x - (x - previous.x) * scale / previous.scale, y: y - (y - previous.y) * scale / previous.scale });
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, []);

  const zoomIn = () => update({ ...current.current, scale: Math.min(8, Number((current.current.scale * 1.3).toFixed(2))) });
  const zoomOut = () => update({ ...current.current, scale: Math.max(0.3, Number((current.current.scale / 1.3).toFixed(2))) });
  const resetZoom = () => update(initial);

  const viewOriginal = () => {
    if (file) {
      const url = URL.createObjectURL(file);
      window.open(url, '_blank');
    } else if (imageUrl) {
      window.open(imageUrl, '_blank');
    }
  };

  const sources = file.type === 'application/pdf' ? pages : imageUrl ? [imageUrl] : [];
  return <>
    <div className={styles.previewToolbar}>
      <div className={styles.zoomControls}>
        <button type="button" className={styles.previewToolBtn} onClick={zoomOut} title="Thu nhỏ" aria-label="Thu nhỏ">
          <ZoomOut size={15} />
        </button>
        <span className={styles.zoomLevel}>{Math.round(view.scale * 100)}%</span>
        <button type="button" className={styles.previewToolBtn} onClick={zoomIn} title="Phóng to" aria-label="Phóng to">
          <ZoomIn size={15} />
        </button>
        <button type="button" className={styles.previewToolBtn} onClick={resetZoom} title="Đặt lại kích thước" aria-label="Đặt lại">
          <RotateCcw size={14} />
        </button>
      </div>
      <button type="button" className={styles.previewOpenOriginal} onClick={viewOriginal} title="Mở bản gốc độ nét cao ở tab mới">
        <ExternalLink size={14} />
        <span>Xem ảnh gốc</span>
      </button>
    </div>
    <div ref={viewport} className={styles.documentViewport} role="region" aria-label="Xem phiếu cân bằng chuột" tabIndex={0}
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.preventDefault(); viewport.current.focus();
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, view: current.current };
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerMove={event => {
        const start = drag.current;
        if (!start || start.id !== event.pointerId) return;
        update({ ...start.view, x: start.view.x + event.clientX - start.x, y: start.view.y + event.clientY - start.y });
      }}
      onPointerUp={event => { drag.current = null; if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
      onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
      onKeyDown={event => {
        const previous = current.current;
        if (event.key === 'Home') { event.preventDefault(); update(initial); }
        else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
          event.preventDefault(); update({ ...previous, x: previous.x + (event.key === 'ArrowLeft' ? 30 : event.key === 'ArrowRight' ? -30 : 0), y: previous.y + (event.key === 'ArrowUp' ? 30 : event.key === 'ArrowDown' ? -30 : 0) });
        }
      }}>
      {loading && <p role="status" className={styles.documentMessage}>Đang mở phiếu cân...</p>}
      {error && <p role="alert" className={styles.documentMessage}>{error}</p>}
      <div className={styles.documentPages} data-testid="weight-document-pages" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
        {sources.map((src, index) => <img key={src} src={src} alt={file.type === 'application/pdf' ? `Trang ${index + 1} phiếu cân gốc` : 'Ảnh phiếu cân gốc'} draggable={false} onDragStart={event => event.preventDefault()} />)}
      </div>
    </div>
    <p className={styles.documentHint}>Lăn chuột hoặc dùng nút +/- để phóng to · Giữ chuột để kéo xem phiếu</p>
  </>;
}
