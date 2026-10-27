// src/features/farmshift/FeedDiaryTab.jsx
// Nhật ký Cữ ăn & Quản lý thức ăn từng chuồng nuôi
import { Plus } from 'lucide-react';

export const FeedDiaryTab = ({
  feedRows,
  showFeedMeal3,
  setShowFeedMeal3,
  handleMealChange,
  showToast
}) => {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <span style={{ fontSize: '14.5px', color: 'var(--color-muted)' }}>
          Nhập số lượng cám cho ăn thực tế từng cữ theo từng khu và chuồng nuôi
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="farmshift-btn farmshift-btn-secondary"
            style={{ fontSize: '14px', padding: '6px 12px' }}
            onClick={() => setShowFeedMeal3(!showFeedMeal3)}
          >
            <Plus size={14} /> {showFeedMeal3 ? 'Ẩn Cữ 3' : 'Thêm 1 cữ ăn (Cữ 3)'}
          </button>
        </div>
      </div>

      {['Khu Mía Thịt', 'Khu J Thịt'].map(areaName => (
        <div key={areaName} className="farmshift-card" style={{ marginBottom: '20px' }}>
          <div className="farmshift-card-header" style={{ backgroundColor: 'var(--color-canvas)' }}>
            <h3 className="farmshift-card-title">{areaName}</h3>
            <span className="farmshift-badge farmshift-badge-neutral">
              Tổng ăn khu: {feedRows.filter(r => r.area === areaName).reduce((a, b) => a + b.meal1 + b.meal2 + (showFeedMeal3 ? b.meal3 : 0), 0)} Kg
            </span>
          </div>
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th style={{ width: '120px' }}>Chuồng nuôi</th>
                  <th style={{ width: '110px' }}>Ngày nuôi</th>
                  <th style={{ width: '180px' }}>Loại thức ăn (Kho)</th>
                  <th>Cữ 1 (Sáng - Kg)</th>
                  <th>Cữ 2 (Chiều - Kg)</th>
                  {showFeedMeal3 && <th>Cữ 3 (Tối - Kg)</th>}
                  <th>Tổng cữ ăn (Kg)</th>
                  <th style={{ textAlign: 'right' }}>Tác vụ trừ kho</th>
                </tr>
              </thead>
              <tbody>
                {feedRows.map((row, idx) => {
                  if (row.area !== areaName) return null;
                  const totalMeal = row.meal1 + row.meal2 + (showFeedMeal3 ? row.meal3 : 0);
                  return (
                    <tr key={row.barn}>
                      <td><strong>{row.barn}</strong></td>
                      <td>
                        <span className="farmshift-badge farmshift-badge-neutral">Ngày {row.dayAge}</span>
                      </td>
                      <td style={{ fontSize: '14.5px', color: 'var(--color-ink)' }}>{row.feedType}</td>
                      <td>
                        <input
                          type="number"
                          className="farmshift-form-control"
                          style={{ width: '90px', padding: '6px 10px', height: '36px' }}
                          value={row.meal1}
                          onChange={(e) => handleMealChange(idx, 'meal1', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="farmshift-form-control"
                          style={{ width: '90px', padding: '6px 10px', height: '36px' }}
                          value={row.meal2}
                          onChange={(e) => handleMealChange(idx, 'meal2', e.target.value)}
                        />
                      </td>
                      {showFeedMeal3 && (
                        <td>
                          <input
                            type="number"
                            className="farmshift-form-control"
                            style={{ width: '90px', padding: '6px 10px', height: '36px' }}
                            value={row.meal3}
                            onChange={(e) => handleMealChange(idx, 'meal3', e.target.value)}
                          />
                        </td>
                      )}
                      <td>
                        <strong style={{ fontSize: '15px', color: 'var(--color-primary)' }}>
                          {totalMeal} Kg
                        </strong>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="farmshift-btn farmshift-btn-primary"
                          style={{ fontSize: '13.5px', padding: '5px 12px' }}
                          onClick={() => showToast(`Đã ghi nhận cho ăn ${totalMeal}kg ${row.feedType} tại ${row.barn} và tự động trừ tồn kho!`, 'success')}
                        >
                          Cho ăn ({totalMeal} Kg)
                        </button>
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
