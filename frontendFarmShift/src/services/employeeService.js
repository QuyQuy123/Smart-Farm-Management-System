// src/services/employeeService.js
// Service kết nối API Quản lý Nhân sự (Employee Management) với Spring Boot Backend (/api/employees)
import { api } from '../utils/api';

/**
 * Lấy danh sách nhân viên kèm tìm kiếm keyword và bộ lọc role / isActive
 * Hỗ trợ AbortController signal để hủy request quá hạn khi search động
 * @param {Object} params
 * @param {string} [params.keyword] - Tìm kiếm theo họ tên, email, số điện thoại
 * @param {string} [params.role] - Mã hoặc tên vai trò (ví dụ: 'ROLE_ACCOUNTANT', 'ROLE_FARM_WORKER')
 * @param {boolean|string} [params.isActive] - Trạng thái hoạt động (true/false)
 * @param {Object} [options] - Cấu hình bổ sung (ví dụ: { signal: abortSignal })
 * @returns {Promise<Array>} Danh sách EmployeeResponse
 */
export const getEmployees = async (params = {}, options = {}) => {
  const cleanParams = {};
  if (params.keyword && params.keyword.trim()) {
    cleanParams.keyword = params.keyword.trim();
  }
  if (params.role && params.role !== 'ALL') {
    cleanParams.role = params.role;
  }
  if (params.isActive !== undefined && params.isActive !== null && params.isActive !== 'ALL' && params.isActive !== '') {
    cleanParams.isActive = params.isActive;
  }

  const response = await api.get('/employees', {
    params: cleanParams,
    signal: options.signal
  });
  const data = response.data?.data;
  return Array.isArray(data) ? data : [];
};

/**
 * Lấy thống kê tổng hợp nhân sự đa luồng (real-time metrics)
 * @returns {Promise<Object>} EmployeeSearchSummary
 */
export const getEmployeeSummary = async () => {
  const response = await api.get('/employees/summary');
  return response.data?.data || null;
};

/**
 * Lấy thông tin chi tiết một nhân viên theo ID
 * @param {number|string} id - Account ID của nhân viên
 * @returns {Promise<Object>} EmployeeResponse
 */
export const getEmployeeById = async (id) => {
  const response = await api.get(`/employees/${id}`);
  return response.data?.data || response.data;
};

/**
 * Tạo mới nhân viên (Chủ trại Owner tạo và gán quyền)
 * @param {Object} employeeData - { fullName, email, phone, password, roleName, avatarUrl }
 * @returns {Promise<Object>} EmployeeResponse đã tạo
 */
export const createEmployee = async (employeeData) => {
  const response = await api.post('/employees', employeeData);
  return response.data?.data || response.data;
};

/**
 * Cập nhật thông tin nhân viên, đổi phân quyền Role hoặc bật/tắt isActive
 * @param {number|string} id - Account ID
 * @param {Object} updateData - { fullName, email, phone, roleName, isActive, avatarUrl }
 * @returns {Promise<Object>} EmployeeResponse đã cập nhật
 */
export const updateEmployee = async (id, updateData) => {
  const response = await api.put(`/employees/${id}`, updateData);
  return response.data?.data || response.data;
};

export default {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
};
