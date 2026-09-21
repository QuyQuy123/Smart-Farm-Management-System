import React, { useState, useRef } from 'react';
import { X, Upload, Trash2 } from 'lucide-react';
import { Input } from '../../components/Input/Input';
import { Button } from '../../components/Button/Button';
import { updateProfile, changePassword } from '../../services/userService';
import { useAuth } from '../../context/AuthContext';
import styles from './UserProfileModal.module.css';

export const UserProfileModal = ({ isOpen, onClose }) => {
  const { user, updateUser } = useAuth();
  
  // Profile State
  const [name, setName] = useState(user?.name || 'John Doe'); 
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const fileInputRef = useRef(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState(null);

  React.useEffect(() => {
    if (user) {
      setName(user.name || '');
      setAvatarUrl(user.avatarUrl || '');
    }
  }, [user]);

  // Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState(null);

  if (!isOpen || !user) return null;

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setLoadingProfile(true);
    setProfileMessage(null);
    try {
      await updateProfile({ fullName: name, avatarUrl });
      updateUser({ name, avatarUrl }); // Sync globally!
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
      // Create a local object URL for preview purposes
      const previewUrl = URL.createObjectURL(file);
      setAvatarUrl(previewUrl);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
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

            <Input 
              label="Full Name" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              required
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
  );
};
