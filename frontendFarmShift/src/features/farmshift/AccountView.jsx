// src/features/farmshift/AccountView.jsx
// Quản lý Tài khoản & Phân quyền Nhân sự chuẩn FarmShift & DESIGN.md
import React, { useState, useEffect, useRef } from 'react';
import {
  Users, Plus, Search, ShieldCheck, UserCheck,
  Building2, Crown, KeyRound, Edit2, X, CheckCircle, Camera,
  Eye, RefreshCw, AlertCircle, Shield
} from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { fileService } from '../../services/fileService';
import { getProfile, updateProfile, changePassword } from '../../services/userService';
import {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee
} from '../../services/employeeService';
import { getSystemMessage } from '../../utils/systemMessages';
import { AvatarCropperModal } from '../profile/AvatarCropperModal';

const ROLE_DISPLAY = {
  ROLE_FARM_OWNER: {
    label: 'Chủ trang trại (Owner)',
    badgeClass: 'farmshift-badge-neutral',
    barn: 'Toàn bộ trang trại'
  },
  ROLE_ACCOUNTANT: {
    label: 'Kế toán (Accountant)',
    badgeClass: 'farmshift-badge-info',
    barn: 'Sổ quỹ & Kho hàng'
  },
  ROLE_FARM_WORKER: {
    label: 'Công nhân trại (Worker)',
    badgeClass: 'farmshift-badge-success',
    barn: 'Khu chuồng chăn nuôi'
  }
};

// Hàm tự động đề xuất email chuẩn từ họ và tên tiếng Việt
export const generateEmailFromName = (fullName) => {
  if (!fullName || !fullName.trim()) return '';
  const clean = fullName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .join('');
  return clean ? `${clean}@smartfarm.com` : '';
};

