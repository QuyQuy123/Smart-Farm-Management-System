import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { getAccountantDashboardData } from '../../services/dashboardService';
import { DollarSign, FileText, Activity } from 'lucide-react';
import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import styles from './Dashboard.module.css';

export const AccountantDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await getAccountantDashboardData();
        setData(result);
      } catch (error) {
        console.error("Failed to fetch dashboard data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const BREADCRUMBS = [
    { label: 'Tổng quan tài chính' },
  ];

  if (loading) {
    return (
      <DashboardLayout breadcrumbs={BREADCRUMBS}>
        <div style={{ color: 'var(--color-muted)', padding: 'var(--sp-xl)' }}>Đang tải dữ liệu tài chính...</div>
      </DashboardLayout>
    );
  }

  const { metrics, transactions } = data;

  return (
    <DashboardLayout breadcrumbs={BREADCRUMBS}>
      {/* Metrics Grid */}
      <div className={`${styles.grid} ${styles.gridCols3}`}>
        
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statTitle}>Total Cash (Operating)</span>
            <div className={styles.statIcon}><DollarSign size={18} /></div>
          </div>
          <div className={styles.statValue}>{metrics.totalCash}</div>
          <div className={`${styles.statChange} ${metrics.totalCashChange.startsWith('+') ? styles.positive : styles.negative}`}>
            {metrics.totalCashChange} vs last month
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statTitle}>Monthly Burn Rate</span>
            <div className={styles.statIcon}><Activity size={18} /></div>
          </div>
          <div className={styles.statValue}>{metrics.monthlyBurn}</div>
          <div className={`${styles.statChange} ${styles.negative}`}>
            {metrics.monthlyBurnChange} vs last month
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statTitle}>Pending Invoices</span>
            <div className={styles.statIcon}><FileText size={18} /></div>
          </div>
          <div className={styles.statValue}>{metrics.pendingInvoices}</div>
          <div className={`${styles.statChange} ${styles.positive}`}>
            {metrics.pendingInvoicesChange} resolved this week
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Recent Ledger Transactions</h2>
          <Button variant="secondary">Export CSV</Button>
        </div>
        
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>TRX ID</th>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(trx => (
                <tr key={trx.id}>
                  <td style={{ fontFamily: 'monospace', color: 'var(--color-muted)' }}>{trx.id}</td>
                  <td>{trx.date}</td>
                  <td>{trx.category}</td>
                  <td>{trx.description}</td>
                  <td style={{ 
                    color: trx.amount.startsWith('+') ? 'var(--color-success)' : 'var(--color-ink)',
                    fontWeight: '500'
                  }}>
                    {trx.amount}
                  </td>
                  <td>
                    <span className={`${styles.pill} ${trx.status === 'Cleared' ? styles.pillSuccess : styles.pillWarning}`}>
                      {trx.status}
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
