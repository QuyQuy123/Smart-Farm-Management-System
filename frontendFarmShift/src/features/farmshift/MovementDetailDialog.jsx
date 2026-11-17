import { useState } from 'react';
import { Dialog } from './FarmAreaDialogs';
import { MOVEMENT_TYPES, formatDay, labelOf } from './farmAreaOptions';
import areaStyles from './AreasView.module.css';
import styles from './BarnDetailView.module.css';

const num = (value, digits = 0) => value == null ? '—' : Number(value).toLocaleString('vi-VN', { maximumFractionDigits: digits });

/** Chi tiết một lần hao hụt / chuyển đàn: bảng nhật ký chỉ hiện tóm tắt, ở đây xem đủ ghi chú, người ghi và ảnh đính kèm. */
export function MovementDetailDialog({ movement, onClose }) {
  const photos = movement.photoUrls || [];
  const [selected, setSelected] = useState(0);
  const related = movement.relatedFlockCode
    ? ` (${movement.type === 'TRANSFER_OUT' ? 'sang' : 'từ'} đàn ${movement.relatedFlockCode})` : '';
  const rows = [
    ['Ngày', formatDay(movement.movementDate)],
    ['Đàn', [movement.flockCode, movement.flockName].filter(Boolean).join(' · ')],
    ['Loại', `${labelOf(MOVEMENT_TYPES, movement.type)}${related}`],
    ['Số con', `${num(movement.quantity)} con`],
    ...(movement.weightKg != null ? [['Khối lượng', `${num(movement.weightKg, 2)} kg`]] : []),
    ['Ghi chú', movement.note || '—'],
    ['Người ghi', movement.createdBy || '—'],
  ];
  const current = photos[Math.min(selected, photos.length - 1)];

  return <Dialog title={`Chi tiết ${labelOf(MOVEMENT_TYPES, movement.type).toLowerCase()}`} labelId="movement-detail-title" onClose={onClose}>
    <div className={areaStyles.modalBody}>
      <dl className={styles.flockDetail}>
        {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <h4 className={styles.movementPhotosTitle}>Ảnh đính kèm{photos.length ? ` (${photos.length})` : ''}</h4>
      {photos.length === 0 ? <p className={styles.movementNoPhoto}>Không có ảnh đính kèm.</p> : <div className={styles.movementPhotos}>
        <a href={current} target="_blank" rel="noreferrer" title="Mở ảnh gốc ở thẻ mới" className={styles.movementPhotoMain}>
          <img src={current} alt={`Ảnh ${selected + 1} của ${movement.flockCode}`} />
        </a>
        {photos.length > 1 && <div className={styles.movementThumbs}>
          {photos.map((url, index) => <button key={url} type="button" aria-label={`Xem ảnh ${index + 1}`} aria-pressed={index === selected}
            className={index === selected ? styles.movementThumbActive : ''} onClick={() => setSelected(index)}>
            <img src={url} alt="" />
          </button>)}
        </div>}
      </div>}
    </div>
    <footer className={areaStyles.footer}>
      <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={onClose}>Đóng</button>
    </footer>
  </Dialog>;
}
