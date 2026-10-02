// src/features/farmshift/screens/ScreenFarm.jsx
import React from "react";
import { Bird, Activity, TrendingUp } from "lucide-react";
import { num, DataTable, NoteBanner } from "../screenHelpers";

export const ScreenFarm = ({ kind, db, role, scopedCoops, searchParams, navTo }) => {
  if (kind === "farm" || kind === "coops") {
    return (
      <div>
        <nav className="tabs">
          {[["farm","Sơ đồ"],["coops","Danh sách chuồng"],["areas","Khu nuôi"],["devices","Thiết bị"]].map(([p,t])=>(
            <button key={p} type="button" className={p===kind?"active":""} onClick={()=>navTo(p)}>{t}</button>
          ))}
        </nav>
        {role==="owner" && (
          <div className="actions" style={{marginBottom:20}}>
            <button className="btn primary" onClick={()=>navTo("coop-form")}>＋ Thêm chuồng</button>
          </div>
        )}
        <div className="grid three">
          {scopedCoops().map(c=>(
            <div key={c.id} className="card coop">
              <span className="temp">{c.temp}°C</span>
              <h2>Chuồng {c.id}</h2>
              <span className="badge">Đang nuôi</span>
              <p className="muted">MB-2026-08 · Gà lông màu</p>
              <div className="row"><span>Tổng đàn</span><strong>{num(c.n)} con</strong></div>
              <div className="row"><span>Phụ trách</span><span>{c.worker}</span></div>
              <div className="progress"><i style={{width:`${Math.min(c.n/2000*100,100)}%`}}/></div>
              <small>Sức chứa 2.000 con</small>
              <p style={{marginTop:15}}>
                <button className="btn small" onClick={()=>navTo("coop",`id=${c.id}`)}>Xem chi tiết</button>
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (kind==="areas") return (
    <section className="card">
      <h2>Các khu nuôi</h2>
      <div style={{marginBottom:15}}><button className="btn primary small" onClick={()=>navTo("area-form")}>＋ Thêm khu</button></div>
      <DataTable headers={["Mã khu","Tên khu","Số chuồng","Sức chứa",""]}
        rows={[["B","Khu B","2","4.000 con",<button className="btn small" onClick={()=>navTo("area-form")}>Chỉnh sửa</button>]]} />
    </section>
  );
  if (kind==="coop") {
    const c=scopedCoops().find(c=>c.id===(searchParams.get("id")||"B6"))||scopedCoops()[0];
    return (
      <div>
        <div className="grid four">
          <div className="card kpi"><span className="round"><Bird size={20}/></span><div><span>Tổng đàn</span><strong>{num(c.n)}</strong><small>con</small></div></div>
          <div className="card kpi"><span className="round"><Activity size={20}/></span><div><span>Nhiệt độ</span><strong>{c.temp}</strong><small>°C</small></div></div>
          <div className="card kpi"><span className="round"><Activity size={20}/></span><div><span>Độ ẩm</span><strong>65</strong><small>%</small></div></div>
          <div className="card kpi"><span className="round"><TrendingUp size={20}/></span><div><span>Ngày tuổi</span><strong>21</strong><small>ngày</small></div></div>
        </div>
        <section className="card">
          <h2>Chuồng {c.id}</h2>
          <div className="meta">
            <div><small>Lứa đang nuôi</small><strong>MB-2026-08</strong></div>
            <div><small>Đàn</small><strong>D-08-{c.id}</strong></div>
            <div><small>Phụ trách</small><strong>{c.worker}</strong></div>
          </div>
          <div className="actions" style={{marginTop:22}}>
            <button className="btn" onClick={()=>navTo("journal")}>Nhật ký</button>
            <button className="btn" onClick={()=>navTo("tasks")}>Công việc</button>
            <button className="btn" onClick={()=>navTo("iot")}>Môi trường</button>
            {role==="owner"?<button className="btn" onClick={()=>navTo("coop-form")}>Chỉnh sửa</button>
              :<button className="btn primary" onClick={()=>navTo("quick")}>Ghi nhanh</button>}
          </div>
        </section>
      </div>
    );
  }
  return null;
};
