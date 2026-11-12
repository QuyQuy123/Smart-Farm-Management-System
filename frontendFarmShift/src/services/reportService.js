import { api } from '../utils/api';

/**
 * Báo cáo & Thống kê toàn diện trang trại (9 phân hệ).
 * Hỗ trợ lọc khoảng ngày theo ISO YYYY-MM-DD: { from, to }.
 */
export const getReportSummary = async (params = {}) => {
  const cleanParams = {};
  if (params?.from) cleanParams.from = params.from;
  if (params?.to) cleanParams.to = params.to;
  const res = await api.get('/reports/summary', {
    params: cleanParams,
    forceRefresh: Boolean(params?.forceRefresh),
  });
  return res?.data?.data ?? null;
};

