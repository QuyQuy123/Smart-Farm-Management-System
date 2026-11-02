import { api } from '../utils/api';

/** Bảng tin trong ngày: số liệu chính, việc cần xử lý, thẻ chuồng, lịch 7 ngày tới (tiền chỉ có với chủ trại / kế toán). */
export const getDashboard = async (config = {}) => {
  const res = await api.get('/dashboard', config);
  return res?.data?.data ?? res?.data ?? res;
};
