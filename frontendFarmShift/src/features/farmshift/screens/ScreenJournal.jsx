// src/features/farmshift/screens/ScreenJournal.jsx
import React from "react";
import { LogTable, NoteBanner, GrowthChart } from "../screenHelpers";

export const ScreenJournal = ({ kind, db, role, scopedLogs, navTo }) => {
  if (kind==="journal") return (
    <div>
      {role!=="accountant"&&(
        <div className="actions" style={{marginBottom:20}}>
          <button className="btn primary" onClick={()=>navTo("quick")}>＋ Ghi nhật ký</button>
          <button className="btn" onClick={()=>navTo("voice")}>Nhập giọng nói</button>
        </div>
      )}
      {role==="accountant"&&<NoteBanner>Kế toán chỉ xem nhật ký để đối chiếu nghiệp vụ; không thay đổi dữ liệu đàn.</NoteBanner>}
      <section className="card"><h2>Nhật ký theo thời gian</h2>
        <LogTable logs={scopedLogs()} onDetail={(i)=>navTo("log-detail",`id=${i}`)} />
      </section>
    </div>
  );

  if (kind==="quick") return (
    <div>
      <div className="quick">
        {[["feeding","Cho ăn"],["mortality","Hao hụt"],["weighing","Cân mẫu"],["medication","Thuốc / Vaccine"],
          ["health-log","Sức khỏe"],["work-log","Công việc khác"],["voice","Giọng nói"]].map(([p,t])=>(
          <button key={p} className="card" style={{cursor:"pointer",textAlign:"center",padding:20}} onClick={()=>navTo(p)}>
            <b style={{display:"block"}}>{t}</b>
          </button>
        ))}
      </div>
      <NoteBanner>Chọn nội dung cần ghi. Nhật ký không bắt buộc gắn với công việc có sẵn.</NoteBanner>
    </div>
  );

  if (kind==="feeding-history"||kind==="weight-history") {
    const isWeight=kind==="weight-history";
    const filtered=scopedLogs().filter(l=>l.type===(isWeight?"Cân mẫu":"Cho ăn"));
    return (
      <section className="card"><h2>{isWeight?"Tăng trưởng":"Sử dụng thức ăn"}</h2>
        {isWeight&&<GrowthChart/>}
        <LogTable logs={filtered} onDetail={(i)=>navTo("log-detail",`id=${i}`)} />
      </section>
    );
  }

  if (kind==="voice") return (
    <section className="card">
      <h2>Ghi âm nhật ký</h2>
      <div style={{textAlign:"center",padding:30}}>
        <p>Chọn chuồng rồi nói rõ hoạt động và số lượng.</p>
        <button className="btn primary" style={{borderRadius:"50%",width:94,height:94,fontSize:32,margin:20}}>🎤</button>
        <p className="muted">Sẵn sàng ghi âm nếu trình duyệt hỗ trợ</p>
      </div>
      <label className="field full">Nội dung đã nghe / nhập tay
        <textarea placeholder="Ví dụ: Chuồng B6 hôm nay cho ăn 60 kg thức ăn tăng trưởng." />
      </label>
      <div className="actions" style={{marginTop:20}}>
        <button className="btn" onClick={()=>navTo("voice-review")}>Kiểm tra thông tin</button>
      </div>
      <NoteBanner>Ghi âm dùng micro khi trình duyệt cho phép. Bản HTML dùng ví dụ trích xuất cố định để duyệt giao diện.</NoteBanner>
    </section>
  );

  return null;
};
