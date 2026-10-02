// src/features/farmshift/screens/ScreenInventory.jsx
import React from "react";
import { num, money, DataTable, NoteBanner } from "../screenHelpers";

const stockTabList=[["inventory","Tồn kho"],["lots","Lô & Hạn dùng"],["stock-transactions","Nhập / Xuất"],["counts","Kiểm kê"]];

export const ScreenInventory = ({ kind, db, role, navTo }) => {
  const StockTabs = () => (
    <nav className="tabs">
      {stockTabList.map(([p,t])=>(
        <button key={p} type="button" className={p===kind?"active":""} onClick={()=>navTo(p)}>{t}</button>
      ))}
    </nav>
  );

  if (kind==="inventory"||kind==="stock-lookup") {
    const worker=kind==="stock-lookup";
    return (
      <div>
        {!worker&&<StockTabs/>}
        {!worker&&<div className="actions" style={{marginBottom:20}}>
          <button className="btn" onClick={()=>navTo("item-form")}>＋ Vật tư</button>
          <button className="btn primary" onClick={()=>navTo("stock-in")}>Nhập kho</button>
          <button className="btn" onClick={()=>navTo("stock-out")}>Xuất kho</button>
          <button className="btn" onClick={()=>navTo("stock-transfer")}>Chuyển kho</button>
        </div>}
        <section className="card"><h2>{worker?"Vật tư dùng tại chuồng":"Tồn kho hiện tại"}</h2>
          <DataTable headers={worker?["Vật tư","Số lượng","Đơn vị"]:["Mã","Vật tư","Số lượng","Đơn vị","Giá trị",""]}
            rows={db.stock.map(s=>worker?[s.name,num(s.n),s.unit]:
              [s.id,s.name,num(s.n),s.unit,money(s.n*s.price),
                <button className="btn small" onClick={()=>navTo("item",`id=${s.id}`)}>Chi tiết</button>])} />
        </section>
      </div>
    );
  }

  if (kind==="lots") return (
    <div>
      <StockTabs/>
      <section className="card"><h2>Các lô tồn & Hạn sử dụng</h2>
        <DataTable headers={["Vật tư","Mã lô","Số lượng","Hạn dùng"]}
          rows={db.stock.flatMap(s=>s.id==="BS-001"?
            [[s.name,"BS-0926","10 gói","05/11/2026"],[s.name,"BS-1026",`${num(s.n-10)} gói`,"15/04/2027"]]:
            [[s.name,s.lot,`${num(s.n)} ${s.unit}`,s.expiry]])} />
      </section>
    </div>
  );

  if (kind==="stock-transactions") return (
    <div>
      <StockTabs/>
      <div className="actions" style={{marginBottom:20}}>
        <button className="btn primary" onClick={()=>navTo("stock-in")}>Nhập kho</button>
        <button className="btn" onClick={()=>navTo("stock-out")}>Xuất kho</button>
        <button className="btn" onClick={()=>navTo("stock-transfer")}>Chuyển kho</button>
        <button className="btn" onClick={()=>navTo("stock-return")}>Nhập trả</button>
      </div>
      <section className="card"><h2>Phiếu nhập / xuất kho</h2>
        <DataTable headers={["Mã phiếu","Loại","Ngày",""]}
          rows={db.entries.filter(e=>e.type.startsWith("stock-")&&!["stock-count","stock-adjust"].includes(e.type))
            .map(e=>[e.id,e.type,e.date,<button className="btn small" onClick={()=>navTo("stock-detail",`id=${db.entries.indexOf(e)}`)}>Chi tiết</button>])} />
      </section>
    </div>
  );

  if (kind==="counts") return (
    <div>
      <StockTabs/>
      <section className="card"><h2>Biên bản kiểm kê</h2>
        <div style={{marginBottom:15}}>
          <button className="btn primary" onClick={()=>navTo("stock-count")}>＋ Lập kiểm kê</button>
          <button className="btn" style={{marginLeft:8}} onClick={()=>navTo("stock-adjust")}>Điều chỉnh tồn</button>
        </div>
        <DataTable headers={["Mã","Vật tư","Thực đếm","Ngày"]}
          rows={db.entries.filter(e=>e.type==="stock-count").map(e=>[e.id,e.data.item,e.data.actual,e.date])} />
        <NoteBanner>Kiểm kê chỉ ghi kết quả đếm. Tồn chỉ thay đổi khi xác nhận phiếu điều chỉnh.</NoteBanner>
      </section>
    </div>
  );

  return null;
};
