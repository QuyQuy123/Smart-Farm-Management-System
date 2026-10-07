// src/context/AuthContext.jsx
// Quản lý phiên làm việc & đồng bộ với Spring Boot Backend API
import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import { getProfile } from '../services/userService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const token = sessionStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);

        // Check expiration
        if (decoded.exp && decoded.exp * 1000 < Date.now()) {
          logout();
          if (isMounted) setLoading(false);
        } else {
          const role = decoded.roles && decoded.roles.length > 0 ? decoded.roles[0] : null;
          if (isMounted) setUser({ email: decoded.sub || decoded.email, role });

          // Fetch full user profile from backend
          getProfile()
            .then(profile => {
              if (isMounted && profile) {
                setUser(prev => ({
                  ...prev,
                  name: profile.fullName || 'Admin',
                  fullName: profile.fullName || 'Admin',
                  avatarUrl: profile.avatarUrl,
                  phone: profile.phone || '',
                  citizenId: profile.citizenId || '',
                  address: profile.address || '',
                  dateOfBirth: profile.dateOfBirth || '',
                  role: profile.role || role
                }));
              }
            })
            .catch(err => {
              console.warn("Backend profile fetch warning (using cached user):", err.message);
            })
            .finally(() => {
              if (isMounted) setLoading(false);
            });
        }
      } catch (e) {
        logout();
        if (isMounted) setLoading(false);
      }
    } else {
      // If demo mode was flagged
      const isDemo = sessionStorage.getItem('demo_mode');
      if (isDemo) {
        setUser({
          name: 'Admin FarmShift',
          fullName: 'Admin FarmShift',
          email: 'admin@farmshift.local',
          phone: '0988 123 456',
          role: 'ROLE_FARM_OWNER',
          address: 'Xã Tân Dân, Huyện Sóc Sơn, Hà Nội'
        });
      }
      if (isMounted) setLoading(false);
    }

    const handleUnauthorized = () => {
      logout();
    };
    window.addEventListener('unauthorized', handleUnauthorized);

    return () => {
      isMounted = false;
      window.removeEventListener('unauthorized', handleUnauthorized);
    };
  }, []);

  const login = async (token, email, role) => {
    sessionStorage.setItem('token', token);
    sessionStorage.removeItem('demo_mode');
    setUser({ email, role });

    try {
      const profile = await getProfile();
      if (profile) {
        setUser(prev => ({
          ...prev,
          name: profile.fullName || 'Admin FarmShift',
          fullName: profile.fullName || 'Admin FarmShift',
          avatarUrl: profile.avatarUrl,
          phone: profile.phone,
          citizenId: profile.citizenId,
          address: profile.address,
          dateOfBirth: profile.dateOfBirth,
          role: profile.role || role
        }));
      }
    } catch (err) {
      console.warn("Could not fetch full profile post-login:", err.message);
    }
  };

  const loginDemo = (role = 'ROLE_FARM_OWNER', name = 'Admin FarmShift', email = 'admin@farmshift.local') => {
    sessionStorage.setItem('demo_mode', 'true');
    setUser({
      name,
      fullName: name,
      email,
      role,
      phone: '0988 123 456',
      address: 'Xã Tân Dân, Huyện Sóc Sơn, Hà Nội'
    });
  };

  const logout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('demo_mode');
    setUser(null);
  };

  const updateUser = (updates) => {
    setUser((prev) => ({ ...prev, ...updates }));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginDemo, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export const useFarmShift = useAuth;
export const useFarmgo = useAuth;
export const FarmShiftContext = AuthContext;
export const FarmgoContext = AuthContext;
