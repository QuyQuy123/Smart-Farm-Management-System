// src/features/farmshift/IotDevicesTab.jsx
// Trung tâm Điều khiển Quạt hút thông gió, Đèn chiếu sáng và Thiết bị IoT chuồng trại
import {
  Check, Zap, Lightbulb, Cpu, Power,
  Thermometer, Droplets, Fan, Video, TrendingUp,
  Bell, Sliders
} from 'lucide-react';
import { StockTempChart } from '../../components/StockTempChart';

export const IotDevicesTab = ({
  iotToast,
  selectedIotBarnFilter,
  setSelectedIotBarnFilter,
  barnDevices,
  envRows,
  barnHistories,
  activeChartBarns,
  setActiveChartBarns,
  handleTurnAllFans,
  handleTurnAllLights,
  handleSetAllAuto,
  handleTurnOffAll,
  handleToggleMode,
  handleLiveClimateUpdate,
  handleToggleFan,
  handleSetFanSpeed,
  handleToggleLight,
  handleSetThreshold,
  handleTriggerTestAlert,
  setViewingCctvBarn
}) => {
  return (
    <div>
      {/* Header & Master Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-ink)', margin: '0 0 4px' }}>
            Quản lý thiết bị IoT & Điều khiển Quạt - Đèn
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--color-muted)', margin: 0 }}>
            Hệ thống chuồng chuẩn: 01 Quạt thông gió + 01 Hệ thống Đèn chiếu sáng. Điều khiển tự động theo cảm biến hoặc thủ công.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="farmshift-btn farmshift-btn-primary"
            style={{ fontSize: '12.5px', padding: '6px 14px' }}
            onClick={() => handleTurnAllFans(true)}
          >
            <Zap size={14} /> Bật toàn bộ quạt
          </button>
          <button
            type="button"
            className="farmshift-btn farmshift-btn-secondary"
            style={{ fontSize: '12.5px', padding: '6px 14px' }}
            onClick={() => handleTurnAllLights(true)}
          >
            <Lightbulb size={14} color="#f59e0b" /> Bật toàn bộ đèn
          </button>
          <button
            type="button"
            className="farmshift-btn farmshift-btn-secondary"
            style={{ fontSize: '12.5px', padding: '6px 14px' }}
            onClick={handleSetAllAuto}
          >
            <Cpu size={14} /> Chuyển tất cả sang Auto
          </button>
          <button
            type="button"
            className="farmshift-btn farmshift-btn-secondary"
            style={{ fontSize: '12.5px', padding: '6px 14px' }}
            onClick={handleTurnOffAll}
          >
            <Power size={14} /> Tắt tất cả thiết bị
          </button>
        </div>
      </div>

      {/* Dynamic Overview Metrics from envRows */}
      {(() => {
        const avgCampTemp = (envRows.reduce((acc, r) => acc + Number(r.temp), 0) / (envRows.length || 1)).toFixed(1);
        const avgCampHumidity = Math.round(envRows.reduce((acc, r) => acc + Number(r.humidity), 0) / (envRows.length || 1));
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <div className="farmshift-card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12.5px', color: 'var(--color-muted)', fontWeight: 500 }}>Nhiệt độ TB toàn trại</span>
                <Thermometer size={16} color="var(--color-info)" />
              </div>
              <div style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-ink)', marginTop: '8px' }}>
                {avgCampTemp}°C
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--color-success)', marginTop: '4px' }}>
                ● 5/5 cảm biến trực tuyến (Live Sync)
              </div>
            </div>

            <div className="farmshift-card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12.5px', color: 'var(--color-muted)', fontWeight: 500 }}>Độ ẩm TB toàn trại</span>
                <Droplets size={16} color="#0284c7" />
              </div>
              <div style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-ink)', marginTop: '8px' }}>
                {avgCampHumidity}%
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--color-muted)', marginTop: '4px' }}>
                Chuẩn sinh thái gà thịt
              </div>
            </div>

            <div className="farmshift-card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12.5px', color: 'var(--color-muted)', fontWeight: 500 }}>Quạt đang quay</span>
                <Fan size={16} color="var(--color-primary)" className="farmshift-fan-spinning-2" />
              </div>
              <div style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-ink)', marginTop: '8px' }}>
                {Object.values(barnDevices).reduce((acc, b) => acc + (b.fan?.on ? 1 : 0), 0)} / 5 quạt
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--color-success)', marginTop: '4px' }}>
                Đang duy trì thông thoáng
              </div>
            </div>

            <div className="farmshift-card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12.5px', color: 'var(--color-muted)', fontWeight: 500 }}>Đèn chuồng đang sáng</span>
                <Lightbulb size={16} color="#f59e0b" />
              </div>
              <div style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-ink)', marginTop: '8px' }}>
                {Object.values(barnDevices).reduce((acc, b) => acc + (b.light?.on ? 1 : 0), 0)} / 5 chuồng
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--color-muted)', marginTop: '4px' }}>
                {Object.values(barnDevices).reduce((acc, b) => acc + (b.light?.on ? 0.3 : 0), 0).toFixed(1)} kW điện chiếu sáng
              </div>
            </div>
          </div>
        );
      })()}

      {/* Barn Filter Pills */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
        {['ALL', 'Nhà A1', 'Nhà A2', 'Nhà A3', 'Nhà B1', 'Nhà B2'].map(name => (
          <button
            key={name}
            type="button"
            className={`farmshift-btn ${selectedIotBarnFilter === name ? 'farmshift-btn-primary' : 'farmshift-btn-secondary'}`}
            style={{ fontSize: '12.5px', padding: '5px 14px', borderRadius: 'var(--rounded-full)' }}
            onClick={() => setSelectedIotBarnFilter(name)}
          >
            {name === 'ALL' ? 'Tất cả chuồng (5)' : name}
          </button>
        ))}
      </div>

      {/* Barn IoT Cards Grid */}
      <div className="farmshift-iot-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '20px' }}>
        {Object.entries(barnDevices).map(([barnName, b]) => {
          if (selectedIotBarnFilter !== 'ALL' && selectedIotBarnFilter !== barnName) return null;
          const envData = envRows.find(r => r.barn === barnName) || { temp: 29.5, humidity: 68 };

          return (
            <div key={barnName} className="farmshift-card" style={{ padding: '20px' }}>
              {/* Card Header (2 clear rows: Title & Mode in row 1, Sensors & Camera in row 2) */}
              <div style={{ paddingBottom: '14px', borderBottom: '1px solid var(--color-hairline)', marginBottom: '16px' }}>
                {/* Row 1: Title, Area & Mode Switch */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--color-ink)' }}>{barnName}</h4>
                    <span className="farmshift-badge farmshift-badge-neutral">{b.area}</span>
                    <span style={{ fontSize: '11.5px', color: 'var(--color-muted)', backgroundColor: 'var(--color-surface-soft)', padding: '2px 8px', borderRadius: '4px' }}>
                      {b.stage}
                    </span>
                  </div>

                  {/* Mode Toggle */}
                  <div style={{ display: 'flex', backgroundColor: 'var(--color-surface-soft)', padding: '3px', borderRadius: 'var(--rounded-sm)', border: '1px solid var(--color-hairline)', flexShrink: 0 }}>
                    <button
                      type="button"
                      style={{
                        border: 'none',
                        padding: '3px 9px',
                        fontSize: '11.5px',
                        fontWeight: 500,
                        borderRadius: '4px',
                        cursor: 'pointer',
                        backgroundColor: b.mode === 'auto' ? '#019788' : 'transparent',
                        color: b.mode === 'auto' ? '#ffffff' : 'var(--color-muted)',
                        transition: 'all 0.15s ease'
                      }}
                      onClick={() => handleToggleMode(barnName, 'auto')}
                    >
                      Auto
                    </button>
                    <button
                      type="button"
                      style={{
                        border: 'none',
                        padding: '3px 9px',
                        fontSize: '11.5px',
                        fontWeight: 500,
                        borderRadius: '4px',
                        cursor: 'pointer',
                        backgroundColor: b.mode === 'manual' ? '#0f172a' : 'transparent',
                        color: b.mode === 'manual' ? '#ffffff' : 'var(--color-muted)',
                        transition: 'all 0.15s ease'
                      }}
                      onClick={() => handleToggleMode(barnName, 'manual')}
                    >
                      Thủ công
                    </button>
                  </div>
                </div>

                {/* Row 2: Live IoT Sensors & Camera Button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: envData.temp > b.tempThreshold ? '#dc2626' : 'var(--color-info)',
                      backgroundColor: envData.temp > b.tempThreshold ? 'rgba(220, 38, 38, 0.10)' : 'rgba(37, 79, 173, 0.08)',
                      padding: '3px 9px',
                      borderRadius: '4px',
                      border: envData.temp > b.tempThreshold ? '1px solid rgba(220, 38, 38, 0.3)' : '1px solid transparent',
                      transition: 'all 0.25s ease'
                    }}>
                      <Thermometer size={14} /> {envData.temp}°C
                      {envData.temp > b.tempThreshold && (
                        <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: 700, marginLeft: '2px' }}>
                          🔥 Cao
                        </span>
                      )}
                    </span>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#0284c7',
                      backgroundColor: 'rgba(2, 132, 199, 0.08)',
                      padding: '3px 9px',
                      borderRadius: '4px'
                    }}>
                      <Droplets size={14} /> {envData.humidity}%
                    </span>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '11px',
                      color: '#10b981',
                      fontWeight: 600,
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      padding: '2px 8px',
                      borderRadius: '12px'
                    }}>
                      <span style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: '#10b981',
                        boxShadow: '0 0 6px #10b981'
                      }} />
                      Live 1.6s
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      className="farmshift-btn farmshift-btn-secondary"
                      style={{ fontSize: '11.5px', padding: '3px 10px', height: '26px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      onClick={() => setViewingCctvBarn({
                        name: barnName,
                        areaName: b.area,
                        livestockType: 'Gia cầm (Gà thịt)',
                        temp: envData.temp,
                        humidity: envData.humidity,
                        fan: b.fan,
                        light: b.light,
                        current: 2400
                      })}
                      title="Xem camera trực tiếp chuồng này"
                    >
                      <Video size={13} color="#019788" /> 📹 Xem Camera
                    </button>

                    <button
                      type="button"
                      className={`farmshift-btn ${(activeChartBarns[barnName] ?? (selectedIotBarnFilter === barnName)) ? 'farmshift-btn-primary' : 'farmshift-btn-secondary'}`}
                      style={{
                        fontSize: '11.5px',
                        padding: '3px 10px',
                        height: '26px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        backgroundColor: (activeChartBarns[barnName] ?? (selectedIotBarnFilter === barnName)) ? '#0f172a' : undefined,
                        color: (activeChartBarns[barnName] ?? (selectedIotBarnFilter === barnName)) ? '#38bdf8' : undefined,
                        borderColor: (activeChartBarns[barnName] ?? (selectedIotBarnFilter === barnName)) ? '#38bdf8' : undefined
                      }}
                      onClick={() => setActiveChartBarns(prev => ({
                        ...prev,
                        [barnName]: !(prev[barnName] ?? (selectedIotBarnFilter === barnName))
                      }))}
                      title="Bật / Tắt biểu đồ nhiệt độ biến động dạng bảng chứng khoán"
                    >
                      <TrendingUp size={13} color={(activeChartBarns[barnName] ?? (selectedIotBarnFilter === barnName)) ? '#38bdf8' : '#019788'} />
                      📈 Biểu đồ nhiệt
                    </button>
                  </div>
                </div>
              </div>

              {/* Mode Banner */}
              <div style={{
                padding: '8px 12px',
                borderRadius: 'var(--rounded-sm)',
                fontSize: '12px',
                marginBottom: '16px',
                backgroundColor: b.mode === 'auto' ? (b.fan?.on ? '#fef2f2' : '#f0fdfa') : '#f8fafc',
                border: `1px solid ${b.mode === 'auto' ? (b.fan?.on ? '#fecaca' : '#ccfbf1') : '#e2e8f0'}`,
                color: b.mode === 'auto' ? (b.fan?.on ? '#991b1b' : '#0f766e') : '#475569',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.3s ease'
              }}>
                <span>
                  {b.mode === 'auto'
                    ? (b.fan?.on
                        ? `🤖 Auto AI: Nhiệt độ (${envData.temp}°C) > ${b.tempThreshold}°C ➔ Đang kích hoạt Quạt ${b.fan?.rpm} để hạ nhiệt`
                        : `🤖 Auto AI: Nhiệt độ (${envData.temp}°C) ≤ ${b.tempThreshold}°C ➔ Quạt tự ngắt nghỉ an toàn`)
                    : '🖐️ Chế độ thủ công: Bạn toàn quyền bật/tắt & chọn cấp độ gió'}
                </span>
                {b.mode === 'auto' && (
                  <span className={`farmshift-badge ${b.fan?.on ? 'farmshift-badge-danger' : 'farmshift-badge-success'}`} style={{ fontSize: '10.5px' }}>
                    {b.fan?.on ? 'Auto Làm Mát' : 'Auto Ổn Định'}
                  </span>
                )}
              </div>

              {/* 📈 Biểu đồ nhiệt độ & vi khí hậu thời gian thực dạng chứng khoán */}
              {(activeChartBarns[barnName] ?? (selectedIotBarnFilter === barnName)) && (
                <div style={{ marginBottom: '16px' }}>
                  <StockTempChart
                    barnName={barnName}
                    areaName={b.area}
                    currentTemp={envData.temp}
                    currentHumidity={envData.humidity}
                    tempThreshold={b.tempThreshold}
                    fan={b.fan}
                    externalPoints={barnHistories[barnName]}
                    onLiveTempChange={handleLiveClimateUpdate}
                  />
                </div>
              )}

              {/* Devices Grid (Chỉ 1 Quạt + 1 Đèn) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Device 1: Quạt thông gió */}
                <div style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--rounded-md)',
                  border: '1px solid var(--color-hairline)',
                  backgroundColor: b.fan?.on ? '#ffffff' : 'var(--color-surface-soft)',
                  transition: 'all 0.2s ease'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        backgroundColor: b.fan?.on ? 'rgba(1, 151, 136, 0.12)' : '#e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Fan
                          size={20}
                          color={b.fan?.on ? '#019788' : '#64748b'}
                          className={b.fan?.on ? (b.fan?.speed === 3 ? 'farmshift-fan-spinning-3' : b.fan?.speed === 2 ? 'farmshift-fan-spinning-2' : 'farmshift-fan-spinning-1') : ''}
                        />
                      </div>
                      <div>
                        <strong style={{ fontSize: '13.5px', color: 'var(--color-ink)' }}>Quạt thông gió (Quạt hút)</strong>
                        <div style={{ fontSize: '11.5px', color: 'var(--color-muted)', marginTop: '2px' }}>
                          {b.fan?.power} · {b.fan?.on ? b.fan?.rpm : 'Đang dừng'}
                        </div>
                      </div>
                    </div>

                    <label className="farmshift-iot-toggle">
                      <input
                        type="checkbox"
                        checked={b.fan?.on}
                        onChange={() => handleToggleFan(barnName)}
                      />
                      <span className="farmshift-iot-slider"></span>
                    </label>
                  </div>

                  {/* Speed selector */}
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed var(--color-hairline)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>Cấp độ gió:</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {[1, 2, 3].map(speed => (
                        <button
                          key={speed}
                          type="button"
                          style={{
                            border: '1px solid',
                            borderColor: b.fan?.on && b.fan?.speed === speed ? '#019788' : 'var(--color-hairline)',
                            backgroundColor: b.fan?.on && b.fan?.speed === speed ? '#019788' : '#ffffff',
                            color: b.fan?.on && b.fan?.speed === speed ? '#ffffff' : 'var(--color-body)',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 500,
                            cursor: 'pointer'
                          }}
                          onClick={() => handleSetFanSpeed(barnName, speed)}
                        >
                          Số {speed}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Device 2: Đèn chiếu sáng / Đèn sưởi */}
                <div style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--rounded-md)',
                  border: '1px solid var(--color-hairline)',
                  backgroundColor: b.light?.on ? '#ffffff' : 'var(--color-surface-soft)',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      backgroundColor: b.light?.on ? 'rgba(245, 158, 11, 0.15)' : '#e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Lightbulb
                        size={20}
                        color={b.light?.on ? '#f59e0b' : '#64748b'}
                      />
                    </div>
                    <div>
                      <strong style={{ fontSize: '13.5px', color: 'var(--color-ink)' }}>Hệ thống Đèn chiếu sáng</strong>
                      <div style={{ fontSize: '11.5px', color: 'var(--color-muted)', marginTop: '2px' }}>
                        {b.light?.on ? 'Đèn đang sáng · 300W' : 'Đang tắt đèn'}
                      </div>
                    </div>
                  </div>

                  <label className="farmshift-iot-toggle">
                    <input
                      type="checkbox"
                      checked={b.light?.on}
                      onChange={() => handleToggleLight(barnName)}
                    />
                    <span className="farmshift-iot-slider"></span>
                  </label>
                </div>
              </div>

              {/* Auto threshold adjustment & Test Alert Button */}
              <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--color-hairline)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>Ngưỡng nhiệt tự kích hoạt quạt:</span>
                  <input
                    type="number"
                    step="0.5"
                    style={{ width: '60px', padding: '4px 6px', fontSize: '12.5px', borderRadius: '4px', border: '1px solid var(--color-hairline)', textAlign: 'center' }}
                    value={b.tempThreshold}
                    onChange={(e) => handleSetThreshold(barnName, 'tempThreshold', e.target.value)}
                  />
                  <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>°C</span>
                </div>

                <button
                  type="button"
                  className="farmshift-btn"
                  style={{ fontSize: '11px', padding: '4px 10px', backgroundColor: '#fff7ed', color: '#ea580c', border: '1px solid #ffedd5', fontWeight: 600 }}
                  onClick={() => handleTriggerTestAlert(barnName)}
                  title="Bắn thử cảnh báo của chuồng này lên chuông Header"
                >
                  <Bell size={12} /> Bắn test chuông
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
