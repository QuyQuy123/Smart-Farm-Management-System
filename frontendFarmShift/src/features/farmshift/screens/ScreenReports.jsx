// src/features/farmshift/screens/ScreenReports.jsx
import React from "react";
import { money, DataTable, GrowthChart } from "../screenHelpers";

const COSTS=[["Con giống",45000000],["Thức ăn",160000000],["Chăm sóc sức khỏe",5000000],["Nhân công",20000000],["Điện nước",10000000],["Chi phí khác",10000000]];

export const ScreenReports = ({ kind, db, navTo }) => {
  if (kind==="reports") return (
    <div className="grid three">
      {[["report-batch","Hiệu quả lứa nuôi","Doanh thu, chi phí và lợi nhuận"],
        ["report-flock","Đàn & Hao hụt","Nhập, xuất, tồn và tỷ lệ sống"],
        ["report-growth","Tăng trưởng & Cám","Cân nặng và tiêu thụ thức ăn"],
        ["report-stock","Nhập xuất tồn kho","Số lượng và giá trị theo mặt hàng"],
        ["report-cash","Thu chi sổ quỹ","Dòng tiền và các chứng từ"],
        ["report-debt","Báo cáo công nợ","Tổng hợp phải thu và phải trả"],
        ["report-trade","Tổng hợp mua bán","Lịch sử giao dịch mua và bán"]
      ].map(([p,t,d])=>(
        <div key={p} className="card">
          <h2>{t}</h2>
          <p className="muted" style={{minHeight:40}}>{d}</p>
          <button className="btn small" onClick={()=>navTo(p)}>Xem báo cáo</button>
        </div>
      ))}
    </div>
  );

  if (kind==="report-batch") return (
    <div>
      <div className="actions" style={{marginBottom:20}}>
        <button className="btn">Xuất CSV</button>
        <button className="btn" onClick={()=>window.print()}>In / Lưu PDF</button>
      </div>
      <section className="card">
        <div className="meta">
          <div><small>Mã lứa</small><strong>MB-2026-07</strong></div>
          <div><small>Giống gà</small><strong>Gà lông màu</strong></div>
          <div><small>Thời gian nuôi</small><strong>01/07/2026 – 30/09/2026</strong></div>
          <div><small>Trạng thái</small><span className="badge gray">Đã kết thúc</span></div>
        </div>
      </section>
      <div className="grid two">
        <section className="card"><h2>Chi tiết chi phí</h2>
          <DataTable headers={["Khoản mục","Chi phí (₫)"]}
            rows={[...COSTS.map(([n,v])=>[n,money(v)]),["",""],["Tổng chi phí","250.000.000 ₫"]]} />
        </section>
        <section className="card"><h2>Phạm vi báo cáo</h2>
          <p>Doanh thu ghi nhận: <b>419.720.000 ₫</b></p>
          <p>Lợi nhuận gộp: <b>169.720.000 ₫</b></p>
          <div className="note">Lứa MB-2026-07 đã kết thúc quyết toán đầy đủ.</div>
        </section>
      </div>
    </div>
  );

  if (kind==="report-growth") return (
    <section className="card"><h2>Báo cáo tăng trưởng & Thức ăn</h2>
      <GrowthChart/>
      <DataTable headers={["Ngày tuổi","Thực tế","Mục tiêu"]}
        rows={[[1,"45 g","45 g"],[7,"130 g","140 g"],[14,"290 g","300 g"],[21,"450 g","470 g"]]} />
    </section>
  );

  if (kind==="report-stock") return (
    <section className="card"><h2>Báo cáo nhập xuất tồn</h2>
      <DataTable headers={["Vật tư","Tồn hiện tại","Đơn vị","Giá trị"]}
        rows={db.stock.map(s=>[s.name,s.n,s.unit,money(s.n*s.price)])} />
    </section>
  );

  if (kind==="report-flock") return (
    <section className="card"><h2>Báo cáo đàn & Hao hụt</h2>
      <DataTable headers={["Chuồng","Nhập ban đầu","Hiện tại"]}
        rows={db.coops.map(c=>[c.id,"1.500",c.n])} />
    </section>
  );

  if (kind==="report-debt") return (
    <section className="card"><h2>Báo cáo công nợ</h2>
      <DataTable headers={["Loại","Còn lại"]}
        rows={[
          ["Phải trả",money(db.purchases.reduce((s,p)=>s+p.amount-p.paid,0))],
          ["Phải thu",money(db.sales.filter(s=>s.confirmed).reduce((a,s)=>a+s.amount-s.paid,0))]
        ]} />
    </section>
  );

  return null;
};
