// src/services/dashboardService.js
import { api } from '../utils/api';

/**
 * MOCK DASHBOARD SERVICE
 * Since the backend endpoints for dashboard data do not exist yet,
 * these functions simulate API calls returning structured data.
 * 
 * To switch to real data later, simply uncomment the `api.get` calls
 * and remove the `Simulate delay` Promise blocks.
 */

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const getOwnerDashboardData = async () => {
  // Real implementation will be:
  // const response = await api.get('/dashboard/owner');
  // return response.data;

  await delay(800); // Simulate network latency

  return {
    metrics: {
      revenue: '$14,500',
      revenueChange: '+12%',
      expenses: '$3,200',
      expensesChange: '-4%',
      activeWorkers: 12,
      activeWorkersChange: '0%',
      livestockCount: 350,
      livestockChange: '+15'
    },
    recentActivities: [
      { id: 1, type: 'Sale', desc: 'Sold 50 units of Corn to AggCo', amount: '+$1,200', date: 'Today, 09:30 AM', status: 'completed' },
      { id: 2, type: 'Expense', desc: 'Purchased 20 bags of Fertilizer', amount: '-$400', date: 'Yesterday, 14:15 PM', status: 'completed' },
      { id: 3, type: 'Task', desc: 'Barn A repair completed by John', amount: '-', date: 'Yesterday, 16:00 PM', status: 'completed' },
    ]
  };
};

export const getAccountantDashboardData = async () => {
  // Real implementation will be:
  // const response = await api.get('/dashboard/accountant');
  // return response.data;

  await delay(800);

  return {
    metrics: {
      totalCash: '$42,000',
      totalCashChange: '+5%',
      pendingInvoices: 4,
      pendingInvoicesChange: '-2',
      monthlyBurn: '$8,500',
      monthlyBurnChange: '+1%'
    },
    transactions: [
      { id: 'TRX-001', date: '2024-10-24', category: 'Sales', description: 'Harvest Q3 Sale', amount: '+$12,000', status: 'Cleared' },
      { id: 'TRX-002', date: '2024-10-23', category: 'Equipment', description: 'Tractor Maintenance', amount: '-$1,200', status: 'Cleared' },
      { id: 'TRX-003', date: '2024-10-22', category: 'Payroll', description: 'October Wages', amount: '-$5,400', status: 'Pending' },
      { id: 'TRX-004', date: '2024-10-20', category: 'Supplies', description: 'Seed & Fertilizer', amount: '-$2,100', status: 'Cleared' },
    ]
  };
};

export const getWorkerDashboardData = async () => {
  // Real implementation will be:
  // const response = await api.get('/dashboard/worker');
  // return response.data;

  await delay(800);

  return {
    tasks: [
      { id: 1, title: 'Inspect Barn C Ventilation', desc: 'Check fan motors and clear debris from intake vents.', priority: 'High', status: 'pending', time: '08:00 AM' },
      { id: 2, title: 'Feed Livestock (Sector 2)', desc: 'Standard morning ratio. Check water troughs.', priority: 'Normal', status: 'in_progress', time: '09:30 AM' },
      { id: 3, title: 'Tractor T-4 Oil Change', desc: 'Routine maintenance at 500 hours.', priority: 'Low', status: 'pending', time: '14:00 PM' },
    ]
  };
};
