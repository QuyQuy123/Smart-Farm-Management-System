import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { readMoneyToVietnameseWords } from '../../utils/vietnameseWords';
import paper from './SalesInvoiceTemplate.module.css';
import styles from './PurchaseInvoiceTemplate.module.css';

const money = value => `${Number(value ?? 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} đ`;
function Line({ label, value }) {
  return <div className={styles.line}><span>{label}</span><span>{value ?? '—'}</span></div>;
}
export const PurchaseInvoiceTemplate = forwardRef(function PurchaseInvoiceTemplate({ order, supplier }, ref) {
  const [printing, setPrinting] = useState(false);
  useImperativeHandle(ref, () => ({ print: () => { if (order) setPrinting(true); } }), [order]);
  useEffect(() => {
    if (!printing) return;
    const finish = () => setPrinting(false);
    window.addEventListener('afterprint', finish);
    const timer = window.setTimeout(() => { try { window.print(); } catch { finish(); } }, 0);
    return () => { window.clearTimeout(timer); window.removeEventListener('afterprint', finish); };
  }, [printing]);
  if (!order) return null;
  const items = order.items || [];
  const debt = order.debtAmount ?? Math.max(0, Number(order.totalAmount || 0) - Number(order.paidAmount || 0));
  const subtotal = items.reduce((sum, item) => sum + Number(item.amount ?? (Number(item.qty) * Number(item.price))), 0);
  const [year, month, day] = (order.date || '').split('-');
  const content = <article className={paper.paper} aria-label="Hóa đơn nhập hàng">
    <header className={paper.header}>
      <div className={paper.heading}><h2>HÓA ĐƠN NHẬP HÀNG</h2><p>Ngày {day || '…'} tháng {month || '…'} năm {year || '…'}</p></div>
      <div className={paper.serial}><Line label="Số:" value={order.code} /></div>
    </header>

    <section className={paper.seller} aria-label="Thông tin hóa đơn nhập">
      <Line label="Nhà cung cấp:" value={order.supplier} />
      {(order.supplierPhone || supplier?.phone) && <Line label="Điện thoại:" value={order.supplierPhone || supplier.phone} />}
      {supplier?.address && <Line label="Địa chỉ:" value={supplier.address} />}
      <div className={paper.twoColumns}><Line label="Trạng thái thanh toán:" value={order.paymentStatus} /><Line label="Trạng thái kho:" value={order.stockStatus} /></div>
      {order.importedDate && <Line label="Ngày nhập kho:" value={order.importedDate.split('-').reverse().join('/')} />}
      {order.referenceCode && <Line label="Mã tham chiếu / Số HĐ:" value={order.referenceCode} />}
    </section>
    <h3 className={styles.itemsHeading}>Danh sách mặt hàng nhập:</h3>
    <table className={paper.items} aria-label="Mặt hàng hóa đơn nhập">
      <colgroup><col style={{ width: '6%' }} /><col style={{ width: '34%' }} /><col style={{ width: '11%' }} /><col style={{ width: '12%' }} /><col style={{ width: '17%' }} /><col style={{ width: '20%' }} /></colgroup>
      <thead><tr><th>STT</th><th>Mặt hàng</th><th>Đơn vị tính</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
      <tbody>{items.map((item, index) => <tr key={item.id || index}><td className={paper.center}>{index + 1}</td><td>{item.name}</td><td className={paper.center}>{item.unit}</td><td className={paper.numeric}>{Number(item.qty || 0).toLocaleString('vi-VN')}</td><td className={paper.numeric}>{money(item.price)}</td><td className={paper.numeric}>{money(item.amount ?? (Number(item.qty) * Number(item.price)))}</td></tr>)}
        {Array.from({ length: Math.max(0, 6 - items.length) }, (_, index) => <tr key={`blank-${index}`}>{Array.from({ length: 6 }, (_, column) => <td key={column}>&nbsp;</td>)}</tr>)}
      </tbody>
      <tfoot>
        <tr><td colSpan={5}>Cộng tiền hàng:</td><td className={paper.numeric}>{money(subtotal)}</td></tr>
        <tr><td colSpan={5}>Chiết khấu:</td><td className={paper.numeric}>{money(order.discountAmount)}</td></tr>
        <tr><td colSpan={5}>Chi phí khác:</td><td className={paper.numeric}>{money(order.otherCost)}</td></tr>
        <tr><td colSpan={5}><strong>Tổng tiền hóa đơn:</strong></td><td className={paper.numeric}><strong>{money(order.totalAmount)}</strong></td></tr>
      </tfoot>
    </table>
    <div className={paper.amount}><Line label="Số tiền viết bằng chữ:" value={readMoneyToVietnameseWords(Number(order.totalAmount || 0))} /></div>
    <div className={paper.paymentSummary}><Line label="Đã thanh toán:" value={money(order.paidAmount)} /><Line label="Còn nợ lại:" value={money(debt)} /></div>
    <Line label="Ghi chú:" value={order.note || '—'} />
    {order.tags?.length > 0 && <Line label="Thẻ Tag phân loại:" value={order.tags.join(', ')} />}
    <div className={paper.signatures}><div><strong>Người giao hàng</strong><em>(Ký, ghi rõ họ tên)</em></div><div><strong>Người nhận hàng</strong><em>(Ký, ghi rõ họ tên)</em></div></div>
    <p className={paper.notice}>(Cần kiểm tra, đối chiếu khi lập, giao, nhận hóa đơn)</p>
  </article>;
  return <>{content}{printing && createPortal(<div className={paper.printRoot} data-purchase-invoice-print aria-hidden="true">{content}</div>, document.body)}</>;
});
