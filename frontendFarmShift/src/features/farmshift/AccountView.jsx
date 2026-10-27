// src/features/farmshift/AccountView.jsx
// Quản lý Tài khoản & Phân quyền Nhân sự chuẩn FarmShift & DESIGN.md
import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Users, Plus, Search, ShieldCheck, UserCheck,
  KeyRound, Edit2, X, CheckCircle, Camera,
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
import { AvatarPreviewModal } from '../profile/AvatarPreviewModal';
import { ButtonSpinner } from '../../components/Loading/ButtonSpinner';
import { PasswordInput } from '../../components/PasswordInput/PasswordInput';
import employeeFormStyles from './EmployeeForm.module.css';

const ROLE_DISPLAY = {
  ROLE_FARM_OWNER: {
    label: 'Chủ trang trại',
    badgeClass: 'farmshift-badge-neutral',
    barn: 'Toàn bộ trang trại'
  },
  ROLE_ACCOUNTANT: {
    label: 'Kế toán',
    badgeClass: 'farmshift-badge-neutral',
    barn: 'Sổ quỹ & Kho hàng'
  },
  ROLE_FARM_WORKER: {
    label: 'Công nhân trại',
    badgeClass: 'farmshift-badge-neutral',
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

// Dynamic Field Validation for Personal Profile (Real-time FE Validation)
export const validateProfileField = (field, value, allValues = {}) => {
  const val = value !== undefined && value !== null ? String(value).trim() : '';

  switch (field) {
    case 'fullName':
      if (!val) {
        return 'Họ và tên là bắt buộc, không được để trống.';
      }
      if (val.length < 2) {
        return 'Họ và tên phải có ít nhất 2 ký tự.';
      }
      if (val.length > 100) {
        return 'Họ và tên không được vượt quá 100 ký tự.';
      }
      return '';

    case 'phone':
      if (!val) return ''; // Optional
      if (!/^\d+$/.test(val)) {
        return 'Số điện thoại chỉ được chứa các chữ số (0-9).';
      }
      if (val.length < 10 || val.length > 11) {
        return `Số điện thoại phải gồm 10 hoặc 11 chữ số (hiện tại: ${val.length} số).`;
      }
      if (!/^0/.test(val)) {
        return 'Số điện thoại hợp lệ cần bắt đầu bằng số 0 (VD: 0966...).';
      }
      return '';

    case 'citizenId':
      if (!val) return ''; // Optional
      if (!/^\d+$/.test(val)) {
        return 'Số CMND/CCCD chỉ được chứa các chữ số (0-9).';
      }
      if (val.length !== 9 && val.length !== 12) {
        return `Số CMND/CCCD phải gồm đúng 9 chữ số (CMND) hoặc 12 chữ số (CCCD). Hiện tại: ${val.length} số.`;
      }
      return '';

    case 'dateOfBirth': {
      if (!val) return ''; // Optional
      const birthDate = new Date(val);
      if (isNaN(birthDate.getTime())) {
        return 'Định dạng ngày sinh không hợp lệ.';
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (birthDate >= today) {
        return 'Ngày sinh phải ở trong quá khứ (trước ngày hôm nay).';
      }
      if (birthDate.getFullYear() < 1920) {
        return 'Năm sinh không hợp lệ (phải từ năm 1920 trở lại đây).';
      }
      const age = today.getFullYear() - birthDate.getFullYear();
      if (age < 14) {
        return 'Độ tuổi nhân sự phải từ 14 tuổi trở lên.';
      }
      return '';
    }

    case 'address':
      if (val && val.length > 255) {
        return 'Địa chỉ không được vượt quá 255 ký tự.';
      }
      return '';

    default:
      return '';
  }
};

export const validateAllProfile = (formData) => {
  const fields = ['fullName', 'phone', 'citizenId', 'dateOfBirth', 'address'];
  const errors = {};
  fields.forEach(f => {
    const err = validateProfileField(f, formData[f], formData);
    if (err) errors[f] = err;
  });
  return errors;
};

// Dynamic Field Validation for Change Password
export const validatePasswordField = (field, value, allValues = {}) => {
  const val = value !== undefined && value !== null ? String(value) : '';

  switch (field) {
    case 'currentPassword':
      if (!val) return 'Vui lòng nhập mật khẩu hiện tại.';
      return '';

    case 'newPassword':
      if (!val) return 'Vui lòng nhập mật khẩu mới.';
      if (val.length < 8) return 'Mật khẩu mới phải có ít nhất 8 ký tự (MSG17).';
      if (allValues.currentPassword && val === allValues.currentPassword) {
        return 'Mật khẩu mới không được trùng với mật khẩu hiện tại.';
      }
      return '';

    case 'confirmPassword':
      if (!val) return 'Vui lòng xác nhận mật khẩu mới.';
      if (allValues.newPassword && val !== allValues.newPassword) {
        return 'Mật khẩu xác nhận không khớp với mật khẩu mới';
      }
      return '';

    default:
      return '';
  }
};

export const validateAllPassword = (formData) => {
  const fields = ['currentPassword', 'newPassword', 'confirmPassword'];
  const errors = {};
  fields.forEach(f => {
    const err = validatePasswordField(f, formData[f], formData);
    if (err) errors[f] = err;
  });
  return errors;
};

export const AccountView = () => {
  const { user, updateUser } = useAuth();
  const { showToast } = useNotification();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const activeTab = ['staff', 'profile', 'security'].includes(requestedTab)
    ? requestedTab
    : 'staff';
  const setActiveTab = (tab) => {
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      if (tab === 'staff') next.delete('tab');
      else next.set('tab', tab);
      return next;
    });
  };

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
    email: user?.email || '',
    fullName: user?.fullName || user?.name || '',
    phone: user?.phone || '',
    citizenId: user?.citizenId || '',
    address: user?.address || '',
    dateOfBirth: user?.dateOfBirth || '',
    avatarUrl: user?.avatarUrl || ''
  }));
  const [profileErrors, setProfileErrors] = useState({});
  const [profileTouched, setProfileTouched] = useState({});
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [selectedImageToCrop, setSelectedImageToCrop] = useState(null);
  const [showAvatarPreview, setShowAvatarPreview] = useState(false);
  const [profileMessage, setProfileMessage] = useState({ type: '', text: '' });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const fileInputRef = useRef(null);

  // Password Change State
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [passwordTouched, setPasswordTouched] = useState({});
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Synchronize profile state when auth user changes
  const [prevUser, setPrevUser] = useState(user);
  if (user !== prevUser) {
    setPrevUser(user);
    if (user) {
      setProfileForm({
        email: user.email || '',
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
          email: profile.email || '',
          fullName: profile.fullName || '',
          phone: profile.phone || '',
          citizenId: profile.citizenId || '',
          address: profile.address || '',
          dateOfBirth: profile.dateOfBirth || '',
          avatarUrl: profile.avatarUrl || ''
        });
        updateUser({
          ...(profile.email ? { email: profile.email } : {}),
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
    setEditAvatarFile(null);
    setEditAvatarCrop(null);
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

  const [editAvatarFile, setEditAvatarFile] = useState(null);
  const [editAvatarCrop, setEditAvatarCrop] = useState(null);
  const editAvatarSource = useRef(null);

  const handleEditAvatarFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      setFormError('Vui lòng chọn ảnh có dung lượng không quá 5MB.');
      return;
    }
    editAvatarSource.current = file;
    const reader = new FileReader();
    reader.onload = () => setEditAvatarCrop(reader.result.toString());
    reader.onerror = () => setFormError('Không đọc được ảnh. Vui lòng chọn lại.');
    reader.readAsDataURL(file);
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
      let avatarUrl = editStaff.avatarUrl || null;
      if (editAvatarFile) {
        avatarUrl = await fileService.uploadFile(editAvatarFile, 'avatars');
        if (typeof avatarUrl !== 'string' || !avatarUrl) throw new Error('Không nhận được đường dẫn ảnh đã tải lên.');
        setEditStaff(current => ({ ...current, avatarUrl }));
        setEditAvatarFile(null);
      }
      await updateEmployee(editStaff.id, {
        fullName: editStaff.fullName.trim(),
        email: editStaff.email.trim(),
        phone: editStaff.phone.trim() || null,
        roleName: editStaff.roleName,
        isActive: editStaff.isActive,
        avatarUrl
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
    if (file.size > 5 * 1024 * 1024) {
      setProfileMessage({ type: 'error', text: 'Kích thước ảnh không được vượt quá 5MB.' });
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
    try {
      setUploadingAvatar(true);
      setProfileMessage({ type: '', text: '' });
      const url = await fileService.uploadAvatar(croppedFile, croppedBase64);
      setProfileForm(prev => ({ ...prev, avatarUrl: url }));
      updateUser({ avatarUrl: url });
      setProfileMessage({ type: 'success', text: 'Đã lưu ảnh đại diện thành công.' });
    } catch (err) {
      setProfileMessage({ type: 'error', text: err.response?.data?.message || 'Không lưu được ảnh đại diện. Vui lòng thử lại.' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  // ── Profile Dynamic Validation Handlers ─────────────────────────────────
  const handleProfileFieldChange = (field, value) => {
    setProfileForm(prev => {
      const next = { ...prev, [field]: value };
      const error = validateProfileField(field, value, next);
      setProfileErrors(prevErr => {
        const nextErr = { ...prevErr };
        if (error) {
          nextErr[field] = error;
        } else {
          delete nextErr[field];
        }
        return nextErr;
      });
      return next;
    });

    setProfileTouched(prev => ({ ...prev, [field]: true }));
    if (profileMessage.type === 'error') {
      setProfileMessage({ type: '', text: '' });
    }
  };

  const handleProfileFieldBlur = (field) => {
    setProfileTouched(prev => ({ ...prev, [field]: true }));
    const error = validateProfileField(field, profileForm[field], profileForm);
    setProfileErrors(prev => {
      const nextErr = { ...prev };
      if (error) {
        nextErr[field] = error;
      } else {
        delete nextErr[field];
      }
      return nextErr;
    });
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileMessage({ type: '', text: '' });

    // 1. Mark all fields touched for instant visual feedback
    const allTouched = {
      fullName: true,
      phone: true,
      citizenId: true,
      dateOfBirth: true,
      address: true
    };
    setProfileTouched(allTouched);

    // 2. Validate all fields client-side dynamically
    const validationErrors = validateAllProfile(profileForm);
    setProfileErrors(validationErrors);

    const errorFields = Object.keys(validationErrors).filter(k => validationErrors[k]);
    if (errorFields.length > 0) {
      const firstField = errorFields[0];
      const firstMsg = validationErrors[firstField];
      setProfileMessage({
        type: 'error',
        text: `Dữ liệu chưa hợp lệ: ${firstMsg}`
      });
      showToast(firstMsg, 'error');

      // Auto-focus first invalid field with smooth scroll
      setTimeout(() => {
        const el = document.getElementById(`profile-${firstField}`);
        if (el) {
          el.focus();
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
      return; // STOP! Do not call Backend API with invalid data!
    }

    setIsSavingProfile(true);
    try {
      const payload = {
        ...(user?.role === 'ROLE_FARM_OWNER' ? { email: profileForm.email.trim() } : {}),
        fullName: (profileForm.fullName || '').trim(),
        avatarUrl: profileForm.avatarUrl || null,
        phone: profileForm.phone?.trim() || null,
        citizenId: profileForm.citizenId?.trim() || null,
        address: profileForm.address?.trim() || null,
        dateOfBirth: profileForm.dateOfBirth || null
      };
      const updated = await updateProfile(payload);
      setProfileForm({
        email: updated.email || user?.email || '',
        fullName: updated.fullName || '',
        phone: updated.phone || '',
        citizenId: updated.citizenId || '',
        address: updated.address || '',
        dateOfBirth: updated.dateOfBirth || '',
        avatarUrl: updated.avatarUrl || ''
      });
      updateUser({
        email: updated.email || user?.email,
        name: updated.fullName,
        fullName: updated.fullName,
        phone: updated.phone || '',
        citizenId: updated.citizenId || '',
        address: updated.address || '',
        dateOfBirth: updated.dateOfBirth || '',
        avatarUrl: updated.avatarUrl || ''
      });
      setProfileErrors({});
      setProfileTouched({});
      setProfileMessage({ type: 'success', text: getSystemMessage('MSG13') });
      showToast('MSG13', 'success');
      setTimeout(() => {
        setProfileMessage(prev => prev.type === 'success' ? { type: '', text: '' } : prev);
      }, 5000);
    } catch (err) {
      const resData = err.response?.data;
      if (resData?.errors && typeof resData.errors === 'object') {
        // Map backend validation field errors directly to inputs
        setProfileErrors(prev => ({ ...prev, ...resData.errors }));
        const firstErrKey = Object.keys(resData.errors)[0];
        const firstErrMsg = resData.errors[firstErrKey];
        setProfileMessage({ type: 'error', text: firstErrMsg || 'Lỗi kiểm tra dữ liệu từ máy chủ.' });
        showToast(firstErrMsg || 'MSG04', 'error');
        setTimeout(() => {
          document.getElementById(`profile-${firstErrKey}`)?.focus();
        }, 50);
      } else {
        const errMsg = resData?.message || getSystemMessage('MSG04');
        setProfileMessage({ type: 'error', text: errMsg });
        showToast('MSG04', 'error');
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

  // ── Password Dynamic Validation Handlers ────────────────────────────────
  const handlePasswordFieldChange = (field, value) => {
    setPasswordForm(prev => {
      const next = { ...prev, [field]: value };
      const error = validatePasswordField(field, value, next);
      setPasswordErrors(prevErr => {
        const nextErr = { ...prevErr };
        if (error) {
          nextErr[field] = error;
        } else {
          delete nextErr[field];
        }
        return nextErr;
      });
      return next;
    });

    setPasswordTouched(prev => ({ ...prev, [field]: true }));
    if (passwordMessage.type === 'error') {
      setPasswordMessage({ type: '', text: '' });
    }
  };

  const handlePasswordFieldBlur = (field) => {
    setPasswordTouched(prev => ({ ...prev, [field]: true }));
    const error = validatePasswordField(field, passwordForm[field], passwordForm);
    setPasswordErrors(prev => {
      const nextErr = { ...prev };
      if (error) {
        nextErr[field] = error;
      } else {
        delete nextErr[field];
      }
      return nextErr;
    });
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMessage({ type: '', text: '' });

    const allTouched = { currentPassword: true, newPassword: true, confirmPassword: true };
    setPasswordTouched(allTouched);

    const validationErrors = validateAllPassword(passwordForm);
    setPasswordErrors(validationErrors);

    const errorFields = Object.keys(validationErrors).filter(k => validationErrors[k]);
    if (errorFields.length > 0) {
      const firstField = errorFields[0];
      const firstMsg = validationErrors[firstField];
      setPasswordMessage({ type: 'error', text: firstMsg });
      showToast(firstMsg, 'error');
      setTimeout(() => {
        document.getElementById(`security-${firstField}`)?.focus();
      }, 50);
      return; // Stop immediately, do not send request to BE
    }

    setIsChangingPassword(true);
    try {
      await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordMessage({ type: 'success', text: getSystemMessage('MSG19') });
      showToast('MSG19', 'success');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordErrors({});
      setPasswordTouched({});
      setTimeout(() => {
        setPasswordMessage(prev => prev.type === 'success' ? { type: '', text: '' } : prev);
      }, 5000);
    } catch (err) {
      const resData = err.response?.data;
      if (resData?.errors && typeof resData.errors === 'object') {
        setPasswordErrors(prev => ({ ...prev, ...resData.errors }));
      }
      const errMsg = resData?.message || 'Đổi mật khẩu thất bại. Kiểm tra lại mật khẩu cũ.';
      setPasswordMessage({ type: 'error', text: errMsg });
      showToast('MSG04', 'error');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <FarmShiftLayout
      pageTitle="Tài khoản & Nhân sự"
      breadcrumbs={[{ label: 'Tài khoản' }]}
      actions={
        activeTab === 'staff' && (
          <button
            className="farmshift-btn farmshift-btn-primary"
            onClick={handleOpenAddModal}
            id="btn-add-employee"
            style={{ backgroundColor: '#e0f5ef', borderColor: '#a7dfcf', color: '#007968' }}
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
      </div>

      {/* ── TAB 1: DANH SÁCH NHÂN SỰ ────────────────────────────────────────── */}
      {activeTab === 'staff' && (
        <div className="farmshift-card">

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
                      <p style={{ margin: '4px 0 0', fontSize: '14.5px' }}>Thử thay đổi từ khóa tìm kiếm hoặc bỏ bớt bộ lọc.</p>
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
                              flexShrink: 0,
                              aspectRatio: '1 / 1',
                              borderRadius: '50%',
                              backgroundColor: 'var(--color-surface-soft)',
                              border: '1px solid var(--color-hairline)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                              fontWeight: 600,
                              color: 'var(--color-ink)',
                              fontSize: '14.5px'
                            }}>
                              {st.avatarUrl ? (
                                <img src={st.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                (st.fullName || st.email || 'U').charAt(0).toUpperCase()
                              )}
                            </div>
                            <div>
                              <strong style={{ color: 'var(--color-ink)', fontSize: '15px', display: 'block' }}>
                                {st.fullName || 'Chưa đặt tên'}
                              </strong>
                            </div>
                          </div>
                        </td>
                        <td style={{ color: 'var(--color-body)', fontSize: '14.5px' }}>{st.email}</td>
                        <td style={{ color: 'var(--color-body)', fontSize: '14.5px' }}>{st.phone || '—'}</td>
                        <td>
                          <span className={`farmshift-badge ${roleInfo.badgeClass}`}>
                            {roleInfo.label}
                          </span>
                        </td>
                        <td style={{ color: 'var(--color-muted)', fontSize: '14.5px' }}>
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
            <form onSubmit={handleUpdateProfile}>
              {profileMessage.text && (
                <p role={profileMessage.type === 'error' ? 'alert' : 'status'}
                  style={{ color: profileMessage.type === 'error' ? '#dc2626' : '#00846b', marginBottom: '16px' }}>
                  {profileMessage.text}
                </p>
              )}
              <div style={{ display: 'flex', gap: '24px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <button type="button" aria-label="Xem ảnh đại diện" title={profileForm.avatarUrl ? 'Bấm để xem ảnh đại diện' : 'Chưa có ảnh đại diện'}
                    disabled={!profileForm.avatarUrl || uploadingAvatar}
                    onClick={() => setShowAvatarPreview(true)} style={{
                    width: '100px', height: '100px', borderRadius: '50%',
                    backgroundColor: 'var(--color-surface-soft)',
                    border: '1px solid var(--color-hairline)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    overflow: 'hidden', position: 'relative', padding: 0,
                    cursor: profileForm.avatarUrl ? 'zoom-in' : 'default'
                  }}>
                    {profileForm.avatarUrl ? (
                      <img src={profileForm.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <UserCheck size={40} color="var(--color-muted)" />
                    )}
                    {uploadingAvatar && (
                      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <span style={{ fontSize: '13.5px', color: 'var(--color-primary)', fontWeight: 500 }}>Đang tải...</span>
                      </div>
                    )}
                  </button>
                  <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14.5px', color: 'var(--color-primary)', fontWeight: 500 }}>
                    <Camera size={14} /> Thay đổi ảnh
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleAvatarFile}
                      disabled={uploadingAvatar || isSavingProfile}
                    />
                  </label>
                </div>

                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="farmshift-form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label className="farmshift-form-label" htmlFor="profile-fullName" style={{ margin: 0 }}>
                        Họ và tên *
                      </label>
                      {profileTouched.fullName && !profileErrors.fullName && profileForm.fullName && (
                        <span style={{ fontSize: '13px', color: '#059669', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <CheckCircle size={12} /> Hợp lệ
                        </span>
                      )}
                    </div>
                    <input
                      id="profile-fullName"
                      name="fullName"
                      type="text"
                      required
                      placeholder="Nhập họ và tên đầy đủ"
                      className={`farmshift-form-control ${
                        profileTouched.fullName && profileErrors.fullName
                          ? 'is-invalid'
                          : profileTouched.fullName && !profileErrors.fullName && profileForm.fullName
                          ? 'is-valid'
                          : ''
                      }`}
                      value={profileForm.fullName}
                      onChange={e => handleProfileFieldChange('fullName', e.target.value)}
                      onBlur={() => handleProfileFieldBlur('fullName')}
                    />
                    {profileTouched.fullName && profileErrors.fullName && (
                      <div className="farmshift-field-error-msg" role="alert">
                        <AlertCircle size={13} />
                        <span>{profileErrors.fullName}</span>
                      </div>
                    )}
                  </div>

                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label" style={{ marginBottom: '4px' }}>Email tài khoản</label>
                    <input
                      type="email"
                      readOnly={user?.role !== 'ROLE_FARM_OWNER'}
                      required
                      maxLength={50}
                      className="farmshift-form-control"
                      style={user?.role !== 'ROLE_FARM_OWNER' ? { backgroundColor: 'var(--color-surface-soft)', cursor: 'not-allowed' } : undefined}
                      value={profileForm.email}
                      onChange={e => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>

                  <div className="farmshift-form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label className="farmshift-form-label" htmlFor="profile-phone" style={{ margin: 0 }}>
                        Số điện thoại liên hệ
                      </label>
                      {profileForm.phone && (
                        <span style={{
                          fontSize: '12.5px',
                          color: profileTouched.phone && profileErrors.phone ? '#dc2626' : 'var(--color-muted)',
                          fontWeight: 500
                        }}>
                          {profileForm.phone.length}/11 số
                        </span>
                      )}
                    </div>
                    <input
                      id="profile-phone"
                      name="phone"
                      type="tel"
                      maxLength={11}
                      placeholder="VD: 0966755089 (10-11 số)"
                      className={`farmshift-form-control ${
                        profileTouched.phone && profileErrors.phone
                          ? 'is-invalid'
                          : profileTouched.phone && !profileErrors.phone && profileForm.phone
                          ? 'is-valid'
                          : ''
                      }`}
                      value={profileForm.phone}
                      onChange={e => handleProfileFieldChange('phone', e.target.value)}
                      onBlur={() => handleProfileFieldBlur('phone')}
                    />
                    {profileTouched.phone && profileErrors.phone && (
                      <div className="farmshift-field-error-msg" role="alert">
                        <AlertCircle size={13} />
                        <span>{profileErrors.phone}</span>
                      </div>
                    )}
                  </div>

                  <div className="farmshift-form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label className="farmshift-form-label" htmlFor="profile-citizenId" style={{ margin: 0 }}>
                        Số CMND/CCCD
                      </label>
                      {profileForm.citizenId && (
                        <span style={{
                          fontSize: '12.5px',
                          color: profileTouched.citizenId && profileErrors.citizenId ? '#dc2626' : 'var(--color-muted)',
                          fontWeight: 500
                        }}>
                          {profileForm.citizenId.length}/12 số
                        </span>
                      )}
                    </div>
                    <input
                      id="profile-citizenId"
                      name="citizenId"
                      type="text"
                      maxLength={12}
                      placeholder="9 số (CMND) hoặc 12 số (CCCD)"
                      className={`farmshift-form-control ${
                        profileTouched.citizenId && profileErrors.citizenId
                          ? 'is-invalid'
                          : profileTouched.citizenId && !profileErrors.citizenId && profileForm.citizenId
                          ? 'is-valid'
                          : ''
                      }`}
                      value={profileForm.citizenId}
                      onChange={e => handleProfileFieldChange('citizenId', e.target.value)}
                      onBlur={() => handleProfileFieldBlur('citizenId')}
                    />
                    {profileTouched.citizenId && profileErrors.citizenId && (
                      <div className="farmshift-field-error-msg" role="alert">
                        <AlertCircle size={13} />
                        <span>{profileErrors.citizenId}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="farmshift-form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label className="farmshift-form-label" htmlFor="profile-dateOfBirth" style={{ margin: 0 }}>
                      Ngày sinh (dd/mm/yyyy)
                    </label>
                    {profileTouched.dateOfBirth && !profileErrors.dateOfBirth && profileForm.dateOfBirth && (
                      <span style={{ fontSize: '13px', color: '#059669', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <CheckCircle size={12} /> Hợp lệ
                      </span>
                    )}
                  </div>
                  <input
                    id="profile-dateOfBirth"
                    name="dateOfBirth"
                    type="date"
                    max={new Date().toISOString().split('T')[0]}
                    className={`farmshift-form-control ${
                      profileTouched.dateOfBirth && profileErrors.dateOfBirth
                        ? 'is-invalid'
                        : profileTouched.dateOfBirth && !profileErrors.dateOfBirth && profileForm.dateOfBirth
                        ? 'is-valid'
                        : ''
                    }`}
                    value={profileForm.dateOfBirth}
                    onChange={e => handleProfileFieldChange('dateOfBirth', e.target.value)}
                    onBlur={() => handleProfileFieldBlur('dateOfBirth')}
                  />
                  {profileTouched.dateOfBirth && profileErrors.dateOfBirth && (
                    <div className="farmshift-field-error-msg" role="alert">
                      <AlertCircle size={13} />
                      <span>{profileErrors.dateOfBirth}</span>
                    </div>
                  )}
                </div>

                <div className="farmshift-form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label className="farmshift-form-label" htmlFor="profile-address" style={{ margin: 0 }}>
                      Địa chỉ hiện tại
                    </label>
                    {profileForm.address && (
                      <span style={{ fontSize: '12.5px', color: 'var(--color-muted)' }}>
                        {profileForm.address.length}/255
                      </span>
                    )}
                  </div>
                  <input
                    id="profile-address"
                    name="address"
                    type="text"
                    maxLength={255}
                    placeholder="VD: Yên Lạc, Vĩnh Tường, Vĩnh Phúc..."
                    className={`farmshift-form-control ${
                      profileTouched.address && profileErrors.address
                        ? 'is-invalid'
                        : profileTouched.address && !profileErrors.address && profileForm.address
                        ? 'is-valid'
                        : ''
                    }`}
                    value={profileForm.address}
                    onChange={e => handleProfileFieldChange('address', e.target.value)}
                    onBlur={() => handleProfileFieldBlur('address')}
                  />
                  {profileTouched.address && profileErrors.address && (
                    <div className="farmshift-field-error-msg" role="alert">
                      <AlertCircle size={13} />
                      <span>{profileErrors.address}</span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--color-hairline)', paddingTop: '16px' }}>
                <button
                  type="submit"
                  className={`farmshift-btn farmshift-btn-primary ${isSavingProfile ? 'is-loading' : ''}`}
                  disabled={isSavingProfile || uploadingAvatar}
                  aria-busy={isSavingProfile}
                  id="btn-save-profile"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  {isSavingProfile ? (
                    <>
                      <ButtonSpinner size={16} color="#019788" secondaryColor="rgba(255, 255, 255, 0.3)" />
                      <span>Đang lưu hồ sơ...</span>
                    </>
                  ) : (
                    'Lưu thay đổi hồ sơ'
                  )}
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
            <form onSubmit={handleChangePassword}>
              <div className="farmshift-form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label className="farmshift-form-label" htmlFor="security-currentPassword" style={{ margin: 0 }}>
                    Mật khẩu hiện tại <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  {passwordTouched.currentPassword && !passwordErrors.currentPassword && passwordForm.currentPassword && (
                    <span style={{ fontSize: '13px', color: '#059669', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <CheckCircle size={12} /> Đã nhập
                    </span>
                  )}
                </div>
                <PasswordInput
                  id="security-currentPassword"
                  name="currentPassword"
                  visibilityLabel="mật khẩu hiện tại"
                  autoComplete="current-password"
                  required
                  placeholder="Nhập mật khẩu đang dùng"
                  className={`farmshift-form-control ${
                    passwordTouched.currentPassword && passwordErrors.currentPassword
                      ? 'is-invalid'
                      : passwordTouched.currentPassword && !passwordErrors.currentPassword && passwordForm.currentPassword
                      ? 'is-valid'
                      : ''
                  }`}
                  value={passwordForm.currentPassword}
                  onChange={e => handlePasswordFieldChange('currentPassword', e.target.value)}
                  onBlur={() => handlePasswordFieldBlur('currentPassword')}
                />
                {passwordTouched.currentPassword && passwordErrors.currentPassword && (
                  <div className="farmshift-field-error-msg" role="alert">
                    <AlertCircle size={13} />
                    <span>{passwordErrors.currentPassword}</span>
                  </div>
                )}
              </div>

              <div className="farmshift-form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label className="farmshift-form-label" htmlFor="security-newPassword" style={{ margin: 0 }}>
                    Mật khẩu mới <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  {passwordForm.newPassword && (
                    <span style={{
                      fontSize: '12.5px',
                      color: passwordTouched.newPassword && passwordErrors.newPassword ? '#dc2626' : 'var(--color-muted)',
                      fontWeight: 500
                    }}>
                      {passwordForm.newPassword.length}/8+ ký tự
                    </span>
                  )}
                </div>
                <PasswordInput
                  id="security-newPassword"
                  name="newPassword"
                  visibilityLabel="mật khẩu mới"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="Tối thiểu 8 ký tự"
                  className={`farmshift-form-control ${
                    passwordTouched.newPassword && passwordErrors.newPassword
                      ? 'is-invalid'
                      : passwordTouched.newPassword && !passwordErrors.newPassword && passwordForm.newPassword
                      ? 'is-valid'
                      : ''
                  }`}
                  value={passwordForm.newPassword}
                  onChange={e => handlePasswordFieldChange('newPassword', e.target.value)}
                  onBlur={() => handlePasswordFieldBlur('newPassword')}
                />
                {passwordTouched.newPassword && passwordErrors.newPassword && (
                  <div className="farmshift-field-error-msg" role="alert">
                    <AlertCircle size={13} />
                    <span>{passwordErrors.newPassword}</span>
                  </div>
                )}
              </div>

              <div className="farmshift-form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label className="farmshift-form-label" htmlFor="security-confirmPassword" style={{ margin: 0 }}>
                    Xác nhận mật khẩu mới <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  {passwordTouched.confirmPassword && !passwordErrors.confirmPassword && passwordForm.confirmPassword && (
                    <span style={{ fontSize: '13px', color: '#059669', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <CheckCircle size={12} /> Khớp
                    </span>
                  )}
                </div>
                <PasswordInput
                  id="security-confirmPassword"
                  name="confirmPassword"
                  visibilityLabel="xác nhận mật khẩu mới"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="Nhập lại mật khẩu mới"
                  className={`farmshift-form-control ${
                    passwordTouched.confirmPassword && passwordErrors.confirmPassword
                      ? 'is-invalid'
                      : passwordTouched.confirmPassword && !passwordErrors.confirmPassword && passwordForm.confirmPassword
                      ? 'is-valid'
                      : ''
                  }`}
                  value={passwordForm.confirmPassword}
                  onChange={e => handlePasswordFieldChange('confirmPassword', e.target.value)}
                  onBlur={() => handlePasswordFieldBlur('confirmPassword')}
                />
                {passwordTouched.confirmPassword && passwordErrors.confirmPassword && (
                  <div className="farmshift-field-error-msg" role="alert" style={{ color: '#dc2626' }}>
                    <AlertCircle size={13} />
                    <span>{passwordErrors.confirmPassword}</span>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--color-hairline)', paddingTop: '16px' }}>
                <button
                  type="submit"
                  className={`farmshift-btn farmshift-btn-primary ${isChangingPassword ? 'is-loading' : ''}`}
                  disabled={isChangingPassword}
                  aria-busy={isChangingPassword}
                  id="btn-change-password"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: '#e0f5ef', borderColor: '#a7dfcf', color: '#007968' }}
                >
                  {isChangingPassword ? (
                    <>
                      <ButtonSpinner size={16} color="#019788" secondaryColor="rgba(255, 255, 255, 0.3)" />
                      <span>Đang cập nhật...</span>
                    </>
                  ) : (
                    'Cập nhật mật khẩu'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 1: CREATE EMPLOYEE ──────────────────────────────────────── */}
      {showAddModal && (
        <div className="farmshift-modal-backdrop" onClick={event => {
          if (event.target === event.currentTarget && !isSubmitting) setShowAddModal(false);
        }}>
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
            <form onSubmit={handleCreateStaff} className={employeeFormStyles.form}>
              <div className="farmshift-modal-body">
                {formError && (
                  <div style={{
                    padding: '10px 14px',
                    marginBottom: '16px',
                    borderRadius: 'var(--rounded-md)',
                    backgroundColor: '#fce8e6',
                    color: '#c5221f',
                    fontSize: '15px',
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
                    placeholder="Nguyễn Văn A"
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
                            fontSize: '13px',
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
                      placeholder="nguyenvana@example.com"
                      className="farmshift-form-control"
                      value={newStaff.email}
                      onChange={e => handleEmailChange(e.target.value)}
                    />
                    {!isEmailCustomized && newStaff.email && (
                      <span style={{ fontSize: '13px', color: 'var(--color-muted)', marginTop: '4px', display: 'block' }}>
                        ✨ Đề xuất tự động (sửa tùy ý)
                      </span>
                    )}
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Số điện thoại</label>
                    <input
                      type="text"
                      placeholder="0912345678"
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
                      <option value="ROLE_FARM_WORKER">Công nhân trại</option>
                      <option value="ROLE_ACCOUNTANT">Kế toán</option>
                    </select>
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Mật khẩu khởi tạo</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Nhập mật khẩu"
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
                    <span className={employeeFormStyles.passwordHint}>
                      Mặc định khi để trống: <code>123456</code>
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
                  className={`farmshift-btn farmshift-btn-primary ${isSubmitting ? 'is-loading' : ''}`}
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  style={{ gap: '8px', backgroundColor: '#e0f5ef', borderColor: '#a7dfcf', color: '#007968' }}
                >
                  {isSubmitting ? (
                    <>
                      <ButtonSpinner size={16} color="#019788" secondaryColor="rgba(255, 255, 255, 0.3)" />
                      <span>Đang tạo tài khoản...</span>
                    </>
                  ) : (
                    'Tạo tài khoản & Lưu'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: VIEW EMPLOYEE DETAILS ─────────────────────────────────── */}
      {showDetailModal && selectedEmployee && (
        <div className="farmshift-modal-backdrop" onClick={event => {
          if (event.target === event.currentTarget) setShowDetailModal(false);
        }}>
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
                      <p style={{ margin: '4px 0 0', color: 'var(--color-muted)', fontSize: '15px' }}>
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

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '15px' }}>
                    <div>
                      <span style={{ color: 'var(--color-muted)', display: 'block', fontSize: '13.5px' }}>Mã nhân viên (ID):</span>
                      <strong style={{ color: 'var(--color-ink)' }}>#{selectedEmployee.id}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-muted)', display: 'block', fontSize: '13.5px' }}>Số điện thoại:</span>
                      <strong style={{ color: 'var(--color-ink)' }}>{selectedEmployee.phone || 'Chưa cập nhật'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-muted)', display: 'block', fontSize: '13.5px' }}>Số CMND / Căn cước:</span>
                      <strong style={{ color: 'var(--color-ink)' }}>{selectedEmployee.citizenId || 'Chưa cập nhật'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-muted)', display: 'block', fontSize: '13.5px' }}>Ngày sinh:</span>
                      <strong style={{ color: 'var(--color-ink)' }}>{selectedEmployee.dateOfBirth || 'Chưa cập nhật'}</strong>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ color: 'var(--color-muted)', display: 'block', fontSize: '13.5px' }}>Địa chỉ cư trú:</span>
                      <strong style={{ color: 'var(--color-ink)' }}>{selectedEmployee.address || 'Chưa cập nhật'}</strong>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ color: 'var(--color-muted)', display: 'block', fontSize: '13.5px' }}>Mô tả vai trò & phạm vi:</span>
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
                style={{ backgroundColor: '#e0f5ef', borderColor: '#a7dfcf', color: '#007968' }}
              >
                <Edit2 size={14} /> Chỉnh sửa thông tin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 3: UPDATE EMPLOYEE & ROLE ───────────────────────────────── */}
      {showEditModal && (
        <div className="farmshift-modal-backdrop" onClick={event => {
          if (event.target === event.currentTarget && !isSubmitting) setShowEditModal(false);
        }}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                  <div style={{ width: '72px', height: '72px', flexShrink: 0, borderRadius: '50%', overflow: 'hidden', background: '#edf7f4', display: 'grid', placeItems: 'center', border: '1px solid #dce9e5' }}>
                    {editStaff.avatarUrl ? <img src={editStaff.avatarUrl} alt="Ảnh đại diện nhân viên" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <UserCheck size={30} color="#008577" />}
                  </div>
                  <div>
                    <label htmlFor="edit-employee-avatar" className="farmshift-btn farmshift-btn-secondary" style={{ display: 'inline-flex', width: 'fit-content', minHeight: 'auto', padding: '6px 10px', gap: '6px', fontSize: '13.5px', lineHeight: 1.4, borderRadius: '8px', background: '#e0f5ef', color: '#007968', borderColor: '#a7dfcf', cursor: isSubmitting ? 'wait' : 'pointer' }}>
                      <Camera size={15} /> Thay đổi ảnh nhân viên
                    </label>
                    <input id="edit-employee-avatar" type="file" accept="image/*" disabled={isSubmitting} onChange={handleEditAvatarFile} style={{ display: 'none' }} />
                    <p style={{ margin: '6px 0 0', fontSize: '13.5px', color: 'var(--color-muted)' }}>Ảnh tối đa 5MB. Bấm Lưu thay đổi để cập nhật.</p>
                  </div>
                </div>
                {formError && (
                  <div style={{
                    padding: '10px 14px',
                    marginBottom: '16px',
                    borderRadius: 'var(--rounded-md)',
                    backgroundColor: '#fce8e6',
                    color: '#c5221f',
                    fontSize: '15px',
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
                    fontSize: '14.5px',
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
                        <option value="ROLE_FARM_OWNER">Chủ trang trại</option>
                      ) : (
                        <>
                          <option value="ROLE_FARM_WORKER">Công nhân trại</option>
                          <option value="ROLE_ACCOUNTANT">Kế toán</option>
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
                  className={`farmshift-btn farmshift-btn-primary ${isSubmitting ? 'is-loading' : ''}`}
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  style={{ gap: '8px', backgroundColor: '#e0f5ef', borderColor: '#a7dfcf', color: '#007968' }}
                >
                  {isSubmitting ? (
                    <>
                      <ButtonSpinner size={16} color="#019788" secondaryColor="rgba(255, 255, 255, 0.3)" />
                      <span>Đang lưu thay đổi...</span>
                    </>
                  ) : (
                    'Lưu thay đổi'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editAvatarCrop && (
        <AvatarCropperModal imageSrc={editAvatarCrop}
          onClose={() => setEditAvatarCrop(null)}
          onCropComplete={(preview, file) => {
            setEditStaff(current => ({ ...current, avatarUrl: preview }));
            setEditAvatarFile(file || editAvatarSource.current);
            setEditAvatarCrop(null);
            setFormError('');
          }} />
      )}
      {showAvatarPreview && profileForm.avatarUrl && (
        <AvatarPreviewModal src={profileForm.avatarUrl} onClose={() => setShowAvatarPreview(false)} />
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
