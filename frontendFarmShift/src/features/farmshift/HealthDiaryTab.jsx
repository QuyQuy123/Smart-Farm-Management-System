// src/features/farmshift/HealthDiaryTab.jsx
// Nhật ký Sức khỏe đàn gà, Cân mẫu, Tỷ lệ hao hụt & Phác đồ điều trị
import { CheckCircle, Camera } from 'lucide-react';

export const HealthDiaryTab = ({
  healthRows,
  handleHealthChange,
  showToast,
  treatmentFilter,
  setTreatmentFilter,
  filteredTasks,
  isTreatmentMode = false
}) => {
  if (isTreatmentMode) {
    return (
      <div>
        {/* Subfilter buttons */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {['ALL', 'Vaxin & Thuốc', 'Xử lý môi trường'].map(grp => (
            <button
              key={grp}
              type="button"
              className={`farmshift-btn ${treatmentFilter === grp ? 'farmshift-btn-primary' : 'farmshift-btn-secondary'}`}
              style={{ fontSize: '14.5px', padding: '6px 14px' }}
              onClick={() => setTreatmentFilter(grp)}
            >
              {grp === 'ALL' ? 'Mặc định (Tất cả)' : grp}
            </button>
          ))}
        </div>

        <div className="farmshift-card">
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th>Nhóm công việc</th>
                  <th>Nơi xử lý (Chuồng)</th>
                  <th>Mô tả công việc thực hiện</th>
                  <th>Thuốc / Hóa chất sử dụng</th>
                  <th>Thời gian thực hiện</th>
                  <th>Người phụ trách</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map(task => (
                  <tr key={task.id}>
                    <td>
                      <span className={`farmshift-badge ${task.group === 'Vaxin & Thuốc' ? 'farmshift-badge-warning' : 'farmshift-badge-neutral'}`}>
                        {task.group}
                      </span>
                    </td>
                    <td><strong>{task.barn}</strong></td>
                    <td>
                      <strong style={{ color: 'var(--color-ink)' }}>{task.description}</strong>
                    </td>
                    <td>
                      <span style={{ fontSize: '14.5px', color: 'var(--color-primary)' }}>
                        {task.medicine}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '13.5px', color: 'var(--color-muted)' }}>
                        {task.timeStart}
                      </div>
                    </td>
                    <td>{task.person}</td>
                    <td>
                      <span className={`farmshift-badge ${task.status === 'Đã hoàn thành' ? 'farmshift-badge-success' : 'farmshift-badge-neutral'}`}>
                        {task.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <span style={{ fontSize: '14.5px', color: 'var(--color-muted)' }}>
          Theo dõi cân nặng bình quân, hao hụt (con chết) và nhật ký hình ảnh bệnh tích
        </span>
        <button
          type="button"
          className="farmshift-btn farmshift-btn-primary"
          style={{ fontSize: '14px', padding: '6px 14px' }}
          onClick={() => showToast('MSG03')}
        >
          <CheckCircle size={14} /> Lưu thay đổi
        </button>
      </div>

      {['Khu Mía Thịt', 'Khu J Thịt'].map(areaName => (
        <div key={areaName} className="farmshift-card" style={{ marginBottom: '20px' }}>
          <div className="farmshift-card-header" style={{ backgroundColor: 'var(--color-canvas)' }}>
            <h3 className="farmshift-card-title">{areaName}</h3>
            <span className="farmshift-badge farmshift-badge-neutral">
              Hao hụt khu: {healthRows.filter(r => r.area === areaName).reduce((a, b) => a + b.cullCount, 0)} con
            </span>
          </div>
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>Chuồng nuôi</th>
                  <th style={{ width: '110px' }}>Ngày nuôi</th>
                  <th>Cân nặng TB (kg)</th>
                  <th>Hao hụt (con)</th>
                  <th>Ảnh vật nuôi & Mổ khám</th>
                  <th>Ghi chú bệnh tích / Biểu hiện</th>
                </tr>
              </thead>
              <tbody>
                {healthRows.map((row, idx) => {
                  if (row.area !== areaName) return null;
                  return (
                    <tr key={row.barn}>
                      <td><strong>{row.barn}</strong></td>
                      <td>
                        <span className="farmshift-badge farmshift-badge-neutral">Ngày {row.dayAge}</span>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          className="farmshift-form-control"
                          style={{ width: '90px', padding: '4px 8px', height: '34px' }}
                          value={row.avgWeight}
                          onChange={(e) => handleHealthChange(idx, 'avgWeight', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="farmshift-form-control"
                          style={{ width: '80px', padding: '4px 8px', height: '34px', color: row.cullCount > 2 ? 'var(--color-signature-coral)' : 'inherit' }}
                          value={row.cullCount}
                          onChange={(e) => handleHealthChange(idx, 'cullCount', e.target.value)}
                        />
                      </td>
                      <td>
                        <label
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '5px 10px',
                            border: '1px solid var(--color-hairline)',
                            borderRadius: 'var(--rounded-sm)',
                            fontSize: '13.5px',
                            cursor: 'pointer',
                            backgroundColor: 'var(--color-canvas)',
                            color: 'var(--color-ink)'
                          }}
                        >
                          <Camera size={14} />
                          {row.photo ? '1 ảnh đã đính kèm' : 'Chọn ảnh...'}
                          <input type="file" style={{ display: 'none' }} onChange={() => showToast('Đã đính kèm ảnh chụp bệnh tích mổ khám!', 'success')} />
                        </label>
                      </td>
                      <td>
                        <input
                          type="text"
                          className="farmshift-form-control"
                          style={{ height: '34px', fontSize: '14.5px' }}
                          value={row.notes}
                          onChange={(e) => handleHealthChange(idx, 'notes', e.target.value)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};
