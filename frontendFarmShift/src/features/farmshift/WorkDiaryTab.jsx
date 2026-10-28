// src/features/farmshift/WorkDiaryTab.jsx
// Nhật ký Công việc & Phân công nhiệm vụ trang trại hàng ngày
import { Plus, ClipboardCheck } from 'lucide-react';

export const WorkDiaryTab = ({
  workTasks,
  setWorkTasks,
  setShowWorkModal
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Action Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <span style={{ fontSize: '15px', color: 'var(--color-muted)' }}>
            Nhật ký theo dõi công việc hàng ngày: Dọn chuồng, phun sát trùng, thay trấu đệm lót, cân mẫu và bảo trì thiết bị
          </span>
        </div>
        <button
          type="button"
          className="farmshift-btn farmshift-btn-primary"
          style={{ fontSize: '14px', padding: '6px 14px' }}
          onClick={() => setShowWorkModal(true)}
        >
          <Plus size={14} /> Giao việc mới hôm nay
        </button>
      </div>

      {/* Work Tasks Table */}
      <div className="farmshift-card" style={{ margin: 0 }}>
        <div className="farmshift-card-header">
          <h3 className="farmshift-card-title">
            <ClipboardCheck size={18} color="var(--color-primary)" />
            Danh sách công việc & phân công hôm nay
          </h3>
          <span className="farmshift-badge farmshift-badge-neutral">
            {workTasks.filter(t => t.status === 'Đã hoàn thành').length}/{workTasks.length} việc đã xong
          </span>
        </div>
        <div className="farmshift-table-container" style={{ border: 'none' }}>
          <table className="farmshift-table">
            <thead>
              <tr>
                <th style={{ width: '90px' }}>Giờ</th>
                <th>Tên công việc</th>
                <th>Chuồng / Khu vực</th>
                <th>Người thực hiện</th>
                <th>Định kỳ / Ưu tiên</th>
                <th>Trạng thái</th>
                <th>Ghi chú thực hiện</th>
                <th style={{ textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {workTasks.map(task => (
                <tr key={task.id}>
                  <td>
                    <strong style={{ color: 'var(--color-primary)', fontFamily: 'monospace' }}>
                      {task.time}
                    </strong>
                  </td>
                  <td>
                    <strong style={{ color: 'var(--color-ink)' }}>{task.taskName}</strong>
                  </td>
                  <td>
                    <strong>{task.barn}</strong>
                    <div style={{ fontSize: '13.5px', color: 'var(--color-muted)' }}>{task.area}</div>
                  </td>
                  <td>
                    <span style={{ fontWeight: 500 }}>{task.assignee}</span>
                  </td>
                  <td>
                    <span className="farmshift-badge farmshift-badge-neutral" style={{ fontSize: '13px' }}>
                      {task.priority}
                    </span>
                  </td>
                  <td>
                    <span className={`farmshift-badge ${task.status === 'Đã hoàn thành' ? 'farmshift-badge-success' : task.status === 'Đang thực hiện' ? 'farmshift-badge-warning' : 'farmshift-badge-neutral'}`}>
                      {task.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '14.5px', color: 'var(--color-muted)' }}>
                    {task.notes}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {task.status !== 'Đã hoàn thành' ? (
                      <button
                        type="button"
                        className="farmshift-btn farmshift-btn-primary"
                        style={{ fontSize: '13px', padding: '3px 8px' }}
                        onClick={() => {
                          setWorkTasks(workTasks.map(t => t.id === task.id ? { ...t, status: 'Đã hoàn thành' } : t));
                        }}
                      >
                        ✓ Hoàn thành
                      </button>
                    ) : (
                      <span style={{ fontSize: '13.5px', color: 'var(--color-success)', fontWeight: 600 }}>
                        ✓ Đã xong
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
