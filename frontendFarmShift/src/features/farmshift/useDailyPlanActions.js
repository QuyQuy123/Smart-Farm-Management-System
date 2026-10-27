import { useState } from 'react';
import { useNotification } from '../../context/NotificationContext';
import { confirmDailyTask, undoDailyTask } from '../../services/dailyPlanService';
import { checkWorkTask, uncheckWorkTask } from '../../services/workAssignmentService';
import { apiErrorMessage } from './farmAreaOptions';

/**
 * Xác nhận / hoàn tác việc trong phiếu việc. onPlanChanged nhận phiếu việc mới của chuồng do máy chủ trả về.
 * Mỗi hàm trả về thông báo lỗi để hiện ngay dưới việc đó, hoặc null khi thành công.
 */
export function useDailyPlanActions(onPlanChanged) {
  const { showToast } = useNotification();
  const [busyKey, setBusyKey] = useState(null);

  const run = async (plan, task, request, success) => {
    setBusyKey(`${plan.cycleId}:${task.key}`);
    try {
      onPlanChanged(await request());
      showToast(success, 'success');
      return null;
    } catch (error) {
      return apiErrorMessage(error);
    } finally {
      setBusyKey(null);
    }
  };

  const confirm = (plan, task, extra) => run(plan, task,
    () => confirmDailyTask(plan.cycleId, { date: plan.date, taskKey: task.key, ...extra }), `Đã xác nhận: ${task.name}.`);
  const undo = (plan, task) => run(plan, task, () => undoDailyTask(plan.cycleId, plan.date, task.key), `Đã hoàn tác: ${task.name}.`);

  // Việc được giao: máy chủ trả về việc vừa cập nhật, thay vào phiếu việc của chuồng.
  const withAssigned = (plan, updated) => ({ ...plan, assignedTasks: plan.assignedTasks.map(item => (item.id === updated.id ? updated : item)) });
  const confirmAssigned = (plan, task) => run(plan, { key: `A${task.id}` },
    async () => withAssigned(plan, await checkWorkTask(task.id, plan.date)), `Đã xác nhận: ${task.title}.`);
  const undoAssigned = (plan, task) => run(plan, { key: `A${task.id}` },
    async () => withAssigned(plan, await uncheckWorkTask(task.id, plan.date)), `Đã hoàn tác: ${task.title}.`);

  return { busyKey, confirm, undo, confirmAssigned, undoAssigned };
}
