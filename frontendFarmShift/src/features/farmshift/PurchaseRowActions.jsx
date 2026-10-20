import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, Eye, Pencil, Trash2, X, Plus } from 'lucide-react';
import { updatePurchase, deletePurchase } from '../../services/purchaseService';
import { useNotification } from '../../context/NotificationContext';
import styles from './WarehouseCategoriesView.module.css';
import purchaseStyles from './PurchasesView.module.css';
function InvoiceDialog({ mode, invoice, suppliers, tags, onClose, onSaved }) {
  const ref = useRef(null), deleting = mode === 'delete';
  const [supplierId] = useState(String(invoice.supplierId || ''));
  const [date, setDate] = useState(invoice.date || '');
  const [referenceCode, setReferenceCode] = useState(invoice.referenceCode || '');
  const [note, setNote] = useState(invoice.note || '');
  const [items, setItems] = useState((invoice.items || []).map(item => ({ ...item })));
  const [discountAmount, setDiscountAmount] = useState(invoice.discountAmount || 0);
  const [otherCost, setOtherCost] = useState(invoice.otherCost || 0);
  const total = Math.max(0, items.reduce((sum, item) => sum + Math.round(Number(item.qty || 0) * Number(item.price || 0)), 0) - Number(discountAmount || 0) + Number(otherCost || 0));
  const changeItem = (index, field, value) => setItems(rows => rows.map((row, i) => i === index ? { ...row, [field]: value, ...(field === 'name' ? { productCategoryId: null } : {}) } : row));
  const [tagIds, setTagIds] = useState(invoice.tagIds || []);
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    const element = ref.current, previous = document.body.style.overflow;
    element.showModal(); document.body.style.overflow = 'hidden';
    return () => { element.close(); document.body.style.overflow = previous; };
  }, []);
  async function submit(event) {
    event.preventDefault(); if (saving) return;
    if (!deleting && (!items.length || items.some(item => !item.name?.trim() || !item.unit?.trim() || !Number.isFinite(Number(item.qty)) || Number(item.qty) <= 0 || item.price === '' || !Number.isSafeInteger(Number(item.price)) || Number(item.price) < 0))) {
      setError('Vui lòng nhập đủ mặt hàng, đơn vị, số lượng lớn hơn 0 và đơn giá không âm.'); return;
    }
    setSaving(true); setError('');
    try {
      if (deleting) await deletePurchase(invoice.id);
      else await updatePurchase(invoice.id, { supplierId: Number(supplierId), date, referenceCode: referenceCode.trim(), note: note.trim(), tagIds, items: items.map(item => ({ productCategoryId: item.productCategoryId || null, name: item.name.trim(), unit: item.unit.trim(), qty: Number(item.qty), price: Number(item.price), vatRate: item.vatRate || 0 })), discountAmount: Number(discountAmount), otherCost: Number(otherCost) });
      onSaved(deleting ? 'Đã xóa hóa đơn.' : 'Đã cập nhật hóa đơn.');
    } catch (error) { setError(error.response?.data?.message || 'Không lưu được thay đổi. Vui lòng thử lại.'); setSaving(false); }
  }
  return <dialog ref={ref} className={styles.dialog} aria-labelledby="invoice-action-title" onCancel={event => { event.preventDefault(); if (!saving) onClose(); }} onClick={event => { if (event.target === event.currentTarget && !saving) onClose(); }}><section className={`${styles.modal} ${!deleting ? purchaseStyles.editModal : ''}`}>
    <header className={styles.modalHeader}><h2 id="invoice-action-title">{deleting ? 'Xóa' : 'Sửa'} hóa đơn {invoice.code}</h2><button type="button" className={styles.iconButton} aria-label="Đóng" disabled={saving} onClick={onClose}><X size={18} /></button></header>
    <form onSubmit={submit}><div className={`${styles.modalBody} ${!deleting ? purchaseStyles.editBody : ''}`}>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {deleting ? <p>Bạn có chắc muốn xóa hóa đơn <strong>{invoice.code}</strong>?</p> : <>
        <div className={purchaseStyles.editGrid}>
        <div className="farmshift-form-group"><label htmlFor="edit-invoice-supplier">Nhà cung cấp <span className={styles.required}>*</span></label><input id="edit-invoice-supplier" className="farmshift-form-control" value={suppliers.find(supplier => String(supplier.id) === supplierId)?.name || invoice.supplier || ''} readOnly /></div>
        <div className="farmshift-form-group"><label htmlFor="edit-invoice-date">Ngày chứng từ <span className={styles.required}>*</span></label><input id="edit-invoice-date" className="farmshift-form-control" type="date" required value={date} onChange={event => setDate(event.target.value)} disabled={saving} /></div>
        <div className="farmshift-form-group"><label htmlFor="edit-invoice-reference">Số chứng từ</label><input id="edit-invoice-reference" className="farmshift-form-control" maxLength={100} value={referenceCode} onChange={event => setReferenceCode(event.target.value)} disabled={saving} /></div>
        </div>
        <div className={purchaseStyles.editStatuses}>
          <div><label>Trạng thái thanh toán</label><input className="farmshift-form-control" value={invoice.paymentStatus || 'Trả sau'} readOnly /></div>
          <div><label>Trạng thái kho hàng</label><input className="farmshift-form-control" value={invoice.stockStatus} readOnly /></div>
        </div>
        <section className={purchaseStyles.editItemsSection}>
          <div className={purchaseStyles.editItemsHeading}><strong>Chi tiết các mặt hàng nhập:</strong><button type="button" className="farmshift-btn farmshift-btn-secondary" disabled={saving} onClick={() => setItems(rows => [...rows, { name: '', qty: 1, unit: '', price: 0 }])}><Plus size={14} />Thêm dòng hàng</button></div>
          {items.map((item, index) => <div className={purchaseStyles.editItemRow} key={index}>
            <label>Tên hàng hóa *<input aria-label={`Tên hàng hóa ${index + 1}`} className="farmshift-form-control" required maxLength={200} value={item.name} onChange={event => changeItem(index, 'name', event.target.value)} disabled={saving} /></label>
            <label>Số lượng *<input aria-label={`Số lượng ${index + 1}`} className="farmshift-form-control" type="number" required min="0.001" step="0.001" value={item.qty} onChange={event => changeItem(index, 'qty', event.target.value)} disabled={saving} /></label>
            <label>Đơn vị *<input aria-label={`Đơn vị ${index + 1}`} className="farmshift-form-control" required maxLength={50} value={item.unit} onChange={event => changeItem(index, 'unit', event.target.value)} disabled={saving} /></label>
            <label>Đơn giá (VNĐ) *<input aria-label={`Đơn giá ${index + 1}`} className="farmshift-form-control" type="number" required min="0" step="1" value={item.price} onChange={event => changeItem(index, 'price', event.target.value)} disabled={saving} /></label>
            <label>Thành tiền<output>{Math.round(Number(item.qty || 0) * Number(item.price || 0)).toLocaleString('vi-VN')} đ</output></label>
            <button type="button" className={styles.iconButton} aria-label={`Xóa dòng hàng ${index + 1}`} disabled={saving || items.length === 1} onClick={() => setItems(rows => rows.filter((_, i) => i !== index))}><Trash2 size={15} /></button>
          </div>)}
        </section>
        <div className="farmshift-form-group"><label htmlFor="edit-invoice-note">Ghi chú</label><textarea id="edit-invoice-note" className="farmshift-form-control" rows={3} maxLength={1000} value={note} onChange={event => setNote(event.target.value)} disabled={saving} /></div>
        <fieldset disabled={saving} className={purchaseStyles.editTags}><legend>Thẻ tag</legend>{tags.map(tag => <label key={tag.id} ><input type="checkbox" checked={tagIds.includes(tag.id)} onChange={event => setTagIds(ids => event.target.checked ? [...ids, tag.id] : ids.filter(id => id !== tag.id))} />{tag.name}</label>)}</fieldset>
        <div className={purchaseStyles.editStatuses}>
          <div><label htmlFor="edit-discount">Chiết khấu (VNĐ)</label><input id="edit-discount" type="number" min="0" step="1" required className="farmshift-form-control" value={discountAmount} onChange={event => setDiscountAmount(event.target.value)} disabled={saving} /></div>
          <div><label htmlFor="edit-other-cost">Chi phí khác (VNĐ)</label><input id="edit-other-cost" type="number" min="0" step="1" required className="farmshift-form-control" value={otherCost} onChange={event => setOtherCost(event.target.value)} disabled={saving} /></div>
        </div>
        <div className={purchaseStyles.editTotal}>Tổng tiền: <strong>{total.toLocaleString('vi-VN')} đ</strong></div>
      </>}
    </div><footer className={styles.footer}><button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={onClose} disabled={saving}>Hủy bỏ</button><button className={`farmshift-btn ${deleting ? styles.deleteButton : 'farmshift-btn-mint'}`} type="submit" disabled={saving}>{saving ? 'Đang xử lý...' : deleting ? 'Xóa hóa đơn' : 'Lưu thay đổi'}</button></footer></form>
  </section></dialog>;
}
export function PurchaseRowActions({ invoice, canEdit, suppliers, tags, onView, onReload }) {
  const trigger = useRef(null), menu = useRef(null);
  const [position, setPosition] = useState(null), [mode, setMode] = useState(null);
  const { showToast } = useNotification();
  const protectedInvoice = invoice.stockStatus === 'Đã nhập kho' || Number(invoice.paidAmount) > 0 || invoice.paymentStatus === 'Thanh toán hoàn tất';
  useEffect(() => {
    if (!position) return;
    const close = event => { if (!menu.current?.contains(event.target) && !trigger.current?.contains(event.target)) setPosition(null); };
    const key = event => { if (event.key === 'Escape') { setPosition(null); trigger.current?.focus(); } };
    const scroll = () => setPosition(null);
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', key);
    window.addEventListener('resize', scroll); window.addEventListener('scroll', scroll, true);
    menu.current?.querySelector('button')?.focus();
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', key); window.removeEventListener('resize', scroll); window.removeEventListener('scroll', scroll, true); };
  }, [position]);
  function choose(action) { setPosition(null); if (action === 'view') onView(invoice); else setMode(action); }
  return <>
    <button ref={trigger} type="button" className={styles.iconButton} aria-label={`Thao tác hóa đơn ${invoice.code}`} aria-haspopup="menu" aria-expanded={!!position} onClick={() => { const rect = trigger.current.getBoundingClientRect(); setPosition(position ? null : { left: Math.max(8, Math.min(rect.right - 190, window.innerWidth - 198)), top: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 150)) }); }}><MoreVertical size={18} /></button>
    {position && createPortal(<div ref={menu} role="menu" aria-label={`Thao tác ${invoice.code}`} className={purchaseStyles.rowMenu} style={position} onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); const buttons = [...menu.current.querySelectorAll('button:not(:disabled)')]; const index = buttons.indexOf(document.activeElement); buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus(); } }}>
      <button role="menuitem" onClick={() => choose('view')}><Eye size={16} />Xem chi tiết</button>
      {canEdit && <><button role="menuitem" disabled={invoice.stockStatus === 'Đã hủy' || protectedInvoice} title={protectedInvoice ? 'Hóa đơn đã thanh toán hoặc nhập kho không được sửa' : 'Sửa hóa đơn'} onClick={() => choose('edit')}><Pencil size={16} />Sửa hóa đơn</button><button role="menuitem" className={purchaseStyles.deleteAction} disabled={protectedInvoice} title={protectedInvoice ? 'Hóa đơn đã nhập kho hoặc thanh toán không thể xóa' : 'Xóa hóa đơn'} onClick={() => choose('delete')}><Trash2 size={16} />Xóa hóa đơn</button></>}
    </div>, document.body)}
    {mode && <InvoiceDialog mode={mode} invoice={invoice} suppliers={suppliers} tags={tags} onClose={() => setMode(null)} onSaved={text => { setMode(null); showToast(text, 'success'); onReload(); }} />}
  </>;
}
