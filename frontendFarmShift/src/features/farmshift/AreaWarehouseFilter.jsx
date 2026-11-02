import { WAREHOUSE_KINDS, kindLabel, warehouseAreas } from './farmAreaOptions';
import styles from './AreaWarehouseFilter.module.css';

/**
 * Bộ lọc kho theo khu và loại kho (mỗi khu một kho cám, một kho thuốc). value = { area, kind }.
 * Dùng chung cho danh mục kho, phân công kho và kho hàng hóa.
 */
export function AreaWarehouseFilter({ warehouses, value, onChange }) {
  const areas = warehouseAreas(warehouses);
  return <div className={styles.filter} role="group" aria-label="Lọc kho">
    <label>Khu
      <select className="farmshift-select" value={value.area} onChange={event => onChange({ ...value, area: event.target.value })}>
        <option value="">Tất cả khu</option>
        {areas.map(([id, name]) => <option key={id} value={String(id)}>{name}</option>)}
      </select>
    </label>
    <div className={styles.kinds} role="radiogroup" aria-label="Loại kho">
      {[{ value: '', label: 'Tất cả' }, ...WAREHOUSE_KINDS].map(kind => <button key={kind.value} type="button" role="radio"
        aria-checked={value.kind === kind.value} className={value.kind === kind.value ? styles.active : ''}
        onClick={() => onChange({ ...value, kind: kind.value })}>{kind.label}</button>)}
    </div>
  </div>;
}

/** Nhãn loại kho (Kho cám / Kho thuốc) có màu. */
export function KindTag({ kind }) {
  return kind ? <span className={`${styles.kindTag} ${styles[`kind_${kind}`] || ''}`}>{kindLabel(kind)}</span> : null;
}
