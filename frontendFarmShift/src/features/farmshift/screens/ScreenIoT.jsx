// src/features/farmshift/screens/ScreenIoT.jsx
import React from "react";
import { DataTable, NoteBanner } from "../screenHelpers";

export const ScreenIoT = ({ kind, db, role, scopedCoops, navTo }) => {
  const IotTabs = () => (
    <nav className="tabs">
      {[["iot","Giám sát"],["devices","Thiết bị"],["rules","Tự động"],["alerts","Cảnh báo"]].map(([p,t])=>(
        <button key={p} type="button" className={p===kind?"active":""} onClick={()=>navTo(p)}>{t}</button>
      ))}
    </nav>
  );

  if (kind==="iot") return (
    <div>
      <IotTabs/>
      <NoteBanner>Dữ liệu cảm biến minh họa lúc 09:20 ngày 21/10/2026. Không có kết nối thiết bị thật.</NoteBanner>
      <div className="grid three">
        {scopedCoops().map(c=>(
          <section key={c.id} className="card">
            <h2>Chuồng {c.id}</h2>
            <p style={{fontSize:34,color:"var(--green)",margin:0}}>{c.temp}°C</p>
            <p>Độ ẩm: 65% · <span className="badge">Trực tuyến</span></p>
            <div style={{marginTop:12}}>
              <button className="btn small" onClick={()=>navTo("device",`id=${c.id}`)}>Chi tiết cảm biến</button>
            </div>
          </section>
        ))}
      </div>
    </div>
  );

  if (kind==="device") return (
    <section className="card">
      <h2>Cảm biến nhiệt ẩm · Chuồng B6</h2>
      <div className="meta">
        <div><small>Nhiệt độ</small><strong>30,1°C</strong></div>
        <div><small>Độ ẩm</small><strong>65%</strong></div>
        <div><small>Tín hiệu gần nhất</small><strong>21/10/2026 09:20</strong></div>
      </div>
      <NoteBanner>Lịch sử dữ liệu cảm biến chỉ là mẫu.</NoteBanner>
      {role==="owner"&&<button className="btn" style={{marginTop:15}} onClick={()=>navTo("iot-settings")}>Cấu hình ngưỡng</button>}
    </section>
  );

  if (kind==="devices") return (
    <div>
      <IotTabs/>
      <section className="card"><h2>Thiết bị tại trại</h2>
        <div style={{marginBottom:15}}><button className="btn primary small" onClick={()=>navTo("device-form")}>＋ Thêm thiết bị</button></div>
        <DataTable headers={["Mã","Vị trí","Loại",""]}
          rows={db.coops.map(c=>["SENSOR-"+c.id,"Chuồng "+c.id,"Cảm biến nhiệt ẩm",
            <button className="btn small" onClick={()=>navTo("device",`id=${c.id}`)}>Chi tiết</button>])} />
      </section>
    </div>
  );

  if (kind==="rules") return (
    <div>
      <IotTabs/>
      <section className="card"><h2>Quy tắc tự động hóa</h2>
        <div style={{marginBottom:15}}><button className="btn primary small" onClick={()=>navTo("rule-form")}>＋ Tạo quy tắc</button></div>
        <DataTable headers={["Chuồng","Điều kiện","Thao tác","Trạng thái"]}
          rows={db.entries.filter(e=>e.type==="rule").map(e=>[
            e.data.coop,`Nhiệt độ > ${e.data.temperature}°C trong ${e.data.duration} phút`,e.data.action,
            <span className={`badge ${e.data.enabled==="Bật"?"":"gray"}`}>{e.data.enabled}</span>])} />
        <NoteBanner>Chỉ mô phỏng cấu hình, không gửi lệnh tới phần cứng.</NoteBanner>
      </section>
    </div>
  );

  if (kind==="alerts"||kind==="notifications") {
    const items=role==="worker"?[{name:"Lịch cân mẫu hôm nay",detail:"Chuồng B6 · 10:00",status:"Mới"}]:
      role==="accountant"?[{name:"Phiếu mua chờ thanh toán",detail:"MH-1021-01 · 800.000 ₫",status:"Mới"}]:db.alerts;
    return (
      <section className="card"><h2>Thông tin cần chú ý</h2>
        {items.map((a,i)=>(
          <div key={i} className="row">
            <div><b>{a.name}</b><p><small>{a.detail}</small></p></div>
            <span className="badge warn">{a.status}</span>
            <button className="btn small" onClick={()=>navTo("alert",`id=${i}`)}>Chi tiết</button>
          </div>
        ))}
      </section>
    );
  }

  return null;
};