export const AccountView = () => {
  const { user, updateUser } = useAuth();
  const { showToast } = useNotification();
  const [activeTab, setActiveTab] = useState('staff'); // 'staff' | 'profile' | 'security' | 'branches' | 'plan'

  // Staff List State
  const [staffList, setStaffList] = useState([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
  const [filterRole, setFilterRole] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Debounce search input dynamically (250ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Form Submissions
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Create Staff Form
  const [newStaff, setNewStaff] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    roleName: 'ROLE_FARM_WORKER',
    avatarUrl: ''
  });
  const [isEmailCustomized, setIsEmailCustomized] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Edit Staff Form
  const [editStaff, setEditStaff] = useState({
    id: null,
    fullName: '',
    email: '',
    phone: '',
    roleName: 'ROLE_FARM_WORKER',
    isActive: true,
    avatarUrl: ''
  });

  // Profile Form State initialized directly from auth user if available
  const [profileForm, setProfileForm] = useState(() => ({
    fullName: user?.fullName || user?.name || '',
    phone: user?.phone || '',
    citizenId: user?.citizenId || '',
    address: user?.address || '',
    dateOfBirth: user?.dateOfBirth || '',
    avatarUrl: user?.avatarUrl || ''
  }));
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [selectedImageToCrop, setSelectedImageToCrop] = useState(null);
  const [profileMessage, setProfileMessage] = useState({ type: '', text: '' });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const fileInputRef = useRef(null);

  // Password Change State
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Synchronize profile state when auth user changes
  const [prevUser, setPrevUser] = useState(user);
  if (user !== prevUser) {
    setPrevUser(user);
    if (user) {
      setProfileForm({
        fullName: user.fullName || user.name || '',
        phone: user.phone || '',
        citizenId: user.citizenId || '',
        address: user.address || '',
        dateOfBirth: user.dateOfBirth || '',
        avatarUrl: user.avatarUrl || ''
      });
    }
  }

  // Load fresh profile from backend on mount
  useEffect(() => {
    let isMounted = true;
    getProfile()
      .then(profile => {
        if (!isMounted || !profile) return;
        setProfileForm({
          fullName: profile.fullName || '',
          phone: profile.phone || '',
          citizenId: profile.citizenId || '',
          address: profile.address || '',
          dateOfBirth: profile.dateOfBirth || '',
          avatarUrl: profile.avatarUrl || ''
        });
        updateUser({
          name: profile.fullName,
          fullName: profile.fullName,
          phone: profile.phone || '',
          citizenId: profile.citizenId || '',
          address: profile.address || '',
          dateOfBirth: profile.dateOfBirth || '',
          avatarUrl: profile.avatarUrl || '',
          role: profile.role
        });
      })
      .catch(err => {
        console.warn('Could not load user profile in AccountView:', err.message);
      });

    return () => {
      isMounted = false;
    };
  }, [updateUser]);

  // Fetch employees from Backend API (/api/employees)
  const fetchStaffList = async () => {
    setIsLoadingStaff(true);
    try {
      const data = await getEmployees({
        keyword: searchTerm,
        role: filterRole,
        isActive: filterStatus
      });
      setStaffList(data);
    } catch (err) {
      console.warn('Backend employee fetch error:', err.message);
      // Giữ danh sách hiện có hoặc mảng rỗng
    } finally {
      setIsLoadingStaff(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    getEmployees({
      keyword: debouncedSearch,
      role: filterRole,
      isActive: filterStatus
    }, { signal: controller.signal })
      .then(data => {
        if (isMounted) setStaffList(data);
      })
      .catch(err => {
        if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED' || err?.name === 'AbortError') {
          return;
        }
        console.warn('Error loading employees:', err);
      })
      .finally(() => {
        if (isMounted && !controller.signal.aborted) {
          setIsLoadingStaff(false);
        }
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [debouncedSearch, filterRole, filterStatus]);

  // ── 1. Create Employee ──────────────────────────────────────────────────────
  const handleOpenAddModal = () => {
    setNewStaff({
      fullName: '',
      email: '',
      phone: '',
      password: '',
      roleName: 'ROLE_FARM_WORKER',
      avatarUrl: ''
    });
    setIsEmailCustomized(false);
    setFormError('');
    setShowPassword(false);
    setShowAddModal(true);
  };

  const handleFullNameChange = (name) => {
    setNewStaff(prev => {
      const updated = { ...prev, fullName: name };
      if (!isEmailCustomized) {
        updated.email = generateEmailFromName(name);
      }
      return updated;
    });
  };

  const handleEmailChange = (emailVal) => {
    setIsEmailCustomized(true);
    setNewStaff(prev => ({ ...prev, email: emailVal }));
  };

  const handleAutoSuggestEmail = () => {
    setIsEmailCustomized(false);
    setNewStaff(prev => ({
      ...prev,
      email: generateEmailFromName(prev.fullName)
    }));
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!newStaff.fullName.trim() || !newStaff.email.trim()) {
      setFormError(getSystemMessage('MSG02'));
      return;
    }

    // Default password to 123456 if left blank
    const finalPassword = newStaff.password && newStaff.password.trim() ? newStaff.password.trim() : '123456';

    if (finalPassword.length < 6) {
      setFormError('Mật khẩu khởi tạo phải từ 6 ký tự trở lên (hoặc để trống để lấy mặc định 123456).');
      return;
    }

    if (!['ROLE_ACCOUNTANT', 'ROLE_FARM_WORKER'].includes(newStaff.roleName)) {
      setFormError(getSystemMessage('MSG48'));
      return;
    }

    setIsSubmitting(true);
    try {
      await createEmployee({
        fullName: newStaff.fullName.trim(),
        email: newStaff.email.trim(),
        phone: newStaff.phone.trim() || null,
        password: finalPassword,
        roleName: newStaff.roleName,
        avatarUrl: newStaff.avatarUrl || null
      });

      showToast('MSG03', 'success');
      setShowAddModal(false);
      fetchStaffList();
    } catch (err) {
      const errorCode = err.response?.data?.errorCode;
      if (errorCode === 'MSG47') {
        const msg = getSystemMessage('MSG47');
        setFormError(msg);
        showToast('MSG47', 'error');
      } else if (errorCode === 'MSG48') {
        const msg = getSystemMessage('MSG48');
        setFormError(msg);
        showToast('MSG48', 'error');
      } else {
        const fallback = err.response?.data?.message || getSystemMessage('MSG04');
        setFormError(fallback);
        showToast('MSG04', 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── 2. View Employee Details ───────────────────────────────────────────────
  const handleViewDetails = async (employee) => {
    setSelectedEmployee(employee);
    setShowDetailModal(true);
    setIsLoadingDetail(true);
    try {
      const detail = await getEmployeeById(employee.id);
      setSelectedEmployee(detail);
    } catch (err) {
      console.warn('Could not load detailed employee info, using cached:', err.message);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // ── 3. Update Employee ─────────────────────────────────────────────────────
  const handleOpenEdit = (employee) => {
    setEditStaff({
      id: employee.id,
      fullName: employee.fullName || '',
      email: employee.email || '',
      phone: employee.phone || '',
      roleName: employee.roleName || 'ROLE_FARM_WORKER',
      isActive: employee.isActive !== undefined ? employee.isActive : true,
      avatarUrl: employee.avatarUrl || ''
    });
    setFormError('');
    setShowEditModal(true);
  };

  const handleUpdateStaff = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!editStaff.fullName.trim() || !editStaff.email.trim()) {
      setFormError(getSystemMessage('MSG02'));
      return;
    }

    setIsSubmitting(true);
    try {
      await updateEmployee(editStaff.id, {
        fullName: editStaff.fullName.trim(),
        email: editStaff.email.trim(),
        phone: editStaff.phone.trim() || null,
        roleName: editStaff.roleName,
        isActive: editStaff.isActive,
        avatarUrl: editStaff.avatarUrl || null
      });

      showToast('MSG03', 'success');
      setShowEditModal(false);
      fetchStaffList();
    } catch (err) {
      const errorCode = err.response?.data?.errorCode;
      if (errorCode === 'MSG47') {
        setFormError(getSystemMessage('MSG47'));
        showToast('MSG47', 'error');
      } else if (errorCode === 'MSG48') {
        setFormError(getSystemMessage('MSG48'));
        showToast('MSG48', 'error');
      } else if (errorCode === 'MSG05') {
        setFormError(getSystemMessage('MSG05'));
        showToast('MSG05', 'error');
      } else {
        const fallback = err.response?.data?.message || getSystemMessage('MSG04');
        setFormError(fallback);
        showToast('MSG04', 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Quick Status Toggle ────────────────────────────────────────────────────
  const handleQuickToggleActive = async (employee) => {
    if (employee.roleName === 'ROLE_FARM_OWNER') {
      showToast('MSG05', 'error');
      return;
    }

    const nextStatus = !employee.isActive;
    try {
      await updateEmployee(employee.id, {
        fullName: employee.fullName,
        email: employee.email,
        phone: employee.phone,
        roleName: employee.roleName,
        isActive: nextStatus
      });
      showToast('MSG03', 'success');
      fetchStaffList();
    } catch (err) {
      showToast(err.response?.data?.errorCode || 'MSG04', 'error');
    }
  };

  // ── Profile Actions ────────────────────────────────────────────────────────
  const handleAvatarFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setProfileMessage({ type: 'error', text: 'Kích thước ảnh không được vượt quá 10MB.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImageToCrop(reader.result?.toString() || '');
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCropComplete = async (croppedBase64, croppedFile) => {
    setSelectedImageToCrop(null);
    setProfileForm(prev => ({ ...prev, avatarUrl: croppedBase64 }));
    updateUser({ avatarUrl: croppedBase64 });

    if (croppedFile) {
      try {
        setUploadingAvatar(true);
        setProfileMessage({ type: '', text: '' });
        const url = await fileService.uploadFile(croppedFile, 'avatars');
        if (url) {
          setProfileForm(prev => ({ ...prev, avatarUrl: url }));
          updateUser({ avatarUrl: url });
        }
      } catch (err) {
        console.warn('Upload ảnh avatar lên storage thất bại, giữ preview:', err);
      } finally {
        setUploadingAvatar(false);
      }
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileMessage({ type: '', text: '' });
    try {
      const payload = {
        fullName: (profileForm.fullName || '').trim(),
        avatarUrl: profileForm.avatarUrl || null,
        phone: profileForm.phone?.trim() || null,
        citizenId: profileForm.citizenId?.trim() || null,
        address: profileForm.address?.trim() || null,
        dateOfBirth: profileForm.dateOfBirth || null
      };
      const updated = await updateProfile(payload);
      setProfileForm({
        fullName: updated.fullName || '',
        phone: updated.phone || '',
        citizenId: updated.citizenId || '',
        address: updated.address || '',
        dateOfBirth: updated.dateOfBirth || '',
        avatarUrl: updated.avatarUrl || ''
      });
      updateUser({
        name: updated.fullName,
        fullName: updated.fullName,
        phone: updated.phone || '',
        citizenId: updated.citizenId || '',
        address: updated.address || '',
        dateOfBirth: updated.dateOfBirth || '',
        avatarUrl: updated.avatarUrl || ''
      });
      setProfileMessage({ type: 'success', text: getSystemMessage('MSG13') });
      showToast('MSG13', 'success');
    } catch (err) {
      const errMsg = err.response?.data?.message || getSystemMessage('MSG04');
      setProfileMessage({ type: 'error', text: errMsg });
      showToast('MSG04', 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage({ type: 'error', text: getSystemMessage('MSG18') });
      showToast('MSG18', 'error');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: getSystemMessage('MSG17') });
      showToast('MSG17', 'error');
      return;
    }

    setIsChangingPassword(true);
    setPasswordMessage({ type: '', text: '' });
    try {
      await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordMessage({ type: 'success', text: getSystemMessage('MSG19') });
      showToast('MSG19', 'success');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Đổi mật khẩu thất bại. Kiểm tra lại mật khẩu cũ.';
      setPasswordMessage({ type: 'error', text: errMsg });
      showToast('MSG04', 'error');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <FarmShiftLayout
      pageTitle="Tài khoản & Phân quyền"
      breadcrumbs={[{ label: 'Tài khoản' }]}
      actions={
        activeTab === 'staff' && (
          <button
            className="farmshift-btn farmshift-btn-primary"
            onClick={handleOpenAddModal}
            id="btn-add-employee"
          >
            <Plus size={16} /> Thêm nhân viên
          </button>
        )
      }
    >
      <div className="farmshift-tabs">
        <button
          className={`farmshift-tab-btn ${activeTab === 'staff' ? 'active' : ''}`}
          onClick={() => setActiveTab('staff')}
        >
          <Users size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Danh sách nhân sự ({staffList.length})
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <UserCheck size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Hồ sơ cá nhân
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          <KeyRound size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Bảo mật
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'branches' ? 'active' : ''}`}
          onClick={() => setActiveTab('branches')}
        >
          <Building2 size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Danh sách cơ sở
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'plan' ? 'active' : ''}`}
          onClick={() => setActiveTab('plan')}
        >
          <Crown size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Gói dịch vụ
        </button>
      </div>

      {/* ── TAB 1: DANH SÁCH NHÂN SỰ ────────────────────────────────────────── */}
      {activeTab === 'staff' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="farmshift-card-title">Quản lý tài khoản nhân viên & phân quyền</h3>
            <button
              className="farmshift-btn farmshift-btn-secondary"
              onClick={fetchStaffList}
              disabled={isLoadingStaff}
              title="Làm mới danh sách"
              style={{ padding: '6px 12px', fontSize: '13px' }}
            >
              <RefreshCw size={14} className={isLoadingStaff ? 'farmshift-spin' : ''} />
              Làm mới
            </button>
          </div>

          {/* Toolbar: Search keyword & Filters */}
          <div className="farmshift-toolbar" style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-hairline)', margin: 0 }}>
            <div className="farmshift-search-box" style={{ width: '320px' }}>
              {isLoadingStaff ? (
                <RefreshCw size={16} className="farmshift-spin" style={{ color: 'var(--color-primary)' }} />
              ) : (
                <Search size={16} color="var(--color-muted)" />
              )}
              <input
                type="text"
                placeholder="Tìm theo tên, email, số điện thoại..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                id="search-employee-input"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', padding: 0 }}
                  title="Xóa tìm kiếm"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="farmshift-filter-group">
              <select
                className="farmshift-select"
                value={filterRole}
                onChange={e => setFilterRole(e.target.value)}
                id="filter-role-select"
              >
                <option value="ALL">Tất cả vai trò</option>
                <option value="ROLE_FARM_OWNER">Chủ trang trại</option>
                <option value="ROLE_ACCOUNTANT">Kế toán</option>
                <option value="ROLE_FARM_WORKER">Công nhân trại</option>
              </select>

              <select
                className="farmshift-select"
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                id="filter-status-select"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="true">Đang hoạt động</option>
                <option value="false">Tạm ngưng hoạt động</option>
              </select>
            </div>
          </div>

          {/* Table Container */}
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th>Nhân viên</th>
                  <th>Email</th>
                  <th>Số điện thoại</th>
                  <th>Vai trò phân quyền</th>
                  <th>Phạm vi phụ trách</th>
                  <th>Trạng thái</th>
                  <th style={{ textAlign: 'center', width: '130px' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingStaff ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--color-muted)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <RefreshCw size={18} className="farmshift-spin" />
                        <span>Đang tải danh sách nhân viên từ hệ thống...</span>
                      </div>
                    </td>
                  </tr>
                ) : staffList.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-muted)' }}>
                      <AlertCircle size={24} style={{ display: 'block', margin: '0 auto 8px', color: 'var(--color-muted)' }} />
                      <p style={{ margin: 0, fontWeight: 500 }}>{getSystemMessage('MSG01')}</p>
                      <p style={{ margin: '4px 0 0', fontSize: '13px' }}>Thử thay đổi từ khóa tìm kiếm hoặc bỏ bớt bộ lọc.</p>
                    </td>
                  </tr>
                ) : (
                  staffList.map(st => {
                    const roleInfo = ROLE_DISPLAY[st.roleName] || {
                      label: st.roleName || 'Nhân viên',
                      badgeClass: 'farmshift-badge-neutral',
                      barn: 'Khu chuồng trại'
                    };
                    const isOwner = st.roleName === 'ROLE_FARM_OWNER';

                    return (
                      <tr key={st.id || st.email}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '50%',
                              backgroundColor: 'var(--color-surface-soft)',
                              border: '1px solid var(--color-hairline)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                              fontWeight: 600,
                              color: 'var(--color-ink)',
                              fontSize: '13px'
                            }}>
                              {st.avatarUrl ? (
                                <img src={st.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                (st.fullName || st.email || 'U').charAt(0).toUpperCase()
                              )}
                            </div>
                            <div>
                              <strong style={{ color: 'var(--color-ink)', fontSize: '13.5px', display: 'block' }}>
                                {st.fullName || 'Chưa đặt tên'}
                              </strong>
                              {isOwner && (
                                <span style={{ fontSize: '11px', color: 'var(--color-signature-coral)', fontWeight: 600 }}>
                                  Chủ tài khoản chính
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ color: 'var(--color-body)', fontSize: '13px' }}>{st.email}</td>
                        <td style={{ color: 'var(--color-body)', fontSize: '13px' }}>{st.phone || '—'}</td>
                        <td>
                          <span className={`farmshift-badge ${roleInfo.badgeClass}`}>
                            {roleInfo.label}
                          </span>
                        </td>
                        <td style={{ color: 'var(--color-muted)', fontSize: '13px' }}>
                          {st.barnAssigned || roleInfo.barn}
                        </td>
                        <td>
                          <span
                            className={`farmshift-badge ${st.isActive ? 'farmshift-badge-success' : 'farmshift-badge-danger'}`}
                            style={{ cursor: isOwner ? 'default' : 'pointer' }}
                            onClick={() => !isOwner && handleQuickToggleActive(st)}
                            title={isOwner ? 'Tài khoản Chủ trại không thể vô hiệu hóa' : 'Bấm để đổi trạng thái'}
                          >
                            {st.isActive ? 'Đang hoạt động' : 'Đã tạm khóa'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <button
                              className="farmshift-btn farmshift-btn-secondary"
                              onClick={() => handleViewDetails(st)}
                              title="Xem chi tiết"
                              style={{ padding: '6px 8px' }}
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              className="farmshift-btn farmshift-btn-secondary"
                              onClick={() => handleOpenEdit(st)}
                              title="Chỉnh sửa & Phân quyền"
                              style={{ padding: '6px 8px' }}
                            >
                              <Edit2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 2: HỒ SƠ CÁ NHÂN ────────────────────────────────────────────── */}
      {activeTab === 'profile' && (
        <div className="farmshift-card" style={{ maxWidth: '800px' }}>
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Thông tin hồ sơ cá nhân</h3>
          </div>
          <div className="farmshift-card-body">
            {profileMessage.text && (
              <div style={{
                padding: '12px',
                marginBottom: '16px',
                borderRadius: 'var(--rounded-md)',
                backgroundColor: profileMessage.type === 'success' ? '#e6f4ea' : '#fce8e6',
                color: profileMessage.type === 'success' ? '#137333' : '#c5221f',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                {profileMessage.type === 'success' ? <CheckCircle size={16} /> : <ShieldCheck size={16} />}
                {profileMessage.text}
              </div>
            )}

            <form onSubmit={handleUpdateProfile}>
              <div style={{ display: 'flex', gap: '24px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '100px', height: '100px', borderRadius: '50%',
                    backgroundColor: 'var(--color-surface-soft)',
                    border: '1px solid var(--color-hairline)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    overflow: 'hidden', position: 'relative'
                  }}>
                    {profileForm.avatarUrl ? (
                      <img src={profileForm.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <UserCheck size={40} color="var(--color-muted)" />
                    )}
                    {uploadingAvatar && (
                      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: 'var(--color-primary)', fontWeight: 500 }}>Đang tải...</span>
                      </div>
                    )}
                  </div>
                  <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-primary)', fontWeight: 500 }}>
                    <Camera size={14} /> Thay đổi ảnh
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleAvatarFile}
                      disabled={uploadingAvatar}
                    />
                  </label>
                </div>

                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Họ và tên *</label>
                    <input
                      type="text"
                      required
                      className="farmshift-form-control"
                      value={profileForm.fullName}
                      onChange={e => setProfileForm({ ...profileForm, fullName: e.target.value })}
                    />
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Email tài khoản</label>
                    <input
                      type="email"
                      readOnly
                      className="farmshift-form-control"
                      style={{ backgroundColor: 'var(--color-surface-soft)', cursor: 'not-allowed' }}
                      value={user?.email || 'admin@farmshift.local'}
                    />
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Số điện thoại liên hệ</label>
                    <input
                      type="text"
                      className="farmshift-form-control"
                      value={profileForm.phone}
                      onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                    />
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Số CMND/CCCD</label>
                    <input
                      type="text"
                      className="farmshift-form-control"
                      value={profileForm.citizenId}
                      onChange={e => setProfileForm({ ...profileForm, citizenId: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Ngày sinh (YYYY-MM-DD)</label>
                  <input
                    type="date"
                    className="farmshift-form-control"
                    value={profileForm.dateOfBirth}
                    onChange={e => setProfileForm({ ...profileForm, dateOfBirth: e.target.value })}
                  />
                </div>
                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Địa chỉ hiện tại</label>
                  <input
                    type="text"
                    className="farmshift-form-control"
                    value={profileForm.address}
                    onChange={e => setProfileForm({ ...profileForm, address: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--color-hairline)', paddingTop: '16px' }}>
                <button
                  type="submit"
                  className="farmshift-btn farmshift-btn-primary"
                  disabled={isSavingProfile || uploadingAvatar}
                >
                  {isSavingProfile ? 'Đang lưu...' : 'Lưu thay đổi hồ sơ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── TAB 3: BẢO MẬT ─────────────────────────────────────────────────── */}
      {activeTab === 'security' && (
        <div className="farmshift-card" style={{ maxWidth: '500px' }}>
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Đổi mật khẩu bảo mật</h3>
          </div>
          <div className="farmshift-card-body">
            {passwordMessage.text && (
              <div style={{
                padding: '12px',
                marginBottom: '16px',
                borderRadius: 'var(--rounded-md)',
                backgroundColor: passwordMessage.type === 'success' ? '#e6f4ea' : '#fce8e6',
                color: passwordMessage.type === 'success' ? '#137333' : '#c5221f',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                {passwordMessage.type === 'success' ? <CheckCircle size={16} /> : <ShieldCheck size={16} />}
                {passwordMessage.text}
              </div>
            )}

            <form onSubmit={handleChangePassword}>
              <div className="farmshift-form-group">
                <label className="farmshift-form-label">Mật khẩu hiện tại *</label>
                <input
                  type="password"
                  required
                  className="farmshift-form-control"
                  placeholder="Nhập mật khẩu đang dùng"
                  value={passwordForm.currentPassword}
                  onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                />
              </div>
              <div className="farmshift-form-group">
                <label className="farmshift-form-label">Mật khẩu mới *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  className="farmshift-form-control"
                  placeholder="Tối thiểu 8 ký tự"
                  value={passwordForm.newPassword}
                  onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                />
              </div>
              <div className="farmshift-form-group">
                <label className="farmshift-form-label">Xác nhận mật khẩu mới *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  className="farmshift-form-control"
                  placeholder="Nhập lại mật khẩu mới"
                  value={passwordForm.confirmPassword}
                  onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                />
              </div>
              <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--color-hairline)', paddingTop: '16px' }}>
                <button
                  type="submit"
                  className="farmshift-btn farmshift-btn-primary"
                  disabled={isChangingPassword}
                >
                  {isChangingPassword ? 'Đang xử lý...' : 'Cập nhật mật khẩu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── TAB 4: CƠ SỞ ───────────────────────────────────────────────────── */}
      {activeTab === 'branches' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Cơ sở trang trại đang quản lý</h3>
          </div>
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th>Tên cơ sở</th>
                  <th>Chủ hộ / Đại diện</th>
                  <th>Địa chỉ</th>
                  <th>Quy mô tổng</th>
                  <th>Số khu trại</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong style={{ color: 'var(--color-ink)' }}>Trang trại gà đẻ Miến Bình</strong></td>
                  <td>Miến Bình</td>
                  <td>Vĩnh Phúc</td>
                  <td>15,000 con gà thịt</td>
                  <td>4 khu nuôi (10 chuồng)</td>
                  <td><span className="farmshift-badge farmshift-badge-success">Đang hoạt động</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 5: GÓI DỊCH VỤ ─────────────────────────────────────────────── */}
      {activeTab === 'plan' && (
        <div className="farmshift-card" style={{ maxWidth: '650px' }}>
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)' }}>
              <Crown size={18} /> Gói dịch vụ FarmShift Enterprise
            </h3>
          </div>
          <div className="farmshift-card-body">
            <div style={{ backgroundColor: 'var(--color-surface-soft)', border: '1px solid var(--color-hairline)', padding: '16px', borderRadius: 'var(--rounded-md)', marginBottom: '16px' }}>
              <strong style={{ color: 'var(--color-ink)', fontSize: '16px' }}>FarmShift Chuyên Biệt Gia Cầm — Bản Quyền Vĩnh Viễn</strong>
              <div style={{ fontSize: '13px', color: 'var(--color-muted)', marginTop: '4px' }}>
                Hạn sử dụng: <strong>Không giới hạn (Đã kích hoạt cho Trang trại Miến Bình)</strong>
              </div>
            </div>
            <ul style={{ fontSize: '13.5px', color: 'var(--color-body)', lineHeight: 1.8 }}>
              <li>✓ Quản lý không giới hạn số lượng đàn và chuồng nuôi</li>
              <li>✓ Tích hợp cảm biến IoT nhiệt độ, độ ẩm cảnh báo Real-time</li>
              <li>✓ Tích hợp AI OCR bóc tách phiếu kê bán và hóa đơn A4 tự động</li>
              <li>✓ Trợ lý AI hỏi đáp thú y và nhận dạng bệnh qua triệu chứng</li>
              <li>✓ Phân quyền đa vai trò bảo mật: Chủ trại, Kế toán, Công nhân</li>
              <li>✓ Đồng bộ sao lưu đám mây an toàn</li>
            </ul>
          </div>
        </div>
      )}

      {/* ── MODAL 1: CREATE EMPLOYEE ──────────────────────────────────────── */}
      {showAddModal && (
        <div className="farmshift-modal-backdrop">
          <div className="farmshift-modal" style={{ maxWidth: '540px' }}>
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title">Thêm mới nhân viên</h3>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateStaff}>
              <div className="farmshift-modal-body">
                {formError && (
                  <div style={{
                    padding: '10px 14px',
                    marginBottom: '16px',
                    borderRadius: 'var(--rounded-md)',
                    backgroundColor: '#fce8e6',
                    color: '#c5221f',
                    fontSize: '13.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <AlertCircle size={16} />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Họ và tên nhân viên *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Trần Văn Kế Toán, Lê Văn Công..."
                    className="farmshift-form-control"
                    value={newStaff.fullName}
                    onChange={e => handleFullNameChange(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="farmshift-form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label className="farmshift-form-label" style={{ margin: 0 }}>Email đăng nhập *</label>
                      {isEmailCustomized && newStaff.fullName.trim() && (
                        <button
                          type="button"
                          onClick={handleAutoSuggestEmail}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--color-primary)',
                            fontSize: '11.5px',
                            fontWeight: 500,
                            padding: 0
                          }}
                          title="Tạo lại email theo họ tên"
                        >
                          ↻ Đề xuất lại
                        </button>
                      )}
                    </div>
                    <input
                      type="email"
                      required
                      placeholder="nhanvien@smartfarm.com"
                      className="farmshift-form-control"
                      value={newStaff.email}
                      onChange={e => handleEmailChange(e.target.value)}
                    />
                    {!isEmailCustomized && newStaff.email && (
                      <span style={{ fontSize: '11.5px', color: 'var(--color-muted)', marginTop: '4px', display: 'block' }}>
                        ✨ Đề xuất tự động (sửa tùy ý)
                      </span>
                    )}
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Số điện thoại</label>
                    <input
                      type="text"
                      placeholder="0988..."
                      className="farmshift-form-control"
                      value={newStaff.phone}
                      onChange={e => setNewStaff({ ...newStaff, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Phân quyền vai trò *</label>
                    <select
                      className="farmshift-form-control"
                      value={newStaff.roleName}
                      onChange={e => setNewStaff({ ...newStaff, roleName: e.target.value })}
                    >
                      <option value="ROLE_FARM_WORKER">Công nhân trại (Worker)</option>
                      <option value="ROLE_ACCOUNTANT">Kế toán (Accountant)</option>
                    </select>
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Mật khẩu khởi tạo</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Mặc định: 123456 (nếu để trống)"
                        className="farmshift-form-control"
                        style={{ paddingRight: '36px' }}
                        value={newStaff.password}
                        onChange={e => setNewStaff({ ...newStaff, password: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--color-muted)'
                        }}
                        title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      >
                        {showPassword ? <Eye size={15} /> : <KeyRound size={15} />}
                      </button>
                    </div>
                    <span style={{ fontSize: '11.5px', color: 'var(--color-muted)', marginTop: '4px', display: 'block' }}>
                      💡 Để trống sẽ lấy mặc định là <strong>123456</strong>
                    </span>
                  </div>
                </div>
              </div>
              <div className="farmshift-modal-footer">
                <button
                  type="button"
                  className="farmshift-btn farmshift-btn-secondary"
                  onClick={() => setShowAddModal(false)}
                  disabled={isSubmitting}
                >
                  Đóng lại
                </button>
                <button
                  type="submit"
                  className="farmshift-btn farmshift-btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Đang tạo...' : 'Tạo tài khoản & Lưu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: VIEW EMPLOYEE DETAILS ─────────────────────────────────── */}
      {showDetailModal && selectedEmployee && (
        <div className="farmshift-modal-backdrop">
          <div className="farmshift-modal" style={{ maxWidth: '580px' }}>
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title">Thông tin chi tiết nhân sự</h3>
              <button
                onClick={() => setShowDetailModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="farmshift-modal-body">
              {isLoadingDetail ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-muted)' }}>
                  <RefreshCw size={18} className="farmshift-spin" />
                  <p style={{ marginTop: '8px' }}>Đang nạp chi tiết...</p>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--color-hairline)' }}>
                    <div style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--color-surface-soft)',
                      border: '1px solid var(--color-hairline)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      fontWeight: 700,
                      fontSize: '22px',
                      color: 'var(--color-ink)'
                    }}>
                      {selectedEmployee.avatarUrl ? (
                        <img src={selectedEmployee.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        (selectedEmployee.fullName || selectedEmployee.email || 'U').charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '18px', color: 'var(--color-ink)' }}>
                        {selectedEmployee.fullName || 'Chưa đặt tên'}
                      </h4>
                      <p style={{ margin: '4px 0 0', color: 'var(--color-muted)', fontSize: '13.5px' }}>
                        {selectedEmployee.email}
                      </p>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                        <span className={`farmshift-badge ${(ROLE_DISPLAY[selectedEmployee.roleName] || {}).badgeClass || 'farmshift-badge-neutral'}`}>
                          {(ROLE_DISPLAY[selectedEmployee.roleName] || {}).label || selectedEmployee.roleName}
                        </span>
                        <span className={`farmshift-badge ${selectedEmployee.isActive ? 'farmshift-badge-success' : 'farmshift-badge-danger'}`}>
                          {selectedEmployee.isActive ? 'Đang hoạt động' : 'Tạm khóa'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13.5px' }}>
                    <div>
                      <span style={{ color: 'var(--color-muted)', display: 'block', fontSize: '12px' }}>Mã nhân viên (ID):</span>
                      <strong style={{ color: 'var(--color-ink)' }}>#{selectedEmployee.id}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-muted)', display: 'block', fontSize: '12px' }}>Số điện thoại:</span>
                      <strong style={{ color: 'var(--color-ink)' }}>{selectedEmployee.phone || 'Chưa cập nhật'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-muted)', display: 'block', fontSize: '12px' }}>Số CMND / Căn cước:</span>
                      <strong style={{ color: 'var(--color-ink)' }}>{selectedEmployee.citizenId || 'Chưa cập nhật'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-muted)', display: 'block', fontSize: '12px' }}>Ngày sinh:</span>
                      <strong style={{ color: 'var(--color-ink)' }}>{selectedEmployee.dateOfBirth || 'Chưa cập nhật'}</strong>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ color: 'var(--color-muted)', display: 'block', fontSize: '12px' }}>Địa chỉ cư trú:</span>
                      <strong style={{ color: 'var(--color-ink)' }}>{selectedEmployee.address || 'Chưa cập nhật'}</strong>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ color: 'var(--color-muted)', display: 'block', fontSize: '12px' }}>Mô tả vai trò & phạm vi:</span>
                      <p style={{ margin: '4px 0 0', color: 'var(--color-body)', backgroundColor: 'var(--color-surface-soft)', padding: '10px', borderRadius: 'var(--rounded-sm)', border: '1px solid var(--color-hairline)' }}>
                        {selectedEmployee.roleDescription || (ROLE_DISPLAY[selectedEmployee.roleName] || {}).barn || 'Nhân sự thực hiện các nghiệp vụ được phân công trong phân hệ.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="farmshift-modal-footer">
              <button
                type="button"
                className="farmshift-btn farmshift-btn-secondary"
                onClick={() => setShowDetailModal(false)}
              >
                Đóng
              </button>
              <button
                type="button"
                className="farmshift-btn farmshift-btn-primary"
                onClick={() => {
                  setShowDetailModal(false);
                  handleOpenEdit(selectedEmployee);
                }}
              >
                <Edit2 size={14} /> Chỉnh sửa thông tin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 3: UPDATE EMPLOYEE & ROLE ───────────────────────────────── */}
      {showEditModal && (
        <div className="farmshift-modal-backdrop">
          <div className="farmshift-modal" style={{ maxWidth: '540px' }}>
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title">Chỉnh sửa & Phân quyền nhân viên</h3>
              <button
                onClick={() => setShowEditModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUpdateStaff}>
              <div className="farmshift-modal-body">
                {formError && (
                  <div style={{
                    padding: '10px 14px',
                    marginBottom: '16px',
                    borderRadius: 'var(--rounded-md)',
                    backgroundColor: '#fce8e6',
                    color: '#c5221f',
                    fontSize: '13.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <AlertCircle size={16} />
                    <span>{formError}</span>
                  </div>
                )}

                {editStaff.roleName === 'ROLE_FARM_OWNER' && (
                  <div style={{
                    padding: '10px 14px',
                    marginBottom: '16px',
                    borderRadius: 'var(--rounded-md)',
                    backgroundColor: '#fef3c7',
                    color: '#b45309',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <Shield size={16} />
                    <span>Tài khoản Chủ trang trại được bảo vệ: Không thể đổi vai trò hoặc vô hiệu hóa.</span>
                  </div>
                )}

                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Họ và tên *</label>
                  <input
                    type="text"
                    required
                    className="farmshift-form-control"
                    value={editStaff.fullName}
                    onChange={e => setEditStaff({ ...editStaff, fullName: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Email tài khoản *</label>
                    <input
                      type="email"
                      required
                      className="farmshift-form-control"
                      value={editStaff.email}
                      onChange={e => setEditStaff({ ...editStaff, email: e.target.value })}
                    />
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Số điện thoại</label>
                    <input
                      type="text"
                      className="farmshift-form-control"
                      value={editStaff.phone}
                      onChange={e => setEditStaff({ ...editStaff, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Vai trò phân quyền</label>
                    <select
                      className="farmshift-form-control"
                      value={editStaff.roleName}
                      disabled={editStaff.roleName === 'ROLE_FARM_OWNER'}
                      onChange={e => setEditStaff({ ...editStaff, roleName: e.target.value })}
                      style={editStaff.roleName === 'ROLE_FARM_OWNER' ? { backgroundColor: 'var(--color-surface-soft)', cursor: 'not-allowed' } : {}}
                    >
                      {editStaff.roleName === 'ROLE_FARM_OWNER' ? (
                        <option value="ROLE_FARM_OWNER">Chủ trang trại (Owner)</option>
                      ) : (
                        <>
                          <option value="ROLE_FARM_WORKER">Công nhân trại (Worker)</option>
                          <option value="ROLE_ACCOUNTANT">Kế toán (Accountant)</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Trạng thái hoạt động</label>
                    <select
                      className="farmshift-form-control"
                      value={editStaff.isActive ? 'true' : 'false'}
                      disabled={editStaff.roleName === 'ROLE_FARM_OWNER'}
                      onChange={e => setEditStaff({ ...editStaff, isActive: e.target.value === 'true' })}
                      style={editStaff.roleName === 'ROLE_FARM_OWNER' ? { backgroundColor: 'var(--color-surface-soft)', cursor: 'not-allowed' } : {}}
                    >
                      <option value="true">Đang hoạt động</option>
                      <option value="false">Tạm ngưng hoạt động</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="farmshift-modal-footer">
                <button
                  type="button"
                  className="farmshift-btn farmshift-btn-secondary"
                  onClick={() => setShowEditModal(false)}
                  disabled={isSubmitting}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="farmshift-btn farmshift-btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedImageToCrop && (
        <AvatarCropperModal
          imageSrc={selectedImageToCrop}
          onClose={() => setSelectedImageToCrop(null)}
          onCropComplete={handleCropComplete}
        />
      )}
    </FarmShiftLayout>
  );
};
