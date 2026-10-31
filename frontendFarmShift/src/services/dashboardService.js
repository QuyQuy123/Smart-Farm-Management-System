import { api } from '../utils/api';

/** Bảng tin trong ngày: số liệu chính, việc cần xử lý, thẻ chuồng, lịch 7 ngày tới (tiền chỉ có với chủ trại / kế toán). */
export const getDashboard = async () => (await api.get('/dashboard')).data.data;
