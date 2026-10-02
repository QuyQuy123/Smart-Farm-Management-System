// src/features/farmshift/screens/ScreenTrade.jsx
// Purchases, Sales, Suppliers, Customers screens
import React from "react";
import { money, DataTable, NoteBanner } from "../screenHelpers";

export const ScreenTrade = ({ kind, db, role, navTo }) => {
  // ── PURCHASES ─────────────────────────────────────────────
  if (kind==="purchases") return (
    <div>
      <nav className="tabs">
        {[["purchases","Phiếu mua"],["suppliers","Nhà cung cấp"]].map(([p,t])=>(
          <button key={p} type="button" className={p===kind?"active":""} onClick={()=>navTo(p)}>{t}</button>
        ))}
      </nav>
      <div className="actions" style={{marginBottom:20}}>
        <button className="btn primary" onClick={()=>navTo("purchase-form")}>＋ Tạo phiếu mua</button>
      </div>
      <section className="card"><h2>Danh sách phiếu mua hàng</h2>
        <DataTable headers={["Mã phiếu","Nhà cung cấp","Ngày","Giá trị","Đã trả","Còn lại",""]}
          rows={db.purchases.map((p,i)=>[
            <b>{p.id}</b>, p.party, p.date, money(p.amount), money(p.paid), money(p.amount-p.paid),
            <button className="btn small" onClick={()=>navTo("purchase",`id=${i}`)}>Chi tiết</button>
          ])} />
        {db.purchases.length===0&&<p className="muted">Chưa có phiếu mua nào.</p>}
      </section>
    </div>
  );

  if (kind==="purchase") {
    const p=db.purchases[Number(new URLSearchParams(window.location.search).get("id")||0)]||db.purchases[0];
    if(!p) return <section className="card"><p className="muted">Không tìm thấy phiếu mua.</p></section>;
    return (
      <section className="card">
        <h2>Phiếu mua: {p.id}</h2>
        <div className="meta">
          <div><small>Nhà cung cấp</small><strong>{p.party}</strong></div>
          <div><small>Ngày mua</small><strong>{p.date}</strong></div>
          <div><small>Tổng tiền</small><strong>{money(p.amount)}</strong></div>
          <div><small>Đã thanh toán</small><strong>{money(p.paid)}</strong></div>
          <div><small>Còn lại</small><strong style={{color:"var(--warn)"}}>{money(p.amount-p.paid)}</strong></div>
          <div><small>Nhập kho</small><span className={`badge ${p.received?"":"warn"}`}>{p.received?"Đã nhập":"Chưa nhập"}</span></div>
        </div>
        <div className="actions" style={{marginTop:20}}>
          {!p.received&&<button className="btn primary" onClick={()=>navTo("stock-in",`ref=${p.id}`)}>Nhập kho</button>}
          {p.amount-p.paid>0&&<button className="btn" onClick={()=>navTo("payment-form",`ref=${encodeURIComponent(p.id)}`)}>Thanh toán</button>}
          <button className="btn" onClick={()=>navTo("purchases")}>← Quay lại</button>
        </div>
      </section>
    );
  }

  if (kind==="suppliers") return (
    <div>
      <nav className="tabs">
        {[["purchases","Phiếu mua"],["suppliers","Nhà cung cấp"]].map(([p,t])=>(
          <button key={p} type="button" className={p===kind?"active":""} onClick={()=>navTo(p)}>{t}</button>
        ))}
      </nav>
      <div className="actions" style={{marginBottom:20}}>
        <button className="btn primary small" onClick={()=>navTo("supplier-form")}>＋ Thêm NCC</button>
      </div>
      <section className="card"><h2>Danh sách nhà cung cấp</h2>
        <DataTable headers={["Tên NCC","Nhóm","Tổng mua","Còn nợ",""]}
          rows={[
            ["NCC An Phú","Cám & Thức ăn",money(800000),money(800000),<button className="btn small" onClick={()=>navTo("supplier")}>Chi tiết</button>],
            ["Cám Miền Trung","Thức ăn","0 ₫","0 ₫",<button className="btn small" onClick={()=>navTo("supplier")}>Chi tiết</button>]
          ]} />
      </section>
    </div>
  );

  if (kind==="supplier") return (
    <section className="card">
      <h2>NCC An Phú</h2>
      <div className="meta">
        <div><small>Loại hàng</small><strong>Cám & Thức ăn gia súc</strong></div>
        <div><small>Điện thoại</small><strong>0901234567</strong></div>
        <div><small>Địa chỉ</small><strong>KCN Đồng An, Bình Dương</strong></div>
        <div><small>Công nợ</small><strong style={{color:"var(--warn)"}}>{money(800000)}</strong></div>
      </div>
      <div style={{marginTop:16}}>
        <button className="btn small" onClick={()=>navTo("supplier-form")}>Chỉnh sửa</button>
        <button className="btn primary small" style={{marginLeft:8}} onClick={()=>navTo("purchase-form")}>Tạo phiếu mua</button>
      </div>
    </section>
  );

  // ── SALES ─────────────────────────────────────────────────
  if (kind==="sales") return (
    <div>
      <nav className="tabs">
        {[["sales","Phiếu bán"],["customers","Khách hàng"],["harvest-plan","Kế hoạch XB"]].map(([p,t])=>(
          <button key={p} type="button" className={p===kind?"active":""} onClick={()=>navTo(p)}>{t}</button>
        ))}
      </nav>
      <div className="actions" style={{marginBottom:20}}>
        <button className="btn primary" onClick={()=>navTo("sale-form")}>＋ Tạo phiếu bán</button>
      </div>
      <section className="card"><h2>Danh sách phiếu bán hàng</h2>
        {db.sales.length===0
          ? <NoteBanner>Chưa có phiếu bán nào. Tạo phiếu bán sau khi xác nhận đàn đủ điều kiện xuất.</NoteBanner>
          : <DataTable headers={["Mã phiếu","Khách hàng","Ngày","Số con","Giá trị","Đã thu","Còn lại",""]}
              rows={db.sales.map((s,i)=>[
                <b>{s.id}</b>,s.party,s.date,s.quantity,money(s.amount),money(s.paid),money(s.amount-s.paid),
                <button className="btn small" onClick={()=>navTo("sale",`id=${i}`)}>Chi tiết</button>
              ])} />
        }
      </section>
    </div>
  );

  if (kind==="sale") {
    const s=db.sales[Number(new URLSearchParams(window.location.search).get("id")||0)];
    if(!s) return <section className="card"><p className="muted">Không tìm thấy phiếu bán.</p></section>;
    return (
      <section className="card">
        <h2>Phiếu bán: {s.id}</h2>
        <div className="meta">
          <div><small>Khách hàng</small><strong>{s.party}</strong></div>
          <div><small>Ngày bán</small><strong>{s.date}</strong></div>
          <div><small>Số con</small><strong>{s.quantity} con</strong></div>
          <div><small>Giá trị</small><strong>{money(s.amount)}</strong></div>
          <div><small>Đã thu</small><strong>{money(s.paid)}</strong></div>
          <div><small>Xuất đàn</small><span className={`badge ${s.confirmed?"":"warn"}`}>{s.confirmed?"Đã xuất":"Chưa xuất"}</span></div>
        </div>
        <div className="actions" style={{marginTop:20}}>
          {s.amount-s.paid>0&&<button className="btn primary" onClick={()=>navTo("receipt-form",`ref=${encodeURIComponent(s.id)}`)}>Thu tiền</button>}
          <button className="btn" onClick={()=>navTo("sales")}>← Quay lại</button>
        </div>
      </section>
    );
  }

  if (kind==="customers") return (
    <div>
      <nav className="tabs">
        {[["sales","Phiếu bán"],["customers","Khách hàng"],["harvest-plan","Kế hoạch XB"]].map(([p,t])=>(
          <button key={p} type="button" className={p===kind?"active":""} onClick={()=>navTo(p)}>{t}</button>
        ))}
      </nav>
      <div className="actions" style={{marginBottom:20}}>
        <button className="btn primary small" onClick={()=>navTo("customer-form")}>＋ Thêm khách hàng</button>
      </div>
      <section className="card"><h2>Danh sách khách hàng & Thương lái</h2>
        <DataTable headers={["Tên","Điện thoại","Địa chỉ","Tổng mua",""]}
          rows={[
            ["Thương lái Hòa","0988776655","Chợ đầu mối Hà Vĩ","0 ₫",<button className="btn small" onClick={()=>navTo("customer")}>Chi tiết</button>]
          ]} />
      </section>
    </div>
  );

  if (kind==="harvest-plan") return (
    <div>
      <nav className="tabs">
        {[["sales","Phiếu bán"],["customers","Khách hàng"],["harvest-plan","Kế hoạch XB"]].map(([p,t])=>(
          <button key={p} type="button" className={p===kind?"active":""} onClick={()=>navTo(p)}>{t}</button>
        ))}
      </nav>
      <section className="card"><h2>Kế hoạch xuất bán</h2>
        <div className="actions" style={{marginBottom:15}}><button className="btn primary small" onClick={()=>navTo("harvest-form")}>＋ Lập kế hoạch</button></div>
        <NoteBanner>Lập kế hoạch xuất bán trước để dự báo ngày xuất và số con dự kiến.</NoteBanner>
      </section>
    </div>
  );

  return null;
};
