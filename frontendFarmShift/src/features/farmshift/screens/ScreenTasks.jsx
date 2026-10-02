// src/features/farmshift/screens/ScreenTasks.jsx
import React from "react";
import { DataTable, NoteBanner } from "../screenHelpers";

export const ScreenTasks = ({ kind, db, role, scopedTasks, navTo, persist, toast }) => {
  const taskTabList = [["tasks","Danh sách"],["task-board","Bảng Kanban"],["calendar","Lịch chăm sóc"]];
  const TaskTabs = () => (
    <nav className="tabs">
      {taskTabList.map(([p,t])=>(
        <button key={p} type="button" className={p===kind||(p==="task-board"&&kind==="board")?"active":""} onClick={()=>navTo(p)}>{t}</button>
      ))}
    </nav>
  );

  if (kind==="tasks"||kind==="board"||kind==="calendar") {
    return (
      <div>
        <TaskTabs/>
        {role==="owner"&&<div className="actions" style={{marginBottom:20}}>
          <button className="btn primary" onClick={()=>navTo("task-form")}>＋ Giao công việc</button>
        </div>}

        {kind==="tasks"&&(
          <section className="card"><h2>Danh sách công việc</h2>
            <DataTable headers={["Công việc","Chuồng","Giờ","Trạng thái",""]}
              rows={scopedTasks().map((t,i)=>[
                <b>{t.name}</b>, t.coop, t.time,
                <span className={`badge ${t.status==="Hoàn thành"?"":"warn"}`}>{t.status}</span>,
                <button className="btn small" onClick={()=>navTo("task",`id=${i}`)}>Chi tiết</button>
              ])} />
          </section>
        )}

        {kind==="board"&&(
          <div className="kanban">
            {["Chưa bắt đầu","Đang thực hiện","Hoàn thành"].map(col=>(
              <section key={col} className="card">
                <h2>{col} <span className="badge gray">{scopedTasks().filter(t=>t.status===col).length}</span></h2>
                {scopedTasks().filter(t=>t.status===col).map((t,idx)=>(
                  <div key={idx} className="task" style={{marginBottom:12,padding:"12px 14px",background:"var(--bg)",borderRadius:8}}>
                    <h3 style={{margin:"0 0 4px",fontSize:14}}>{t.name}</h3>
                    <p className="muted" style={{fontSize:12,margin:"0 0 8px"}}>{t.coop} · {t.time}</p>
                    <button className="btn small" onClick={()=>navTo("task",`id=${db.tasks.indexOf(t)}`)}>Mở việc</button>
                  </div>
                ))}
                {scopedTasks().filter(t=>t.status===col).length===0&&(
                  <p className="muted" style={{fontSize:13,textAlign:"center",padding:"20px 0"}}>Không có việc</p>
                )}
              </section>
            ))}
          </div>
        )}

        {kind==="calendar"&&(
          <section className="card">
            <h2>Lịch chăm sóc tháng 10/2026</h2>
            <div className="calendar">
              {/* Header */}
              {["CN","T2","T3","T4","T5","T6","T7"].map(d=>(
                <div key={d} style={{fontWeight:600,fontSize:12,textAlign:"center",padding:"6px 4px",background:"var(--bg)",borderRadius:4}}>{d}</div>
              ))}
              {/* Empty cells before day 1 (Oct 2026 starts Thursday = index 4) */}
              {Array.from({length:4},(_,i)=><div key={"e"+i}/>)}
              {/* Days */}
              {Array.from({length:31},(_,d)=>{
                const day=d+1;
                const dayTasks=scopedTasks().filter(()=>day===21);
                return (
                  <div key={d} className="day" style={{minHeight:80,position:"relative"}}>
                    <b style={{fontSize:13,display:"block",marginBottom:4,color:day===21?"var(--green)":""}}>{day}</b>
                    {dayTasks.map((t,i)=>(
                      <small key={i} style={{display:"block",fontSize:11,background:"var(--green)",color:"#fff",borderRadius:3,padding:"2px 4px",marginBottom:2,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",cursor:"pointer"}}
                        onClick={()=>navTo("task",`id=${i}`)}>
                        {t.time} {t.name}
                      </small>
                    ))}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    );
  }

  if (kind==="task") {
    const t=db.tasks[Number(new URLSearchParams(window.location.search).get("id")||0)]||db.tasks[0];
    return (
      <section className="card">
        <h2>{t?.name}</h2>
        <div className="meta">
          <div><small>Chuồng</small><strong>{t?.coop}</strong></div>
          <div><small>Giờ</small><strong>{t?.time}</strong></div>
          <div><small>Trạng thái</small><span className={`badge ${t?.status==="Hoàn thành"?"":"warn"}`}>{t?.status}</span></div>
        </div>
        <div style={{marginTop:20}}>
          <label className="field">Ghi chú thực hiện<textarea defaultValue={t?.note||""}/></label>
        </div>
        <div className="actions" style={{marginTop:20}}>
          {t?.status!=="Đang thực hiện"&&t?.status!=="Hoàn thành"&&(
            <button className="btn primary" onClick={()=>{if(t)t.status="Đang thực hiện";toast&&toast("Đã bắt đầu công việc.");}}>Bắt đầu thực hiện</button>
          )}
          {t?.status!=="Hoàn thành"&&(
            <button className="btn primary" onClick={()=>{if(t)t.status="Hoàn thành";toast&&toast("Đã hoàn thành công việc!");}}>Đánh dấu hoàn thành</button>
          )}
          <button className="btn" onClick={()=>navTo("quick")}>Ghi nhật ký liên quan</button>
        </div>
      </section>
    );
  }

  return null;
};
