import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import { getProfile } from '../services/userService';
import { getAuthToken, setAuthToken, clearAuthToken } from '../utils/authStorage';
import { dataCache } from '../services/dataCache';

const AuthContext = createContext(null);

const getInitialUser = () => {
  const token = getAuthToken();
  if (token) {
    try {
      const decoded = jwtDecode(token);
      if (decoded.exp && decoded.exp * 1000 >= Date.now()) {
        const role = decoded.roles && decoded.roles.length > 0 ? decoded.roles[0] : null;
        return { email: decoded.sub || decoded.email, role };
      } else {
        clearAuthToken();
        dataCache.clearAll();
        sessionStorage.removeItem('demo_mode');
        return null;
      }
    } catch {
      clearAuthToken();
      dataCache.clearAll();
      sessionStorage.removeItem('demo_mode');
      return null;
    }
  }

  const isDemo = sessionStorage.getItem('demo_mode');
  if (isDemo) {
    return {
      name: 'Admin FarmShift',
      fullName: 'Admin FarmShift',
      email: 'admin@farmshift.local',
      phone: '0988 123 456',
      role: 'ROLE_FARM_OWNER',
      address: 'Xã Tân Dân, Huyện Sóc Sơn, Hà Nội'
    };
  }

  return null;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getInitialUser);
  const [loading, setLoading] = useState(() => Boolean(getAuthToken()));
  const [activeToken, setActiveToken] = useState(getAuthToken);

  const logout = useCallback(() => {
    clearAuthToken();
    dataCache.clearAll();
    sessionStorage.removeItem('demo_mode');
    setUser(null);
    setActiveToken(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const syncSession = (event) => {
      if (event.storageArea !== localStorage || (event.key !== 'token' && event.key !== null)) return;
      const nextUser = getInitialUser();
      setUser(nextUser);
      setActiveToken(getAuthToken());
      setLoading(Boolean(nextUser && getAuthToken()));
    };
    window.addEventListener('storage', syncSession);
    return () => window.removeEventListener('storage', syncSession);
  }, []);

  useEffect(() => {
    let isMounted = true;
    let safetyTimer;
    const token = getAuthToken();

    if (token) {
      // Safety timeout: đảm bảo màn hình loading không bị treo vĩnh viễn nếu backend chưa bật
      safetyTimer = setTimeout(() => {
        if (isMounted) setLoading(false);
      }, 2500);

      // Fetch full user profile from backend
      getProfile()
        .then(profile => {
          if (isMounted && profile && getAuthToken() === token) {
            setUser(prev => ({
              ...prev,
              name: profile.fullName || 'Admin',
              fullName: profile.fullName || 'Admin',
              avatarUrl: profile.avatarUrl,
              phone: profile.phone || '',
              citizenId: profile.citizenId || '',
              address: profile.address || '',
              dateOfBirth: profile.dateOfBirth || '',
              role: profile.role || (prev && prev.role)
            }));
          }
        })
        .catch(err => {
          console.warn("Backend profile fetch warning (using cached user):", err.message);
        })
        .finally(() => {
          clearTimeout(safetyTimer);
          if (isMounted) setLoading(false);
        });
    }

    const handleUnauthorized = () => {
      logout();
    };
    window.addEventListener('unauthorized', handleUnauthorized);

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      window.removeEventListener('unauthorized', handleUnauthorized);
    };
  }, [activeToken, logout]);

  const login = async (token, email, role) => {
    setAuthToken(token);
    sessionStorage.removeItem('demo_mode');
    setUser({ email, role });

    setLoading(true);
    setActiveToken(token);
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


  const updateUser = useCallback((updates) => {
    setUser((prev) => ({ ...prev, ...updates }));
  }, []);

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
