import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import QRCode from 'qrcode';
import { api } from '../../utils/api';
import styles from './IotView.module.css';

export function PhoneCamera({ barn, children }) {
  const [link, setLink] = useState('');
  const [qr, setQr] = useState('');
  const [image, setImage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [localCamera, setLocalCamera] = useState(null);
  const [requestingCamera, setRequestingCamera] = useState(false);
  const localSession = useRef(null);
  const localVideo = useRef(null);
  const endpoint = `/phone-camera/${barn.id}`;

  useEffect(() => () => {
    const session = localSession.current;
    localSession.current = null;
    session?.stream?.getTracks().forEach(track => track.stop());
  }, []);

  useEffect(() => {
    if (localCamera && localVideo.current) localVideo.current.srcObject = localCamera;
  }, [localCamera]);

  async function startLocalCamera() {
    if (localSession.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Mở FarmShift qua HTTPS hoặc localhost để cấp quyền camera.');
      return;
    }
    const session = {};
    localSession.current = session;
    setRequestingCamera(true);
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (localSession.current !== session) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      session.stream = stream;
      setLocalCamera(stream);
    } catch {
      if (localSession.current !== session) return;
      localSession.current = null;
      setError('Không thể mở camera. Kiểm tra quyền camera rồi thử lại.');
    } finally {
      if (localSession.current === session || !localSession.current) setRequestingCamera(false);
    }
  }

  function stopLocalCamera() {
    localSession.current?.stream?.getTracks().forEach(track => track.stop());
    localSession.current = null;
    setLocalCamera(null);
  }

  useEffect(() => {
    const controller = new AbortController();
    let timer;
    let objectUrl = '';
    async function poll() {
      let next = '';
      try {
        const response = await api.get(`${endpoint}/frame`, {
          responseType: 'blob', skipCache: true, signal: controller.signal, timeout: 5000,
        });
        if (!controller.signal.aborted && response.status === 200) next = URL.createObjectURL(response.data);
      } catch { /* An unavailable frame returns the viewer to its placeholder. */ }
      if (controller.signal.aborted) return;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = next;
      setImage(next);
      timer = setTimeout(poll, 1200);
    }
    poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [endpoint]);

  const pair = useCallback(async (signal) => {
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post(endpoint, undefined, { signal });
      if (typeof data?.token !== 'string' || !/^[\da-f-]{36}$/i.test(data.token)) {
        throw new Error('Phản hồi ghép nối không hợp lệ. Kiểm tra cấu hình API của máy chủ.');
      }
      const url = new URL(import.meta.env.BASE_URL + 'phone-camera', window.location.origin);
      url.hash = data.token;
      const code = await QRCode.toDataURL(url.href, { width: 256, margin: 4 });
      if (!signal?.aborted) {
        setLink(url.href);
        setQr(code);
      }
    } catch {
      if (!signal?.aborted) setError('Không thể tạo liên kết camera. Vui lòng thử lại.');
    } finally { if (!signal?.aborted) setBusy(false); }
  }, [endpoint]);

  useEffect(() => {
    const controller = new AbortController();
    pair(controller.signal);
    return () => controller.abort();
  }, [pair]);

  async function stop() {
    setBusy(true);
    setError('');
    try {
      await api.delete(endpoint);
      setLink('');
      setQr('');
      setImage('');
    } catch {
      setError('Không thể ngắt camera. Vui lòng thử lại.');
    } finally { setBusy(false); }
  }

  return <section className={styles.cameraPanel}>
    <header><Camera size={20} /><h3>Camera giám sát</h3></header>
    {localCamera ? <div className={styles.camera}>
      <video ref={localVideo} className={styles.phoneFrame} autoPlay muted playsInline aria-label={`Camera trên máy này · ${barn.name}`} />
    </div> : image ? <div className={styles.camera}><img className={styles.phoneFrame} src={image} alt={`Camera trực tiếp ${barn.name}`} /></div> : children}
    <div className={styles.cameraPairing}>
      {!link && <button type="button" className="farmshift-btn farmshift-btn-mint" disabled={busy} onClick={() => pair()}>Kết nối Camera</button>}
      {(link || image) && <button type="button" className="farmshift-btn farmshift-btn-secondary" disabled={busy} onClick={stop}>Ngắt camera</button>}
      {localCamera
        ? <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={stopLocalCamera}>Tắt camera trên máy này</button>
        : <button type="button" className="farmshift-btn farmshift-btn-secondary" disabled={requestingCamera} onClick={startLocalCamera}>Bật camera trên máy này</button>}
      {link && <figure className={styles.cameraQr}>
        <img src={qr} width="256" height="256" alt={`Mã QR kết nối camera ${barn.name}`} />
        <figcaption>Quét mã QR bằng điện thoại đặt tại {barn.name}, rồi bấm Bắt đầu phát.</figcaption>
        {window.location.protocol !== 'https:' && <p>Để quét mã trên điện thoại, hãy mở FarmShift bằng địa chỉ HTTPS của máy chủ rồi lấy lại mã QR.</p>}
      </figure>}
      {error && <p role="alert">{error}</p>}
    </div>
  </section>;
}

