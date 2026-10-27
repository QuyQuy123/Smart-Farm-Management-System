import { useEffect, useState } from 'react';
import { getSalesInvoice } from '../../services/salesCustomerService';
import styles from './SalesInvoiceTemplate.module.css';

function BlankLine({ label, value }) {
  return <div className={styles.line}><span>{label}</span><span className={styles.blank}>{value || ''}</span></div>;
}

export function SalesInvoiceTemplate({ orderId }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setData(null); setError('');
    getSalesInvoice(orderId).then(data => { if (!cancelled) setData(data); })
      .catch(() => { if (!cancelled) setError('Không tải được thông tin hóa đơn. Vui lòng thử lại.'); });
    return () => { cancelled = true; };
  }, [orderId, revision]);
  if (error) return <div role="alert">{error}<button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setRevision(value => value + 1)}>Thử lại</button></div>;
  if (!data) return <p role="status">Đang tải thông tin hóa đơn...</p>;
  const seller = data.seller || {}, buyer = data.buyer || {};
  const [year, month, day] = (data.createdDate || '').split('-');
  return <article className={styles.paper} aria-label="Hóa đơn bán hàng">
    <header className={styles.header}>
      <div className={styles.heading}><h2>HÓA ĐƠN BÁN HÀNG</h2><p>Ngày {day || '........'} tháng {month || '........'} năm {year || '........'}</p></div>
      <div className={styles.serial}><BlankLine label="Mẫu số:" /><BlankLine label="Ký hiệu:" /><BlankLine label="Số:" /></div>
    </header>
    <section className={styles.seller} aria-label="Thông tin đơn vị bán hàng">
      <BlankLine label="Đơn vị bán hàng:" value={seller.name} /><BlankLine label="Mã số thuế:" value={seller.taxCode} /><BlankLine label="Địa chỉ:" value={seller.address} />
      <div className={styles.twoColumns}><BlankLine label="Điện thoại:" value={seller.phone} /><BlankLine label="Fax:" value={seller.fax} /></div>
      <BlankLine label="Số tài khoản:" value={seller.bankAccount} />
    </section>
    <section className={styles.buyer} aria-label="Thông tin người mua hàng">
      <BlankLine label="Họ tên người mua hàng:" value={buyer.name} /><BlankLine label="Mã số thuế:" value={buyer.taxCode} /><BlankLine label="Địa chỉ:" value={buyer.address} />
      <div className={styles.twoColumns}><BlankLine label="Hình thức thanh toán:" value={buyer.paymentMethod} /><BlankLine label="Số tài khoản:" /></div>
    </section>
    <table className={styles.items} aria-label="Danh sách hàng hóa để trống">
      <colgroup><col style={{ width: '6%' }} /><col style={{ width: '35%' }} /><col style={{ width: '11%' }} /><col style={{ width: '12%' }} /><col style={{ width: '17%' }} /><col style={{ width: '19%' }} /></colgroup>
      <thead><tr><th>STT</th><th>Tên hàng hóa, dịch vụ</th><th>Đơn vị tính</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
      <tbody>{Array.from({ length: 10 }, (_, index) => <tr key={index}>{Array.from({ length: 6 }, (_, column) => <td key={column}>&nbsp;</td>)}</tr>)}</tbody>
      <tfoot><tr><td colSpan={5}>Cộng tiền hàng hóa, dịch vụ:</td><td>&nbsp;</td></tr></tfoot>
    </table>
    <div className={styles.amount}><BlankLine label="Số tiền viết bằng chữ:" /><BlankLine label="" /></div>
    <div className={styles.signatures}><div><strong>Người mua hàng</strong><em>(Ký, ghi rõ họ tên)</em></div><div><strong>Người bán hàng</strong><em>(Ký, đóng dấu, ghi rõ họ tên)</em></div></div>
    <p className={styles.notice}>(Cần kiểm tra, đối chiếu khi lập, giao, nhận hóa đơn)</p>
  </article>;
}
