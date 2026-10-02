// src/features/farmshift/screens/ScreenEmployees.jsx
import React from "react";
import { DataTable, NoteBanner } from "../screenHelpers";

export const ScreenEmployees = ({ kind, db, role, navTo }) => {
  if (kind==="employees") return (
    <div>
      <div className="actions" style={{marginBottom:20}}>
        <button className="btn primary" onClick={()=>navTo("employee-form")}>＋ Thêm nhân viên</button>
        <button className="btn" onClick={()=>navTo("permissions")}>Phân quyền</button>
        <button className="btn" onClick={()=>navTo("assignment")}>Phân công chuồng</button>
      </div>
      <section className="card"><h2>Danh sách nhân viên</h2>
        <DataTable headers={["Họ tên","Vai trò","Chuồng phụ trách","Trạng thái",""]}
          rows={db.employees.map((e,i)=>[
            <b>{e.name}</b>,
            e.role,
            e.coop||"—",
            <span className={`badge ${e.status==="Khóa"?"warn":""}`}>{e.status}</span>,
            <button className="btn small" onClick={()=>navTo("employee",`id=${i}`)}>Chi tiết</button>
          ])} />
      </section>
    </div>
  );

  if (kind==="employee") {
    const idx=Number(new URLSearchParams(window.location.search).get("id")||0);
    const e=db.employees[idx]||db.employees[0];
    if(!e) return <section className="card"><p className="muted">Không tìm thấy nhân viên.</p></section>;
    return (
      <section className="card">
        <h2>{e.name}</h2>
        <div className="meta">
          <div><small>Vai trò</small><strong>{e.role}</strong></div>
          <div><small>Chuồng</small><strong>{e.coop||"—"}</strong></div>
          <div><small>Trạng thái</small><span className={`badge ${e.status==="Khóa"?"warn":""}`}>{e.status}</span></div>
        </div>
        <div className="actions" style={{marginTop:20}}>
          <button className="btn small" onClick={()=>navTo("employee-form",`id=${idx}`)}>Chỉnh sửa</button>
          <button className="btn small" onClick={()=>navTo("assignment",`emp=${encodeURIComponent(e.name)}`)}>Phân công chuồng</button>
          <button className="btn" onClick={()=>navTo("employees")}>← Danh sách</button>
        </div>
      </section>
    );
  }

  if (kind==="permissions") return (
    <section className="card">
      <h2>Phân quyền hệ thống</h2>
      <div className="tablewrap">
        <table>
          <thead><tr><th>Chức năng</th><th>Chủ trại</th><th>Kế toán</th><th>Công nhân</th></tr></thead>
          <tbody>
            {[
              ["Xem báo cáo tài chính","✅","✅","❌"],
              ["Ghi nhật ký chuồng","✅","❌","✅"],
              ["Thêm/sửa nhân viên","✅","❌","❌"],
              ["Tạo phiếu mua/bán","✅","✅","❌"],
              ["Giám sát IoT & Cảnh báo","✅","❌","✅"],
              ["Tra cứu vật tư","✅","✅","✅"],
            ].map(([f,...roles])=>(
              <tr key={f}><td>{f}</td>{roles.map((r,i)=><td key={i} style={{textAlign:"center"}}>{r}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      <NoteBanner>Phân quyền theo vai trò được cấu hình trong backend; bảng này mô tả chính sách.</NoteBanner>
    </section>
  );

  if (kind==="activity") return (
    <section className="card">
      <h2>Lịch sử hoạt động</h2>
      <DataTable headers={["Thời gian","Nhân viên","Hành động","Module"]}
        rows={[
          ["21/10/2026 07:05","Trần Văn Bình","Ghi nhật ký cho ăn","Nhật ký"],
          ["21/10/2026 09:18","Trần Văn Bình","Ghi nhận hao hụt","Nhật ký"],
          ["21/10/2026 10:12","Nguyễn Văn An","Cân mẫu định kỳ","Nhật ký"],
          ["21/10/2026 14:00","Chủ trang trại","Xem báo cáo tài chính","Báo cáo"]
        ]} />
    </section>
  );

  return null;
};
