import { useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './StockNamePicker.module.css';

const key = value => String(value || '').trim().toLocaleLowerCase('vi');

/**
 * Ô nhập tên có danh sách gợi ý lọc theo chữ gõ (cám, vắc-xin hoặc thuốc trong kho).
 * Chọn một dòng thì gắn hàng hóa kho (để phiếu việc tự trừ kho); gõ tên khác thì vẫn lưu được, chỉ là không trừ kho.
 * onChange({ name, inventoryItemId }) — inventoryItemId là '' khi tên không trùng hàng hóa nào.
 * Danh sách dùng position: fixed để không bị cắt bởi bảng cuộn ngang.
 */
export function StockNamePicker({ label, value, itemId, options, placeholder, disabled, invalid, onChange }) {
  const input = useRef(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [box, setBox] = useState(null);
  const needle = key(value);
  const chosen = options.find(option => String(option.id) === String(itemId));
  // Đang hiện đúng hàng đã chọn thì cho xem cả danh sách để đổi; còn lại lọc theo chữ đang gõ.
  const shown = chosen && key(chosen.name) === needle ? options : options.filter(option => !needle || key(option.name).includes(needle));

  useLayoutEffect(() => {
    if (!open || !input.current) return undefined;
    const place = () => {
      const rect = input.current.getBoundingClientRect();
      // Mở ngược lên trên khi phía dưới không đủ chỗ cho danh sách (tối đa 280px).
      const below = window.innerHeight - rect.bottom >= 290 || rect.top < 290;
      setBox({ left: rect.left, width: Math.max(rect.width, 280),
        ...(below ? { top: rect.bottom + 4 } : { bottom: window.innerHeight - rect.top + 4 }) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open]);

  const type = text => {
    const match = options.find(option => key(option.name) === key(text));
    onChange({ name: text, inventoryItemId: match ? String(match.id) : '' });
    setActive(0);
    setOpen(true);
  };
  const pick = option => {
    onChange({ name: option.name, inventoryItemId: String(option.id) });
    setOpen(false);
  };
  const keyDown = event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActive(index => Math.min(index + 1, shown.length - 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(index => Math.max(index - 1, 0)); }
    else if (event.key === 'Enter' && open && shown[active]) { event.preventDefault(); pick(shown[active]); }
    else if (event.key === 'Escape') setOpen(false);
  };

  return <div className={styles.picker}>
    <input ref={input} role="combobox" aria-label={label} aria-expanded={open} aria-autocomplete="list" autoComplete="off"
      className={`farmshift-form-control ${styles.input} ${invalid ? styles.invalid : ''}`} value={value} placeholder={placeholder}
      maxLength={200} disabled={disabled} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={keyDown}
      onChange={event => type(event.target.value)} />
    <ChevronDown size={16} className={styles.caret} aria-hidden="true" />
    {open && box && options.length > 0 && <ul role="listbox" aria-label={`Gợi ý ${label}`} className={styles.list}
      style={box}>
      {shown.length === 0 ? <li className={styles.empty}>Không có trong kho, vẫn lưu được tên vừa gõ.</li>
        : shown.map((option, index) => <li key={option.id} role="option" aria-selected={String(option.id) === String(itemId)}
          className={`${styles.option} ${index === active ? styles.active : ''}`}
          onMouseDown={event => { event.preventDefault(); pick(option); }} onMouseEnter={() => setActive(index)}>
          <span>{option.name}</span>{option.unitName && <small>{option.unitName}</small>}
        </li>)}
    </ul>}
  </div>;
}
