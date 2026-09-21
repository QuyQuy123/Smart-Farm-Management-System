import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { getWorkerDashboardData } from '../../services/dashboardService';
import { Clock, CheckCircle, AlertCircle } from 'lucide-react';
import styles from './Dashboard.module.css';
import { Button } from '../../components/Button/Button';

export const WorkerDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await getWorkerDashboardData();
        setData(result);
      } catch (error) {
        console.error("Failed to fetch dashboard data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <DashboardLayout title="My Tasks">
        <div style={{ color: 'var(--color-muted)' }}>Loading your schedule...</div>
      </DashboardLayout>
    );
  }

  const { tasks } = data;

  return (
    <DashboardLayout title="My Tasks">
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Today's Schedule</h2>
          <Button>Log New Activity</Button>
        </div>
        
        <div className={styles.taskList}>
          {tasks.map(task => (
            <div key={task.id} className={styles.taskItem}>
              <div style={{ marginTop: '2px', color: task.status === 'pending' ? 'var(--color-muted)' : 'var(--color-success)' }}>
                {task.status === 'pending' ? <Clock size={20} /> : <CheckCircle size={20} />}
              </div>
              <div className={styles.taskContent}>
                <div className={styles.taskTitle}>{task.title}</div>
                <div className={styles.taskDesc}>{task.desc}</div>
                <div className={styles.taskMeta}>
                  <span>Scheduled: {task.time}</span>
                  <span>•</span>
                  <span className={`${styles.pill} ${task.priority === 'High' ? styles.pillWarning : styles.pillNeutral}`}>
                    {task.priority} Priority
                  </span>
                </div>
              </div>
              <div>
                <Button variant="secondary">Update</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};
