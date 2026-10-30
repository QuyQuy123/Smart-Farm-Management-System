import { useEffect, useRef, useState } from 'react';
import { Camera, Upload, X, ScanText, FolderOpen } from 'lucide-react';
import styles from './SalesView.module.css';

export function WeightSlipCapture({ onFile, onClose }) {
  const input = useRef(null), mobile = useRef(null), video = useRef(null), stream = useRef(null);
  const [camera, setCamera] = useState(false), [ready, setReady] = useState(false), [error, setError] = useState('');
  const [tab, setTab] = useState('upload'), [dragging, setDragging] = useState(false);
  const request = useRef(0), closeButton = useRef(null);
  const mounted = useRef(true);
  const stop = () => { request.current += 1; stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; stop(); }; }, []);
  useEffect(() => {
    const previous = document.activeElement, overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; closeButton.current?.focus();
    const escape = event => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', escape);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', escape); previous?.focus?.(); };
  }, [onClose]);
  useEffect(() => { if (camera && video.current) video.current.srcObject = stream.current; }, [camera]);
  const choose = file => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type) || !file.size || file.size > 10 * 1024 * 1024) {
      setError('Chọn ảnh JPG, PNG hoặc PDF tối đa 10MB.'); return;
    }
    stop(); onFile(file);
  };
  async function start() {
    setError(''); setReady(false); setCamera(false);
    try {
      stop();
      const current = request.current;
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (!mounted.current || current !== request.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media; setCamera(true);
    } catch { if (mounted.current) setError('Không mở được camera. Hãy cấp quyền hoặc chọn ảnh từ thiết bị.'); }
  }
  function capture() {
    const element = video.current;
    if (!element?.videoWidth) return;
    const canvas = document.createElement('canvas'); canvas.width = element.videoWidth; canvas.height = element.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) { setError('Không thể chụp ảnh. Vui lòng tải ảnh từ thiết bị.'); return; }
    context.drawImage(element, 0, 0);
    canvas.toBlob(blob => { if (blob && mounted.current) choose(new File([blob], `phieu-can-${Date.now()}.jpg`, { type: 'image/jpeg' })); }, 'image/jpeg', 0.95);
  }
  const switchTab = value => { stop(); setCamera(false); setReady(false); setError(''); setTab(value); };
  const browse = () => input.current?.click();
  return <div className="farmshift-modal-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}><section className={`farmshift-card ${styles.captureDialog}`} role="dialog" aria-modal="true" aria-label="Bóc tách phiếu cân">
    <header className={styles.captureHeader}><h3><ScanText size={21} />Bóc tách phiếu cân bán gà / A4</h3><button ref={closeButton} type="button" className={styles.captureClose} aria-label="Đóng camera và tải ảnh" onClick={onClose}><X size={22} /></button></header>
    <div className={styles.captureBody}>
      <div className={styles.captureTabs} role="tablist" aria-label="Cách tải phiếu cân">
        <button type="button" role="tab" id="weight-upload-tab" aria-selected={tab === 'upload'} aria-controls="weight-upload-panel" onClick={() => switchTab('upload')}><Upload size={18} />Tải file / Kéo thả</button>
        <button type="button" role="tab" id="weight-camera-tab" aria-selected={tab === 'camera'} aria-controls="weight-camera-panel" onClick={() => switchTab('camera')}><Camera size={18} />Chụp ảnh trực tiếp</button>
      </div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {tab === 'upload' ? <div role="tabpanel" id="weight-upload-panel" aria-labelledby="weight-upload-tab">
        <div className={`${styles.captureDropZone} ${dragging ? styles.captureDragging : ''}`} role="button" tabIndex={0} aria-label="Chọn hoặc kéo thả phiếu cân"
          onClick={browse} onKeyDown={event => { if (event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) { event.preventDefault(); browse(); } }}
          onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
          onDrop={event => { event.preventDefault(); setDragging(false); if (event.dataTransfer.files.length > 1) setError('Vui lòng chọn một phiếu cân mỗi lần.'); else choose(event.dataTransfer.files[0]); }}>
          <span className={styles.captureUploadIcon}><Upload size={34} /></span>
          <strong>Kéo thả hoặc bấm vào đây để chọn ảnh / PDF phiếu cân</strong>
          <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={event => { event.stopPropagation(); browse(); }}><FolderOpen size={18} color="#eab650" />Duyệt tệp từ thiết bị</button>
          <small>JPG, PNG, PDF · tối đa 10MB · PDF tối đa 4 trang</small>
        </div>
      </div> : <div role="tabpanel" id="weight-camera-panel" aria-labelledby="weight-camera-tab" className={styles.captureCameraPanel}>
        {camera ? <video ref={video} autoPlay playsInline muted className={styles.cameraVideo} onLoadedData={() => setReady(true)} /> : <div className={styles.captureCameraPlaceholder}><Camera size={40} /><p>Chụp rõ toàn bộ phiếu cân, đủ sáng và không bị che khuất.</p></div>}
        <div className={styles.captureActions}>
          <button type="button" className="farmshift-btn farmshift-btn-mint" onClick={start}><Camera size={16} />{camera ? 'Mở lại camera' : 'Bật camera'}</button>
          {camera && <button type="button" disabled={!ready} className="farmshift-btn farmshift-btn-mint" onClick={capture}>Chụp và bóc tách</button>}
          <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => mobile.current.click()}>App máy ảnh</button>
        </div>
      </div>}
      <div className={styles.captureGuide}><ul>
        <li>Nhận diện người mua, số điện thoại, địa chỉ và ngày cân</li>
        <li>Bóc tách số con, cân thực tế sau trừ bì và đơn giá bán</li>
        <li>Đối chiếu ảnh gốc với dữ liệu và chỉnh sửa trước khi xác nhận</li>
        <li>Lưu đơn bán và bản gốc phiếu cân sau khi xác nhận</li>
      </ul></div>
    </div>
    <input ref={input} type="file" aria-label="Tải ảnh hoặc PDF phiếu cân" accept="image/jpeg,image/png,application/pdf" hidden onChange={event => { choose(event.target.files?.[0]); event.target.value = ''; }} />
    <input ref={mobile} type="file" aria-label="Chụp phiếu cân bằng thiết bị" accept="image/jpeg,image/png" capture="environment" hidden onChange={event => { choose(event.target.files?.[0]); event.target.value = ''; }} />
    <footer className={styles.captureFooter}><button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={onClose}>Đóng</button></footer>
  </section></div>;
}
