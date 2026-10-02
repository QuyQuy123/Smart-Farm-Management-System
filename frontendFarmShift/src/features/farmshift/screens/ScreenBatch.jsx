// src/features/farmshift/screens/ScreenBatch.jsx
import React from "react";
import { Bird, CalendarIcon, TrendingUp, Package } from "lucide-react";
import { num, money, DataTable, NoteBanner, GrowthChart } from "../screenHelpers";

const COSTS=[["Con giống",45000000],["Thức ăn",160000000],["Chăm sóc sức khỏe",5000000],["Nhân công",20000000],["Điện nước",10000000],["Chi phí khác",10000000]];

export const ScreenBatch = ({ kind, db, role, totalBirds, currentCost, scopedCoops, navTo }) => {
  const batchTabs = () => (
    <nav className="tabs">
      {[["batch","Tổng quan"],["flocks","Đàn"],["journal","Nhật ký"],["tasks","Công việc"],
        ["growth","Tăng trưởng"],["feed","Thức ăn"],["health","Sức khỏe"],["batch-cost","Chi phí"],["harvest","Thu hoạch"]].map(([p,t])=>(
        <button key={p} type="button" className={p===kind?"active":""} onClick={()=>navTo(p)}>{t}</button>
      ))}
    </nav>
  );

  if (kind==="batches") return (
    <div>
      {role==="owner"&&<div className="actions" style={{marginBottom:20}}>
        <button className="btn primary" onClick={()=>navTo("batch-create")}>＋ Tạo lứa</button>
        <button className="btn" onClick={()=>navTo("movements")}>Biến động đàn</button>
      </div>}
      <section className="card">
        <h2>Danh sách lứa nuôi</h2>
        <DataTable headers={["Mã lứa","Giống","Bắt đầu","Nhập nuôi","Hiện tại","Trạng thái",""]}
          rows={[
            ["MB-2026-08","Gà lông màu","01/10/2026","3.000",num(totalBirds()),
              <span className="badge">Đang nuôi</span>,
              <button className="btn small" onClick={()=>navTo("batch")}>Chi tiết</button>],
            ["MB-2026-07","Gà lông màu","01/07/2026","3.000","0",
              <span className="badge gray">Đã kết thúc</span>,
              <button className="btn small" onClick={()=>navTo("report-batch")}>Báo cáo</button>]
          ]} />
      </section>
    </div>
  );

  if (["batch","flocks","growth","feed","health","batch-cost","harvest","batch-close"].includes(kind)) return (
    <div>
      {batchTabs()}
      {kind==="batch"&&<div>
        <div className="grid four">
          <div className="card kpi"><span className="round"><Bird size={20}/></span><div><span>Hiện tại</span><strong>{num(totalBirds())}</strong><small>con</small></div></div>
          <div className="card kpi"><span className="round"><CalendarIcon size={20}/></span><div><span>Ngày tuổi</span><strong>21</strong><small>ngày</small></div></div>
          <div className="card kpi"><span className="round"><TrendingUp size={20}/></span><div><span>Cân nặng TB</span><strong>450</strong><small>g/con</small></div></div>
          <div className="card kpi"><span className="round"><Package size={20}/></span><div><span>Cám đã dùng</span><strong>1.800</strong><small>kg</small></div></div>
        </div>
        <div className="grid two">
          <section className="card"><h2>Tăng trưởng của lứa</h2><GrowthChart/></section>
          <section className="card">
            <h2>Trạng thái lứa MB-2026-08</h2>
            <p>Giống: Gà lông màu · Nhập nuôi: 3.000 con</p>
            <p>Bắt đầu: 01/10/2026</p>
            <span className="badge">Đang nuôi</span>
            <div style={{marginTop:20}}>{role==="owner"&&<button className="btn small" onClick={()=>navTo("batch-close")}>Kết thúc lứa</button>}</div>
          </section>
        </div>
      </div>}
      {kind==="flocks"&&<section className="card"><h2>Đàn trong lứa</h2>
        <DataTable headers={["Mã đàn","Chuồng","Số lượng",""]}
          rows={db.coops.map(c=>["D-08-"+c.id,"Chuồng "+c.id,num(c.n)+" con",
            role==="owner"?<button className="btn small" onClick={()=>navTo("movements")}>Biến động</button>:<span className="badge gray">Chỉ xem</span>])} />
      </section>}
      {kind==="growth"&&<section className="card"><h2>Theo dõi tăng trưởng</h2>
        <DataTable headers={["Ngày tuổi","Thực tế","Mục tiêu"]}
          rows={[[1,"45 g","45 g"],[7,"130 g","140 g"],[14,"290 g","300 g"],[21,"450 g","470 g"]]} />
      </section>}
      {kind==="feed"&&<section className="card"><h2>Tiêu thụ thức ăn lũy kế</h2>
        <NoteBanner>Tổng cám dùng lũy kế mẫu: 1.800 kg. Phiếu xuất kho và nhật ký sử dụng được đối chiếu riêng.</NoteBanner>
      </section>}
      {kind==="health"&&<section className="card"><h2>Theo dõi sức khỏe đàn</h2>
        <div className="actions" style={{marginBottom:15}}><button className="btn primary small" onClick={()=>navTo("health-log")}>＋ Ghi sức khỏe</button></div>
        <DataTable headers={["Ngày","Chuồng","Hiện tượng","Xử lý"]}
          rows={[["21/10/2026","B6","2 con hao hụt","Đã báo chủ trại, lập biên bản"]]} />
      </section>}
      {kind==="batch-cost"&&<section className="card"><h2>Chi phí lũy kế lứa MB-2026-08</h2>
        <DataTable headers={["Khoản mục","Số tiền"]} rows={COSTS.map(([n,v])=>[n,money(v)])} />
        <div style={{marginTop:15}}><button className="btn primary" onClick={()=>navTo("cost-form")}>＋ Ghi chi phí</button></div>
      </section>}
      {kind==="harvest"&&<section className="card"><h2>Các lần xuất bán của lứa</h2>
        <div className="actions" style={{marginBottom:15}}><button className="btn primary small" onClick={()=>navTo("sale-form")}>＋ Lập phiếu bán</button></div>
        <p className="muted">Chưa có đợt xuất bán nào trong lứa hiện tại.</p>
      </section>}
      {kind==="batch-close"&&<section className="card"><h2>Đối soát kết thúc lứa</h2>
        <p>Tồn đàn hiện tại: <b>{num(totalBirds())} con</b></p>
        <NoteBanner warn={totalBirds()>0}>{totalBirds()>0?"Chưa thể kết thúc vì lứa vẫn còn đàn. Cần xuất bán hết đàn trước.":"Đủ điều kiện kết thúc lứa."}</NoteBanner>
        <button className="btn primary" disabled={totalBirds()>0}>Xác nhận kết thúc lứa</button>
      </section>}
    </div>
  );

  if (kind==="movements") return (
    <div>
      <section className="card"><h2>Thao tác biến động đàn</h2>
        <div className="actions">
          <button className="btn" onClick={()=>navTo("transfer")}>Chuyển đàn</button>
          <button className="btn" onClick={()=>navTo("split")}>Tách đàn</button>
          <button className="btn" onClick={()=>navTo("merge")}>Gộp đàn</button>
          <button className="btn danger" onClick={()=>navTo("mortality")}>Ghi hao hụt</button>
        </div>
      </section>
      <section className="card"><h2>Lịch sử biến động</h2>
        <DataTable headers={["Ngày","Loại","Nội dung"]} rows={[["21/10/2026","Hao hụt","Chuồng B6 · 2 con"]]} />
      </section>
    </div>
  );
  return null;
};
