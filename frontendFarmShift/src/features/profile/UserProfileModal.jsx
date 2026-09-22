import React, { useState, useRef } from 'react';
import { X, Upload, Trash2 } from 'lucide-react';
import { Input } from '../../components/Input/Input';
import { Button } from '../../components/Button/Button';
import { updateProfile, changePassword } from '../../services/userService';
import { useAuth } from '../../context/AuthContext';
import { AvatarCropperModal } from './AvatarCropperModal';
import styles from './UserProfileModal.module.css';

export const UserProfileModal = ({ isOpen, onClose }) => {
  const { user, updateUser } = useAuth();

  // Profile State
  const [name, setName] = useState(user?.name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [citizenId, setCitizenId] = useState(user?.citizenId || '');
  const [address, setAddress] = useState(user?.address || '');
  const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth || '');

  const fileInputRef = useRef(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState(null);
  
  // Cropper State
  const [selectedImageToCrop, setSelectedImageToCrop] = useState(null);

  React.useEffect(() => {
    if (user) {
      setName(user.name || '');
      setAvatarUrl(user.avatarUrl || '');
      setPhone(user.phone || '');
      setCitizenId(user.citizenId || '');
      setAddress(user.address || '');
      setDateOfBirth(user.dateOfBirth || '');
    }
  }, [user]);

  // Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState(null);

  const [errors, setErrors] = useState({});

  if (!isOpen || !user) return null;

  const validateProfile = () => {
    const newErrors = {};
    if (!name.trim()) {
      newErrors.name = 'Full name cannot be blank';
    }
    if (phone && !/^\d{10,11}$/.test(phone)) {
      newErrors.phone = 'Phone number must be 10-11 digits';
    }
    if (citizenId && !/^(\d{9}|\d{12})$/.test(citizenId)) {
      newErrors.citizenId = 'Citizen ID must be 9 or 12 digits';
    }
    if (dateOfBirth) {
      const dobDate = new Date(dateOfBirth);
      if (dobDate >= new Date()) {
        newErrors.dateOfBirth = 'Date of birth must be in the past';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    if (!validateProfile()) return;

    setLoadingProfile(true);
    setProfileMessage(null);
    setErrors({});
    try {
      const payload = {
        fullName: name,
        avatarUrl,
        phone: phone || null,
        citizenId: citizenId || null,
        address: address || null,
        dateOfBirth: dateOfBirth || null
      };
      await updateProfile(payload);
      updateUser({
        name,
        avatarUrl,
        phone,
        citizenId,
        address,
        dateOfBirth
      }); // Sync globally!
      setProfileMessage({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err) {
      setProfileMessage({ type: 'error', text: 'Failed to update profile.' });
    } finally {
      setLoadingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 8 characters.' });
      return;
    }

    setLoadingPassword(true);
    setPasswordMessage(null);
    try {
      await changePassword({ currentPassword, newPassword });
      setPasswordMessage({ type: 'success', text: 'Password changed successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to change password.'
      });
    } finally {
      setLoadingPassword(false);
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.addEventListener('load', () => setSelectedImageToCrop(reader.result?.toString() || ''));
      reader.readAsDataURL(file);
      // Reset input value so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl('');
  };

  return (
    <>
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>

        <div className={styles.header}>
          <h2 className={styles.title}>Account Settings</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Profile Details Section */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Personal Information</h3>

          {profileMessage && (
            <div className={`${styles.alert} ${profileMessage.type === 'error' ? styles.alertError : styles.alertSuccess}`}>
              {profileMessage.text}
            </div>
          )}

          <form className={styles.form} onSubmit={handleProfileSubmit}>
            {/* Row 1: Email & Role */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <Input
                label="Email Address"
                value={user.email}
                disabled
                helper="Your email address cannot be changed."
              />
              <Input
                label="Role"
                value={user.role.replace('ROLE_', '').replace('_', ' ')}
                disabled
              />
            </div>

            {/* Row 2: Full Name & Phone Number */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <Input 
                label="Full Name" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                error={errors.name}
                required
              />
              <Input 
                label="Phone Number" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
                error={errors.phone}
              />
            </div>

            {/* Row 3: Citizen ID & Date of Birth */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <Input 
                label="Citizen ID / CCCD" 
                value={citizenId} 
                onChange={(e) => setCitizenId(e.target.value)} 
                error={errors.citizenId}
              />
              <Input 
                label="Date of Birth" 
                type="date"
                value={dateOfBirth} 
                onChange={(e) => setDateOfBirth(e.target.value)} 
                error={errors.dateOfBirth}
              />
            </div>

            {/* Row 4: Address (Full width) */}
            <Input 
              label="Address" 
              value={address} 
              onChange={(e) => setAddress(e.target.value)} 
              error={errors.address}
            />

            <div className={styles.avatarSection}>
              <span className={styles.avatarLabel}>Profile Picture</span>
              <div className={styles.avatarContainer}>
                <div className={styles.avatarPreview}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className={styles.avatarImage} />
                  ) : (
                    <div className={styles.avatarPlaceholder}>
                      {name ? name.charAt(0).toUpperCase() : 'U'}
                    </div>
                  )}
                </div>

                <div className={styles.avatarActions}>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAvatarChange}
                    accept="image/*"
                    style={{ display: 'none' }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                    className={styles.uploadBtn}
                  >
                    <Upload size={16} /> Upload Photo
                  </Button>

                  {avatarUrl && (
                    <button type="button" className={styles.removeBtn} onClick={handleRemoveAvatar}>
                      <Trash2 size={16} /> Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <Button type="submit" loading={loadingProfile}>
                Save Changes
              </Button>
            </div>
          </form>
        </div>

        {/* Change Password Section */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Change Password</h3>

          {passwordMessage && (
            <div className={`${styles.alert} ${passwordMessage.type === 'error' ? styles.alertError : styles.alertSuccess}`}>
              {passwordMessage.text}
            </div>
          )}

          <form className={styles.form} onSubmit={handlePasswordSubmit}>
            <Input
              label="Current Password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />

            <Input
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />

            <Input
              label="Confirm New Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />

            <div style={{ marginTop: '16px' }}>
              <Button type="submit" loading={loadingPassword}>
                Update Password
              </Button>
            </div>
          </form>
        </div>

      </div>
      </div>
      
      {selectedImageToCrop && (
        <AvatarCropperModal
          imageSrc={selectedImageToCrop}
          onClose={() => setSelectedImageToCrop(null)}
          onCropComplete={(croppedBase64) => {
            setAvatarUrl(croppedBase64);
            setSelectedImageToCrop(null);
          }}
        />
      )}
    </>
  );
};
