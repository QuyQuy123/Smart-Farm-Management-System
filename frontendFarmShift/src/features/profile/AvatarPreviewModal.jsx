import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Minus, Plus, RotateCcw } from 'lucide-react';
import styles from './AvatarPreviewModal.module.css';

export const AvatarPreviewModal = ({ src, onClose }) => {
  const dialogRef = useRef(null);
  const frameRef = useRef(null);
  const dragRef = useRef(null);
  const [zoom, setZoom] = useState(1.2);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const constrain = (position, scale) => {
    const limit = (frameRef.current?.getBoundingClientRect().width || 0) * (scale - 1) / 2;
    return { x: Math.max(-limit, Math.min(limit, position.x)), y: Math.max(-limit, Math.min(limit, position.y)) };
  };
  const changeZoom = value => {
    const next = Math.max(1, Math.min(3, value));
    setZoom(next);
    setPosition(current => constrain(current, next));
  };
  const finishDrag = () => { dragRef.current = null; setDragging(false); };

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return createPortal(
    <dialog ref={dialogRef} className={styles.overlay} aria-labelledby="avatar-preview-title"
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <h2 id="avatar-preview-title">Ảnh đại diện</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Đóng ảnh đại diện">
            <X size={21} />
          </button>
        </div>
        <div ref={frameRef} className={`${styles.imageFrame} ${dragging ? styles.dragging : ''}`}
          onPointerDown={event => {
            if (event.button !== 0 || dragRef.current) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, ...position };
            setDragging(true);
          }}
          onPointerMove={event => {
            const drag = dragRef.current;
            if (!drag || event.pointerId !== drag.pointerId) return;
            setPosition(constrain({ x: drag.x + event.clientX - drag.clientX, y: drag.y + event.clientY - drag.clientY }, zoom));
          }}
          onPointerUp={event => {
            if (dragRef.current?.pointerId !== event.pointerId) return;
            event.currentTarget.releasePointerCapture(event.pointerId);
            finishDrag();
          }}
          onPointerCancel={finishDrag} onLostPointerCapture={finishDrag}>
          <img src={src} alt="Ảnh đại diện phóng to" className={styles.image} draggable={false}
            style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})` }} />
        </div>
        <p className={styles.hint}>Kéo ảnh để xem · Dùng thanh trượt để phóng to</p>
        <div className={styles.controls}>
          <button type="button" onClick={() => changeZoom(zoom - 0.2)} disabled={zoom <= 1} aria-label="Thu nhỏ"><Minus size={17} /></button>
          <input type="range" min="1" max="3" step="0.05" value={zoom} onChange={event => changeZoom(Number(event.target.value))} aria-label="Mức phóng to ảnh" />
          <button type="button" onClick={() => changeZoom(zoom + 0.2)} disabled={zoom >= 3} aria-label="Phóng to"><Plus size={17} /></button>
          <button type="button" onClick={() => { setZoom(1.2); setPosition({ x: 0, y: 0 }); }} aria-label="Đặt lại ảnh" title="Đặt lại ảnh"><RotateCcw size={17} /></button>
        </div>
      </div>
    </dialog>,
    document.body,
  );
};
