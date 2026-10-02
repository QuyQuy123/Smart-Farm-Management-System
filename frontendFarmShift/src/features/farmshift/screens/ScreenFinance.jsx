// src/features/farmshift/screens/ScreenFinance.jsx
import React from "react";
import { money, DataTable, NoteBanner } from "../screenHelpers";

const finTabList=[["finance","Tổng quan"],["cashbook","Sổ quỹ"],["receipts","Phiếu thu"],["payments","Phiếu chi"],["payables","Phải trả"],["receivables","Phải thu"],["costs","Chi phí lứa"]];

export const ScreenFinance = ({ kind, db, navTo }) => {
  const FinTabs = () => (
    <nav className="tabs">
      {finTabList.map(([p,t])=>(
        <button key={p} type="button" className={p===kind?"active":""} onClick={()=>navTo(p)}>{t}</button>
      ))}
    </nav>
  );

  const cashRows = (filter) => db.payments
    .filter(p=>!filter||p.type===filter)
    .map(p=>[p.id,p.date,<span className={`badge ${p.type==="receipt"?"":"warn"}`}>{p.type==="receipt"?"Thu":"Chi"}</span>,p.ref,money(p.amount),
      <button className="btn small" onClick={()=>navTo("voucher",`id=${db.payments.indexOf(p)}`)}>Chi tiết</button>]);

  const totalBalance = 50000000+db.payments.reduce((s,p)=>s+(p.type==="receipt"?p.amount:-p.amount),0);

  if (kind==="finance") return (
    <div>
      <FinTabs/>
      <div className="grid four">
        <div className="card kpi"><span className="round">💰</span><div><span>Số dư đầu kỳ</span><strong>50.000.000 ₫</strong></div></div>
        <div className="card kpi"><span className="round">⬆️</span><div><span>Thu đã ghi</span><strong>{money(db.payments.filter(p=>p.type==="receipt").reduce((s,p)=>s+p.amount,0))}</strong></div></div>
        <div className="card kpi"><span className="round">⬇️</span><div><span>Chi đã ghi</span><strong>{money(db.payments.filter(p=>p.type==="payment").reduce((s,p)=>s+p.amount,0))}</strong></div></div>
        <div className="card kpi"><span className="round">🏦</span><div><span>Số dư hiện tại</span><strong>{money(totalBalance)}</strong></div></div>
      </div>
      <section className="card"><h2>Giao dịch gần đây</h2>
        <DataTable headers={["Mã phiếu","Ngày","Loại","Liên kết","Số tiền",""]} rows={cashRows(null)} />
      </section>
    </div>
  );

  if (["cashbook","receipts","payments"].includes(kind)) return (
    <div>
      <FinTabs/>
      <div className="actions" style={{marginBottom:20}}>
        <button className="btn primary" onClick={()=>navTo("receipt-form")}>＋ Phiếu thu</button>
        <button className="btn" onClick={()=>navTo("payment-form")}>＋ Phiếu chi</button>
      </div>
      <section className="card"><h2>Sổ giao dịch</h2>
        <DataTable headers={["Mã phiếu","Ngày","Loại","Liên kết","Số tiền",""]}
          rows={cashRows(kind==="receipts"?"receipt":kind==="payments"?"payment":null)} />
      </section>
    </div>
  );

  if (["payables","receivables"].includes(kind)) {
    const receive=kind==="receivables";
    const list=receive?db.sales.filter(s=>s.confirmed):db.purchases;
    return (
      <div>
        <FinTabs/>
        <section className="card"><h2>{receive?"Công nợ khách hàng":"Công nợ nhà cung cấp"}</h2>
          <DataTable headers={["Chứng từ","Đối tượng","Giá trị","Đã thanh toán","Còn lại",""]}
            rows={list.map(p=>[p.id,p.party,money(p.amount),money(p.paid),money(p.amount-p.paid),
              <button className="btn small" onClick={()=>navTo(receive?"receipt-form":"payment-form",`ref=${encodeURIComponent(p.id)}`)}>
                {receive?"Thu tiền":"Chi tiền"}
              </button>])} />
        </section>
      </div>
    );
  }

  if (kind==="costs") return (
    <div>
      <FinTabs/>
      <section className="card"><h2>Chi phí theo lứa</h2>
        <DataTable headers={["Mã lứa","Trạng thái","Chi phí",""]}
          rows={[
            ["MB-2026-08",<span className="badge">Đang nuôi</span>,money(70000000),<button className="btn small" onClick={()=>navTo("batch-cost")}>Chi tiết</button>],
            ["MB-2026-07",<span className="badge gray">Đã kết thúc</span>,"250.000.000 ₫",<button className="btn small" onClick={()=>navTo("report-batch")}>Báo cáo</button>]
          ]} />
      </section>
    </div>
  );

  return null;
};
