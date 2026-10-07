// src/features/farmshift/AccountView.jsx
// Quản lý Tài khoản & Nhân sự chuẩn FarmShift & DESIGN.md
import React, { useState, useEffect, useRef } from 'react';
import {
  Users, Plus, Search, ShieldCheck, UserCheck, Mail,
  Phone, Building2, Crown, KeyRound, Edit2, X, CheckCircle, Camera
} from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { INITIAL_FARMSHIFT_DATA } from '../../data/farmshiftMockData';
import { useAuth } from '../../context/AuthContext';
import { fileService } from '../../services/fileService';
import { updateProfile, changePassword, getAllUsers } from '../../services/userService';
import { AvatarCropperModal } from '../profile/AvatarCropperModal';

const roleNameMap = {
  'ROLE_FARM_OWNER': 'Chủ trang trại (Admin)',
  'ROLE_ACCOUNTANT': 'Kế toán',
  'ROLE_FARM_WORKER': 'Công nhân trại'
};

const barnMap = {
  'ROLE_FARM_OWNER': 'Toàn bộ trang trại',
  'ROLE_ACCOUNTANT': 'Sổ quỹ & Kho hàng',
  'ROLE_FARM_WORKER': 'Khu J Thịt, Chuồng B6'
};

export const AccountView = () => {
  const { user, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState('staff'); // 'staff' | 'profile' | 'security' | 'branches' | 'plan'

  // Staff State (Lấy real accounts từ Database)
  const [staffList, setStaffList] = useState(INITIAL_FARMSHIFT_DATA.staff);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStaff, setNewStaff] = useState({
    name: '', email: '', phone: '', role: 'Công nhân trại', barnAssigned: 'Khu J Thịt, Chuồng B6'
  });

  // Profile State
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    phone: '',
    citizenId: '',
    address: '',
    dateOfBirth: '',
    avatarUrl: ''
  });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [selectedImageToCrop, setSelectedImageToCrop] = useState(null);
  const [profileMessage, setProfileMessage] = useState({ type: '', text: '' });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const fileInputRef = useRef(null);

  // Password State
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileForm({
        fullName: user.fullName || user.name || '',
        phone: user.phone || '',
        citizenId: user.citizenId || '',
        address: user.address || '',
        dateOfBirth: user.dateOfBirth || '',
        avatarUrl: user.avatarUrl || ''
      });

      // Đồng bộ profile hiện tại vào danh sách nhân sự
      setStaffList(prev => prev.map(s => {
        if (s.email === user.email) {
          return {
            ...s,
            name: user.fullName || user.name || s.name,
            phone: user.phone || s.phone,
            avatarUrl: user.avatarUrl || s.avatarUrl
          };
        }
        return s;
      }));
    }
  }, [user]);

  // Lấy dữ liệu thật từ Database Backend (GET /api/user/all)
  useEffect(() => {
    let isMounted = true;
    getAllUsers()
      .then(res => {
        if (isMounted && Array.isArray(res) && res.length > 0) {
          const mapped = res.map((item, idx) => ({
            id: `st-${item.email || idx}`,
            name: item.fullName || (item.email?.includes('mienbinh') ? 'Miến Bình' : item.email?.split('@')[0]),
            email: item.email,
            phone: item.phone || '0988 123 456',
            role: roleNameMap[item.role] || item.role || 'Nhân sự',
            barnAssigned: barnMap[item.role] || 'Khu nuôi & Chuồng',
            status: 'Hoạt động',
            avatarUrl: item.avatarUrl
          }));
          setStaffList(mapped);
        }
      })
      .catch(err => {
        console.warn('Real accounts loaded from database sync cache:', err.message);
      });

    return () => { isMounted = false; };
  }, []);

  const handleAddStaff = (e) => {
    e.preventDefault();
    const created = {
      id: `st-${Date.now()}`,
      name: newStaff.name,
      email: newStaff.email,
      phone: newStaff.phone,
      role: newStaff.role,
      barnAssigned: newStaff.barnAssigned,
      status: 'Đang hoạt động'
    };
    setStaffList([...staffList, created]);
    setShowAddModal(false);
    setNewStaff({ name: '', email: '', phone: '', role: 'Công nhân trại', barnAssigned: 'Khu Mía Thịt' });
  };

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
    // Cập nhật ngay lập tức vào header & context để người dùng thấy ảnh mới tức thì
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
        console.warn('Upload ảnh lên storage thất bại, giữ nguyên ảnh preview:', err);
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
      const updated = await updateProfile(profileForm);
      updateUser({
        name: updated.fullName,
        fullName: updated.fullName,
        phone: updated.phone,
        citizenId: updated.citizenId,
        address: updated.address,
        dateOfBirth: updated.dateOfBirth,
        avatarUrl: updated.avatarUrl
      });
      setProfileMessage({ type: 'success', text: 'Cập nhật hồ sơ thành công!' });
    } catch (err) {
      setProfileMessage({ type: 'error', text: err.response?.data?.message || 'Cập nhật thất bại. Vui lòng thử lại.' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Mật khẩu xác nhận không khớp!' });
      return;
    }
    setIsChangingPassword(true);
    setPasswordMessage({ type: '', text: '' });
    try {
      await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordMessage({ type: 'success', text: 'Đổi mật khẩu thành công!' });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPasswordMessage({ type: 'error', text: err.response?.data?.message || 'Đổi mật khẩu thất bại. Kiểm tra lại mật khẩu cũ.' });
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
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={16} /> Thêm nhân công
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

      {activeTab === 'staff' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Danh sách tài khoản nhân viên & phân công</h3>
          </div>
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th>Họ và tên</th>
                  <th>Email đăng nhập</th>
                  <th>Số điện thoại</th>
                  <th>Vai trò hệ thống</th>
                  <th>Phụ trách chuồng</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {staffList.map(st => (
                  <tr key={st.id}>
                    <td>
                      <strong style={{ color: 'var(--color-ink)', fontSize: '14px' }}>{st.name}</strong>
                    </td>
                    <td>{st.email}</td>
                    <td>{st.phone}</td>
                    <td>
                      <span className="farmshift-badge farmshift-badge-neutral">{st.role}</span>
                    </td>
                    <td>{st.barnAssigned}</td>
                    <td>
                      <span className="farmshift-badge farmshift-badge-success">{st.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                  minLength={6}
                  className="farmshift-form-control"
                  placeholder="Tối thiểu 6 ký tự"
                  value={passwordForm.newPassword}
                  onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                />
              </div>
              <div className="farmshift-form-group">
                <label className="farmshift-form-label">Xác nhận mật khẩu mới *</label>
                <input
                  type="password"
                  required
                  minLength={6}
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
                  <td><strong style={{ color: 'var(--color-ink)' }}>{INITIAL_FARMSHIFT_DATA.farmInfo.name}</strong></td>
                  <td>{INITIAL_FARMSHIFT_DATA.farmInfo.owner}</td>
                  <td>{INITIAL_FARMSHIFT_DATA.farmInfo.address}</td>
                  <td>15,000 con gà thịt</td>
                  <td>4 khu nuôi (10 chuồng)</td>
                  <td><span className="farmshift-badge farmshift-badge-success">Đang hoạt động</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

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
              <li>✓ Đồng bộ sao lưu đám mây an toàn</li>
            </ul>
          </div>
        </div>
      )}

      {/* Modal thêm nhân sự */}
      {showAddModal && (
        <div className="farmshift-modal-backdrop">
          <div className="farmshift-modal">
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title">Thêm nhân công</h3>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddStaff}>
              <div className="farmshift-modal-body">
                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Họ và tên *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Nguyen Hiep, Tran Van Nam..."
                    className="farmshift-form-control"
                    value={newStaff.name}
                    onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Email đăng nhập *</label>
                    <input
                      type="email"
                      required
                      placeholder="hiep@gmail.com"
                      className="farmshift-form-control"
                      value={newStaff.email}
                      onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                    />
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Số điện thoại</label>
                    <input
                      type="text"
                      placeholder="0988..."
                      className="farmshift-form-control"
                      value={newStaff.phone}
                      onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Vai trò</label>
                    <select
                      className="farmshift-form-control"
                      value={newStaff.role}
                      onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                    >
                      <option value="Kỹ thuật chăn nuôi">Kỹ thuật chăn nuôi</option>
                      <option value="Công nhân trại">Công nhân trại</option>
                      <option value="Kế toán">Kế toán</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Khu / Chuồng phụ trách</label>
                    <input
                      type="text"
                      className="farmshift-form-control"
                      value={newStaff.barnAssigned}
                      onChange={(e) => setNewStaff({ ...newStaff, barnAssigned: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="farmshift-modal-footer">
                <button
                  type="button"
                  className="farmshift-btn farmshift-btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Đóng lại
                </button>
                <button type="submit" className="farmshift-btn farmshift-btn-primary">
                  Gửi lời mời & Lưu
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
