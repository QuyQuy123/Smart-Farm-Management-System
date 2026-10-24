import { useState } from 'react';
import { useNotification } from '../../context/NotificationContext';
import { confirmDailyTask, undoDailyTask } from '../../services/dailyPlanService';
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

  return { busyKey, confirm, undo };
}
