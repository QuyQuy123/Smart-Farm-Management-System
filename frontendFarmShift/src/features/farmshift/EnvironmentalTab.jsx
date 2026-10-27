// src/features/farmshift/EnvironmentalTab.jsx
// Nhật ký Giám sát Vi khí hậu Môi trường IoT (Nhiệt độ, Độ ẩm, Camera & Quạt)
import {
  Fan, CheckCircle, Thermometer, Droplets,
  Lightbulb, Sliders, Video
} from 'lucide-react';

export const EnvironmentalTab = ({
  envRows,
  barnDevices,
  handleEnvChange,
  setSelectedIotBarnFilter,
  setActiveTab,
  setViewingCctvBarn,
  showToast
}) => {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
        <span style={{ fontSize: '14.5px', color: 'var(--color-muted)' }}>
          Đồng bộ dữ liệu cảm biến IoT tự động (Nhiệt độ & Độ ẩm) cho phép theo dõi và hiệu chỉnh vi khí hậu chuồng nuôi
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="farmshift-btn farmshift-btn-secondary"
            style={{ fontSize: '14px', padding: '6px 14px' }}
            onClick={() => setActiveTab('iot_devices')}
          >
            <Fan size={14} /> Chuyển đến Điều khiển Quạt IoT →
          </button>
          <button
            type="button"
            className="farmshift-btn farmshift-btn-primary"
            style={{ fontSize: '14px', padding: '6px 14px' }}
            onClick={() => showToast('MSG03')}
          >
            <CheckCircle size={14} /> Lưu thay đổi
          </button>
        </div>
      </div>

      {['Khu Mía Thịt', 'Khu J Thịt'].map(areaName => (
        <div key={areaName} className="farmshift-card" style={{ marginBottom: '20px' }}>
          <div className="farmshift-card-header" style={{ backgroundColor: 'var(--color-canvas)' }}>
            <h3 className="farmshift-card-title">{areaName}</h3>
            <span className="farmshift-badge farmshift-badge-success">Cảm biến trực tuyến</span>
          </div>
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>Chuồng nuôi</th>
                  <th style={{ width: '110px' }}>Ngày nuôi</th>
                  <th style={{ width: '160px' }}>Nhiệt độ (°C)</th>
                  <th style={{ width: '160px' }}>Độ ẩm (%)</th>
                  <th>Trạng thái vi khí hậu</th>
                  <th style={{ width: '220px' }}>Quạt & Thiết bị IoT</th>
                </tr>
              </thead>
              <tbody>
                {envRows.map((row, idx) => {
                  if (row.area !== areaName) return null;
                  const device = barnDevices[row.barn] || { mode: 'auto', fan: { on: true, speed: 2 }, light: { on: true } };

                  return (
                    <tr key={row.barn}>
                      <td><strong>{row.barn}</strong></td>
                      <td>
                        <span className="farmshift-badge farmshift-badge-neutral">Ngày {row.dayAge}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Thermometer size={15} color="var(--color-info)" />
                          <input
                            type="number"
                            step="0.1"
                            className="farmshift-form-control"
                            style={{ width: '75px', padding: '4px 8px', height: '34px' }}
                            value={row.temp}
                            onChange={(e) => handleEnvChange(idx, 'temp', e.target.value)}
                          />
                          <span>°C</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Droplets size={15} color="#0284c7" />
                          <input
                            type="number"
                            className="farmshift-form-control"
                            style={{ width: '75px', padding: '4px 8px', height: '34px' }}
                            value={row.humidity}
                            onChange={(e) => handleEnvChange(idx, 'humidity', e.target.value)}
                          />
                          <span>%</span>
                        </div>
                      </td>
                      <td>
                        <span className="farmshift-badge farmshift-badge-success">{row.status}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13.5px' }}>
                            <Fan
                              size={15}
                              color={device.fan?.on ? '#019788' : '#94a3b8'}
                              className={device.fan?.on ? (device.fan?.speed === 3 ? 'farmshift-fan-spinning-3' : device.fan?.speed === 2 ? 'farmshift-fan-spinning-2' : 'farmshift-fan-spinning-1') : ''}
                            />
                            <span style={{ fontWeight: 500, color: device.fan?.on ? 'var(--color-primary)' : 'var(--color-muted)' }}>
                              {device.fan?.on ? `Quạt (Cấp ${device.fan?.speed})` : 'Quạt tắt'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13.5px' }}>
                            <Lightbulb
                              size={15}
                              color={device.light?.on ? '#f59e0b' : '#94a3b8'}
                            />
                            <span style={{ fontWeight: 500, color: device.light?.on ? '#f59e0b' : 'var(--color-muted)' }}>
                              {device.light?.on ? 'Đèn bật' : 'Đèn tắt'}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="farmshift-btn farmshift-btn-secondary"
                            style={{ fontSize: '13px', padding: '3px 8px', height: '26px' }}
                            onClick={() => { setSelectedIotBarnFilter(row.barn); setActiveTab('iot_devices'); }}
                            title="Mở bảng điều khiển quạt và đèn chuồng này"
                          >
                            <Sliders size={12} /> Chỉnh thiết bị
                          </button>
                          <button
                            type="button"
                            className="farmshift-btn farmshift-btn-secondary"
                            style={{ fontSize: '13px', padding: '3px 8px', height: '26px', display: 'flex', alignItems: 'center', gap: '3px' }}
                            onClick={() => setViewingCctvBarn({
                              name: row.barn,
                              areaName: row.area,
                              livestockType: 'Gia cầm (Gà thịt)',
                              temp: row.temp,
                              humidity: row.humidity,
                              fan: device.fan,
                              light: device.light,
                              current: 2400
                            })}
                            title="Xem camera trực tiếp chuồng này"
                          >
                            <Video size={12} color="#019788" /> Cam
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Banner liên kết sang điều khiển quạt IoT */}
      <div className="farmshift-card" style={{ marginTop: '16px', padding: '16px 20px', backgroundColor: 'var(--color-surface-soft)', border: '1px solid var(--color-hairline)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#019788', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <Fan size={22} className="farmshift-fan-spinning-2" />
            </div>
            <div>
              <strong style={{ fontSize: '14.5px', color: 'var(--color-ink)' }}>Trung tâm điều khiển Quạt thông gió & Giàn mát IoT</strong>
              <div style={{ fontSize: '14.5px', color: 'var(--color-muted)', marginTop: '2px' }}>
                Dữ liệu cảm biến nhiệt độ và độ ẩm được kết nối trực tiếp với cụm quạt hút. Bạn có thể bật/tắt thủ công hoặc cài đặt tự động kích hoạt.
              </div>
            </div>
          </div>
          <button
            type="button"
            className="farmshift-btn farmshift-btn-primary"
            style={{ fontSize: '14.5px', padding: '8px 16px' }}
            onClick={() => setActiveTab('iot_devices')}
          >
            <Sliders size={14} /> Chuyển sang Điều khiển Quạt IoT →
          </button>
        </div>
      </div>
    </div>
  );
};
