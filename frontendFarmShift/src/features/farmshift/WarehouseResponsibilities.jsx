import { useEffect, useState } from 'react';
import { Users, Warehouse } from 'lucide-react';
import { getWarehouseResponsibilities } from '../../services/warehouseResponsibilityService';
import { apiErrorMessage, filterWarehouses } from './farmAreaOptions';
import { AreaWarehouseFilter, KindTag } from './AreaWarehouseFilter';
import styles from './BarnResponsibilities.module.css';

export function WarehouseResponsibilities({ canEdit }) {
  const [state, setState] = useState({ data: null, error: '', loading: true });
  const [revision, setRevision] = useState(0);
  const [filter, setFilter] = useState({ area: '', kind: '' });

  useEffect(() => {
    if (!canEdit) return;
    let cancelled = false;
    getWarehouseResponsibilities().then(data => { if (!cancelled) setState({ data, error: '', loading: false }); })
      .catch(error => { if (!cancelled) setState({ data: null, error: apiErrorMessage(error), loading: false }); });
    return () => { cancelled = true; };
  }, [canEdit, revision]);

  const retry = () => { setState(current => ({ ...current, loading: true })); setRevision(current => current + 1); };

  if (!canEdit) return <div className="farmshift-card farmshift-card-body">Chỉ chủ trang trại có quyền quản lý phân công kho.</div>;
  const { data, error, loading } = state;
  const shown = data?.warehouses ? filterWarehouses(data.warehouses, filter) : [];

  return <section className="farmshift-card">
    <header className={`farmshift-card-header ${styles.header}`}>
      <div>
        <h3 className="farmshift-card-title">Liên kết Kho hàng – Công nhân (Tự động theo Khu nuôi)</h3>
        <p>Công nhân được phân công theo Khu nuôi &amp; Chuồng nuôi tự động có quyền lấy cám và thuốc từ Kho liên kết của Khu đó. Không cần phân công thủ công theo kho.</p>
      </div>
      <span className={styles.summary}><Users size={16} />{data?.workers?.length || 0} công nhân đang hoạt động</span>
    </header>
    {loading ? <p role="status" className={styles.empty}>Đang tải danh sách kho...</p>
      : error ? <div className={styles.empty}><p role="alert" className={styles.error}>{error}</p><button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={retry}>Thử lại</button></div>
      : !data?.warehouses?.length ? <p className={styles.empty}>Chưa có kho hàng. Thêm kho tại Thiết lập danh mục trước khi phân công.</p>
      : <><AreaWarehouseFilter warehouses={data.warehouses} value={filter} onChange={setFilter} />
      {shown.length === 0 ? <p className={styles.empty}>Không có kho nào khớp bộ lọc.</p>
      : <div className="farmshift-table-container" style={{ border: 'none' }}><table className="farmshift-table">
        <thead><tr><th>Tên kho hàng</th><th>Khu</th><th>Loại</th><th>Công nhân phụ trách (Tự động liên kết)</th></tr></thead>
        <tbody>{shown.map(warehouse => <tr key={warehouse.id}>
          <th scope="row"><span className={styles.summary}><Warehouse size={17} />{warehouse.name}</span></th>
          <td>{warehouse.areaName || '—'}</td>
          <td><KindTag kind={warehouse.kind} /></td>
          <td><div className={styles.assignment}>
            <div className={styles.people}>
              {warehouse.workers && warehouse.workers.length > 0 ? warehouse.workers.map(worker => <span key={worker.id} className={styles.person}>
                <span className={styles.avatar} aria-hidden="true">{worker.fullName.trim().split(/\s+/).pop().slice(0, 1)}</span>{worker.fullName}
              </span>) : <span className={styles.empty} style={{ padding: 0 }}>Tự động kế thừa khi gán công nhân vào Khu nuôi / Chuồng</span>}
            </div>
          </div></td>
        </tr>)}</tbody>
      </table></div>}</>}
  </section>;
}
