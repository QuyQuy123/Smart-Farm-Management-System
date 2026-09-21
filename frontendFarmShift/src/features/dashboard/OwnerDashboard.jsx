import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { getOwnerDashboardData } from '../../services/dashboardService';
import { TrendingUp, TrendingDown, DollarSign, Users, Tractor } from 'lucide-react';
import styles from './Dashboard.module.css';

export const OwnerDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await getOwnerDashboardData();
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
      <DashboardLayout title="Overview">
        <div style={{ color: 'var(--color-muted)' }}>Loading dashboard metrics...</div>
      </DashboardLayout>
    );
  }

  const { metrics, recentActivities } = data;

  return (
    <DashboardLayout title="Overview">
      {/* Metrics Grid */}
      <div className={`${styles.grid} ${styles.gridCols4}`}>
        
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statTitle}>Total Revenue</span>
            <div className={styles.statIcon}><DollarSign size={18} /></div>
          </div>
          <div className={styles.statValue}>{metrics.revenue}</div>
          <div className={`${styles.statChange} ${metrics.revenueChange.startsWith('+') ? styles.positive : styles.negative}`}>
            {metrics.revenueChange.startsWith('+') ? <TrendingUp size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }}/> : <TrendingDown size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }}/>} {metrics.revenueChange} vs last month
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statTitle}>Expenses</span>
            <div className={styles.statIcon}><DollarSign size={18} /></div>
          </div>
          <div className={styles.statValue}>{metrics.expenses}</div>
          <div className={`${styles.statChange} ${metrics.expensesChange.startsWith('-') ? styles.positive : styles.negative}`}>
            {metrics.expensesChange} vs last month
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statTitle}>Active Workers</span>
            <div className={styles.statIcon}><Users size={18} /></div>
          </div>
          <div className={styles.statValue}>{metrics.activeWorkers}</div>
          <div className={`${styles.statChange} ${styles.positive}`}>
            Stable staffing
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statTitle}>Livestock Count</span>
            <div className={styles.statIcon}><Tractor size={18} /></div>
          </div>
          <div className={styles.statValue}>{metrics.livestockCount}</div>
          <div className={`${styles.statChange} ${metrics.livestockChange.startsWith('+') ? styles.positive : styles.negative}`}>
            {metrics.livestockChange} vs last month
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Recent Activities</h2>
        </div>
        
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentActivities.map(activity => (
                <tr key={activity.id}>
                  <td>{activity.date}</td>
                  <td>{activity.type}</td>
                  <td>{activity.desc}</td>
                  <td style={{ 
                    color: activity.amount.startsWith('+') ? 'var(--color-success)' : 
                           activity.amount.startsWith('-') ? 'var(--color-ink)' : 'var(--color-muted)',
                    fontWeight: '500'
                  }}>
                    {activity.amount}
                  </td>
                  <td>
                    <span className={`${styles.pill} ${styles.pillSuccess}`}>
                      {activity.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
};
