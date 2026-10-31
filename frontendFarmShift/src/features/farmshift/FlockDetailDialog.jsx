import { Link } from 'react-router-dom';
import { Dialog } from './FarmAreaDialogs';
import { FLOCK_GENDERS, formatDay, labelOf } from './farmAreaOptions';
import areaStyles from './AreasView.module.css';
import styles from './BarnDetailView.module.css';

const num = (value, digits = 0) => value == null ? '—' : Number(value).toLocaleString('vi-VN', { maximumFractionDigits: digits });

/** Chi tiết một đàn: bảng danh sách đàn chỉ hiện tên, ngày tuổi, tồn; phần còn lại xem ở đây. Giá và hóa đơn chỉ khi canFinance. */
export function FlockDetailDialog({ flock, canFinance, onClose }) {
  const rows = [
    ['Mã đàn', flock.code],
    ['Chương trình nuôi', flock.programName || 'Chưa gắn'],
    ['Giới tính', labelOf(FLOCK_GENDERS, flock.gender)],
    ['Ngày nhập', formatDay(flock.importDate)],
    ['Ngày tuổi', `${flock.currentAgeDays} (lúc nhập ${flock.ageAtImport})`],
    ['Số lượng nhập', `${num(flock.importQuantity)} con · ${num(flock.importWeightKg, 1)} kg (TB ${num(flock.importAvgWeight, 3)} kg/con)`],
    ['Đang nuôi', `${num(flock.quantity)} con`],
    [flock.sourceType === 'TRANSFER' ? 'Chuyển từ' : 'Nguồn nhập',
      flock.sourceType === 'TRANSFER' ? `${flock.sourceNote || ''}${flock.sourceFlockCode ? ` · đàn ${flock.sourceFlockCode}` : ''}` : flock.supplierName || flock.sourceNote || '—'],
    ...(canFinance && flock.unitPrice != null ? [['Giá con giống', `${num(flock.unitPrice)}đ/con`]] : []),
    ...(canFinance && flock.purchaseInvoiceId ? [['Hóa đơn nhập', <Link key="invoice" to={`/purchases?invoice=${flock.purchaseInvoiceId}`}>{flock.purchaseInvoiceCode}</Link>]] : []),
    ...(flock.note ? [['Ghi chú', flock.note]] : []),
  ];
  return <Dialog title={`Đàn ${flock.name}`} labelId="flock-detail-title" onClose={onClose}>
    <div className={areaStyles.modalBody}>
      <dl className={styles.flockDetail}>
        {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
    </div>
    <footer className={areaStyles.footer}>
      <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={onClose}>Đóng</button>
    </footer>
  </Dialog>;
}