export function PhoneCameraPublisher() {
  const video = useRef(null);
  const session = useRef(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');
  const token = window.location.hash.slice(1);

  function stop() {
    const current = session.current;
    session.current = null;
    current?.controller.abort();
    current?.stream?.getTracks().forEach(track => track.stop());
    setActive(false);
  }

  useEffect(() => () => {
    session.current?.controller.abort();
    session.current?.stream?.getTracks().forEach(track => track.stop());
  }, []);

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Hãy mở liên kết qua HTTPS để cấp quyền camera.');
      return;
    }
    const current = { controller: new AbortController() };
    session.current = current;
    const { signal } = current.controller;
    setActive(true);
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 } }, audio: false });
      if (signal.aborted) { stream.getTracks().forEach(track => track.stop()); return; }
      current.stream = stream;
      video.current.srcObject = stream;
      await video.current.play();
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(video.current.videoWidth, 640);
      canvas.height = Math.round(canvas.width * video.current.videoHeight / video.current.videoWidth);
      const context = canvas.getContext('2d');
      while (!signal.aborted) {
        context.drawImage(video.current, 0, 0, canvas.width, canvas.height);
        const frame = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.65));
        if (signal.aborted) break;
        if (!frame) throw new Error('Không thể lấy hình ảnh camera.');
        const response = await api.put(`/phone-camera/publish/${encodeURIComponent(token)}`, frame, {
          headers: { 'Content-Type': 'image/jpeg' }, signal, timeout: 5000,
        });
        if (response.status !== 204) throw new Error('Máy chủ không xác nhận ảnh camera.');
        await new Promise(resolve => setTimeout(resolve, 1200));
      }
    } catch (cause) {
      if (signal.aborted) return;
      stop();
      setError(cause.response?.status === 404 ? 'Liên kết đã hết hiệu lực. Hãy tạo liên kết mới trên web.'
        : 'Không thể phát camera. Kiểm tra quyền camera và kết nối mạng rồi thử lại.');
    }
  }

  return <main className={styles.phonePublisher}>
    <h1>Phát camera chuồng nuôi</h1>
    <video ref={video} muted playsInline autoPlay aria-label="Xem trước camera điện thoại" />
    {active ? <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={stop}>Dừng phát</button>
      : <button type="button" className="farmshift-btn farmshift-btn-mint" disabled={!/^[\da-f-]{36}$/i.test(token)} onClick={start}>Bắt đầu phát</button>}
    {error && <p role="alert">{error}</p>}
    <p>Giữ trang này mở trên điện thoại trong lúc phát.</p>
  </main>;
}
