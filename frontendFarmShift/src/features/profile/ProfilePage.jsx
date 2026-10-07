// src/features/profile/ProfilePage.jsx
// Hồ sơ cá nhân / Đổi mật khẩu / Cài đặt thông báo — Exact FarmShift.html UI/UX Clone
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Upload, Trash2, Camera, Check } from 'lucide-react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import { updateProfile, changePassword } from '../../services/userService';
import { AvatarCropperModal } from './AvatarCropperModal';

export const ProfilePage = ({ initialTab = 'info' }) => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();

  // Active tab: 'info' | 'password' | 'notifications'
  const [activeTab, setActiveTab] = useState(initialTab);

  // Form State: Info
  const [name, setName] = useState(user?.name || (user?.role === 'ROLE_FARM_WORKER' ? 'Trần Văn Bình' : user?.role === 'ROLE_ACCOUNTANT' ? 'Nguyễn Thị Mai' : 'Chủ trại'));
  const [phone, setPhone] = useState(user?.phone || '0912345678');
  const [email, setEmail] = useState(user?.email || (user?.role === 'ROLE_FARM_WORKER' ? 'worker@farmshift.vn' : user?.role === 'ROLE_ACCOUNTANT' ? 'accountant@farmshift.vn' : 'owner@farmshift.vn'));
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');

  // Form State: Password
  const [currentPassword, setCurrentPassword] = useState('demo12345');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Form State: Notifications
  const [pushNotif, setPushNotif] = useState('Bật');
  const [smsNotif, setSmsNotif] = useState('Tắt');
  const [alertPhone, setAlertPhone] = useState('0912345678');

  // Cropper State
  const fileInputRef = useRef(null);
  const [selectedImageToCrop, setSelectedImageToCrop] = useState(null);

  // Status & Alerts
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [feedbackType, setFeedbackType] = useState('success');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      if (user.name) setName(user.name);
      if (user.phone) setPhone(user.phone);
      if (user.email) setEmail(user.email);
      if (user.avatarUrl) setAvatarUrl(user.avatarUrl);
    }
  }, [user]);

  const roleTitleMap = {
    'ROLE_FARM_OWNER': 'Chủ trang trại',
    'ROLE_ACCOUNTANT': 'Kế toán',
    'ROLE_FARM_WORKER': 'Công nhân',
  };
  const roleTitle = roleTitleMap[user?.role] || 'Chủ trang trại';

  const tabTitles = {
    info: 'Hồ sơ cá nhân',
    password: 'Đổi mật khẩu',
    notifications: 'Cài đặt thông báo',
  };
  const currentTitle = tabTitles[activeTab];

  // Avatar select & crop
  const handleAvatarFile = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setFeedbackMsg('Kích thước ảnh không được vượt quá 10MB.');
        setFeedbackType('error');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImageToCrop(reader.result?.toString() || '');
      };
      reader.readAsDataURL(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCropComplete = async (croppedBase64) => {
    setSelectedImageToCrop(null);
    setAvatarUrl(croppedBase64);
    // Immediately save avatar to global user context & local storage
    updateUser({ avatarUrl: croppedBase64 });
    try {
      await updateProfile({ fullName: name, avatarUrl: croppedBase64, phone });
    } catch (err) {
      // Offline / demo fallback succeeds locally
    }
    setFeedbackMsg('Đã cập nhật ảnh đại diện thành công!');
    setFeedbackType('success');
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl('');
    updateUser({ avatarUrl: '' });
    setFeedbackMsg('Đã xóa ảnh đại diện.');
    setFeedbackType('success');
  };

  // Submit Info
  const handleSaveInfo = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFeedbackMsg(null);
    try {
      await updateProfile({
        fullName: name,
        avatarUrl,
        phone,
      });
      updateUser({ name, avatarUrl, phone });
      setFeedbackMsg('Đã lưu thông tin hồ sơ thành công.');
      setFeedbackType('success');
    } catch (err) {
      updateUser({ name, avatarUrl, phone });
      setFeedbackMsg('Đã lưu thông tin hồ sơ thành công (chế độ demo).');
      setFeedbackType('success');
    } finally {
      setLoading(false);
    }
  };

  // Submit Password
  const handleSavePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setFeedbackMsg('Mật khẩu nhập lại không khớp.');
      setFeedbackType('error');
      return;
    }
    if (newPassword && newPassword.length < 6) {
      setFeedbackMsg('Mật khẩu mới phải có ít nhất 6 ký tự.');
      setFeedbackType('error');
      return;
    }

    setLoading(true);
    setFeedbackMsg(null);
    try {
      await changePassword({ currentPassword, newPassword });
      setFeedbackMsg('Cập nhật mật khẩu thành công.');
      setFeedbackType('success');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setFeedbackMsg('Form hợp lệ. Bản demo chỉ kiểm tra form; không thay đổi mật khẩu của hệ thống thật.');
      setFeedbackType('success');
      setNewPassword('');
      setConfirmPassword('');
    } finally {
      setLoading(false);
    }
  };

  // Submit Notifications
  const handleSaveNotifications = (e) => {
    e.preventDefault();
    setFeedbackMsg('Đã lưu cài đặt thông báo.');
    setFeedbackType('success');
  };

  const avatarInitial = (name || user?.name || user?.email || 'U').charAt(0).toUpperCase();

  return (
    <DashboardLayout
      pageTitle={currentTitle}
      pageSub="Trang trại Miến Bình · Quản lý chăn nuôi gà"
      pageActions={
        <Link to="/" className="btn">
          ← Tổng quan
        </Link>
      }
    >
      {/* ── Tabs (Exact FarmShift.html) ────────────────────── */}
      <nav className="tabs">
        <button
          type="button"
          className={activeTab === 'info' ? 'active' : ''}
          onClick={() => { setActiveTab('info'); setFeedbackMsg(null); }}
        >
          Thông tin cá nhân
        </button>
        <button
          type="button"
          className={activeTab === 'password' ? 'active' : ''}
          onClick={() => { setActiveTab('password'); setFeedbackMsg(null); }}
        >
          Đổi mật khẩu
        </button>
        <button
          type="button"
          className={activeTab === 'notifications' ? 'active' : ''}
          onClick={() => { setActiveTab('notifications'); setFeedbackMsg(null); }}
        >
          Thông báo
        </button>
      </nav>

      {feedbackMsg && (
        <div
          className={feedbackType === 'error' ? 'error' : 'note'}
          style={{ marginBottom: 18 }}
        >
          {feedbackMsg}
        </div>
      )}

      {/* ── Main Content Grid ──────────────────────────────── */}
      <div className="grid two">
        {/* Left Column: Forms */}
        {activeTab === 'info' && (
          <section className="card">
            <h2>Thông tin hồ sơ cá nhân</h2>

            {/* Avatar Section */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              padding: '16px 0',
              marginBottom: 16,
              borderBottom: '1px solid var(--line)'
            }}>
              <div style={{
                width: 76,
                height: 76,
                borderRadius: '50%',
                background: 'var(--green)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                fontWeight: 600,
                overflow: 'hidden',
                flexShrink: 0,
                border: '3px solid var(--mint)'
              }}>
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  avatarInitial
                )}
              </div>

              <div>
                <b style={{ display: 'block', fontSize: 14, marginBottom: 4 }}>Ảnh đại diện</b>
                <p className="muted" style={{ margin: '0 0 10px', fontSize: 12 }}>
                  PNG, JPG hoặc WEBP. Nhấn nút bên dưới để chọn và căn chỉnh ảnh.
                </p>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAvatarFile}
                  accept="image/*"
                  style={{ display: 'none' }}
                />

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn primary small"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera size={14} /> Đổi ảnh đại diện
                  </button>

                  {avatarUrl && (
                    <button
                      type="button"
                      className="btn danger small"
                      onClick={handleRemoveAvatar}
                    >
                      <Trash2 size={14} /> Xóa ảnh
                    </button>
                  )}
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveInfo}>
              <div className="formgrid">
                <label className="field">
                  Họ tên
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                  />
                </label>

                <label className="field">
                  Số điện thoại
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                  />
                </label>

                <label className="field full">
                  Email
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </label>
              </div>

              <div className="formfoot">
                <button
                  type="button"
                  className="btn"
                  onClick={() => navigate('/')}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn primary"
                  disabled={loading}
                >
                  {loading ? 'Đang lưu...' : 'Lưu thông tin'}
                </button>
              </div>
            </form>
          </section>
        )}

        {activeTab === 'password' && (
          <section className="card">
            <h2>Thông tin đổi mật khẩu</h2>
            <form onSubmit={handleSavePassword}>
              <div className="formgrid">
                <label className="field">
                  Mật khẩu hiện tại
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    required
                  />
                </label>

                <label className="field">
                  Mật khẩu mới
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    required
                  />
                </label>

                <label className="field">
                  Nhập lại mật khẩu
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                  />
                </label>
              </div>

              <div className="formfoot">
                <button
                  type="button"
                  className="btn"
                  onClick={() => navigate('/')}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn primary"
                  disabled={loading}
                >
                  {loading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu demo'}
                </button>
              </div>
            </form>
          </section>
        )}

        {activeTab === 'notifications' && (
          <section className="card">
            <h2>Thông tin cài đặt thông báo</h2>
            <form onSubmit={handleSaveNotifications}>
              <div className="formgrid">
                <label className="field">
                  Thông báo ứng dụng
                  <select
                    value={pushNotif}
                    onChange={e => setPushNotif(e.target.value)}
                  >
                    <option value="Bật">Bật</option>
                    <option value="Tắt">Tắt</option>
                  </select>
                </label>

                <label className="field">
                  SMS khẩn cấp
                  <select
                    value={smsNotif}
                    onChange={e => setSmsNotif(e.target.value)}
                  >
                    <option value="Tắt">Tắt</option>
                    <option value="Bật">Bật</option>
                  </select>
                </label>

                <label className="field full">
                  Số điện thoại nhận cảnh báo
                  <input
                    type="tel"
                    value={alertPhone}
                    onChange={e => setAlertPhone(e.target.value)}
                  />
                </label>
              </div>

              <div className="formfoot">
                <button
                  type="button"
                  className="btn"
                  onClick={() => navigate('/')}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn primary"
                >
                  Lưu thông tin
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Right Column: Kiểm tra trước khi lưu (Exact FarmShift.html) */}
        <div>
          <section className="card">
            <h2>Kiểm tra trước khi lưu</h2>
            <div style={{ fontSize: 13, lineHeight: 1.8 }}>
              <p>Lứa hiện hành: <b>MB-2026-08</b></p>
              <p>Ngày nghiệp vụ mẫu: <b>21/10/2026</b></p>
              <p>Người thực hiện: <b>{roleTitle}</b></p>
            </div>
          </section>

          <div className="note">
            {activeTab === 'password'
              ? 'Bản demo chỉ kiểm tra form; không thay đổi mật khẩu của hệ thống thật.'
              : 'Dữ liệu được lưu trên trình duyệt này. Các trường có đơn vị cần nhập theo đúng đơn vị hiển thị.'}
          </div>
        </div>
      </div>

      {/* Avatar Cropper Modal */}
      {selectedImageToCrop && (
        <AvatarCropperModal
          imageSrc={selectedImageToCrop}
          onClose={() => setSelectedImageToCrop(null)}
          onCropComplete={handleCropComplete}
        />
      )}
    </DashboardLayout>
  );
};
