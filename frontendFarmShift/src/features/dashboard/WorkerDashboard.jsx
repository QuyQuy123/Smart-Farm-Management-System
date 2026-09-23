// src/features/dashboard/WorkerDashboard.jsx
// Công nhân Dashboard — Trang trại Miền Bình (Gà thịt)
import React, { useState } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { Clock, CheckCircle, Mic, ClipboardList, AlertTriangle } from 'lucide-react';
import styles from './Dashboard.module.css';
import { Button } from '../../components/Button/Button';

/* ── Mock tasks hôm nay ─────────────────────────────────── */
const MOCK_TASKS = [
  {
    id: 1,
    title: 'Cho ăn buổi sáng – Chuồng 1',
    desc: 'Lứa GÀ-2024-08 | 45 ngày tuổi | 1,950 con | Cám CP 511 giai đoạn 3',
    time: '06:30',
    priority: 'Cao',
    status: 'done',
    barn: 'Chuồng 1',
  },
  {
    id: 2,
    title: 'Cho ăn buổi sáng – Chuồng 2',
    desc: 'Lứa GÀ-2024-09 | 30 ngày tuổi | 1,980 con | Cám CP 511 giai đoạn 2',
    time: '07:00',
    priority: 'Cao',
    status: 'done',
    barn: 'Chuồng 2',
  },
  {
    id: 3,
    title: 'Tiêm vaccine Newcastle – Chuồng 3',
    desc: 'Lứa GÀ-2024-10 | 12 ngày tuổi | 3,950 con | Vaccine ND-IB nhỏ mắt',
    time: '08:30',
    priority: 'Cao',
    status: 'pending',
    barn: 'Chuồng 3',
  },
  {
    id: 4,
    title: 'Ghi nhật ký hàng ngày – Chuồng 1',
    desc: 'Ghi số con chết, kg cám tiêu thụ, quan sát sức khỏe đàn',
    time: '16:00',
    priority: 'Trung bình',
    status: 'pending',
    barn: 'Chuồng 1',
  },
  {
    id: 5,
    title: 'Kiểm tra nhiệt độ và hệ thống quạt',
    desc: 'Đo nhiệt độ 3 chuồng, kiểm tra quạt thông gió và rèm',
    time: '12:00',
    priority: 'Cao',
    status: 'pending',
    barn: 'Tất cả',
  },
];

export const WorkerDashboard = () => {
  const [tasks, setTasks] = useState(MOCK_TASKS);
  const [voiceActive, setVoiceActive] = useState(false);

  const doneCount    = tasks.filter(t => t.status === 'done').length;
  const pendingCount = tasks.filter(t => t.status === 'pending').length;

  const markDone = (id) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'done' } : t));
  };

  const BREADCRUMBS = [
    { label: 'Nhiệm vụ hôm nay' },
  ];

  const today = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <DashboardLayout breadcrumbs={BREADCRUMBS}>
      {/* ── Header ──────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.farmTitle}>Lịch công việc hôm nay</h1>
          <p className={styles.farmSub}>{today} · {doneCount}/{tasks.length} việc hoàn thành</p>
        </div>
        <div className={styles.headerActions}>
          {/* Voice Entry button – sẵn sàng cho Sprint 3 */}
          <Button
            variant={voiceActive ? 'danger' : 'green'}
            size="sm"
            onClick={() => setVoiceActive(v => !v)}
            aria-label="Nhập liệu bằng giọng nói"
          >
            <Mic size={14} />
            {voiceActive ? 'Đang nghe...' : 'Nhập bằng giọng nói'}
          </Button>
          <Button variant="secondary" size="sm">
            <ClipboardList size={14} />
            Ghi nhật ký
          </Button>
        </div>
      </div>

      {/* ── Tiến độ hôm nay ─────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 'var(--sp-md)', marginBottom: 'var(--sp-lg)' }}>
        <div className={styles.statCard} style={{ flex: 1 }}>
          <div className={styles.statHeader}>
            <span className={styles.statTitle}>Đã hoàn thành</span>
            <CheckCircle size={18} color="var(--color-farm-green)" />
          </div>
          <div className={styles.statValue} style={{ color: 'var(--color-farm-green)' }}>{doneCount} việc</div>
        </div>
        <div className={styles.statCard} style={{ flex: 1 }}>
          <div className={styles.statHeader}>
            <span className={styles.statTitle}>Còn lại</span>
            <Clock size={18} color="var(--color-farm-orange)" />
          </div>
          <div className={styles.statValue} style={{ color: 'var(--color-farm-orange)' }}>{pendingCount} việc</div>
        </div>
        <div className={styles.statCard} style={{ flex: 1 }}>
          <div className={styles.statHeader}>
            <span className={styles.statTitle}>Việc ưu tiên cao</span>
            <AlertTriangle size={18} color="var(--color-farm-red)" />
          </div>
          <div className={styles.statValue} style={{ color: 'var(--color-farm-red)' }}>
            {tasks.filter(t => t.priority === 'Cao' && t.status === 'pending').length} việc
          </div>
        </div>
      </div>

      {/* ── Danh sách công việc ──────────────────────────────── */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionCardHeader}>
          <span className={styles.sectionTitle}>Danh sách công việc</span>
        </div>
        <div className={styles.taskList}>
          {tasks.map(task => (
            <div
              key={task.id}
              className={styles.taskItem}
              style={{ opacity: task.status === 'done' ? 0.6 : 1 }}
            >
              <div style={{
                marginTop: '2px',
                color: task.status === 'done' ? 'var(--color-farm-green)' : 'var(--color-muted)',
                flexShrink: 0,
              }}>
                {task.status === 'done'
                  ? <CheckCircle size={20} />
                  : <Clock size={20} />
                }
              </div>

              <div className={styles.taskContent} style={{ flex: 1 }}>
                <div className={styles.taskTitle}
                  style={{ textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>
                  {task.title}
                </div>
                <div className={styles.taskDesc}>{task.desc}</div>
                <div className={styles.taskMeta}>
                  <span>⏰ {task.time}</span>
                  <span>·</span>
                  <span>📍 {task.barn}</span>
                  <span>·</span>
                  <span className={`${styles.pill} ${task.priority === 'Cao' ? styles.pillWarning : styles.pillNeutral}`}>
                    {task.priority}
                  </span>
                </div>
              </div>

              {task.status === 'pending' && (
                <Button variant="green" size="sm" onClick={() => markDone(task.id)}>
                  Hoàn thành
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};
