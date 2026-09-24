// d:\Smart-Farm-Management-System\frontendFarmShift\src\context\AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import { getProfile } from '../services/userService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true; // abort flag to prevent setState after unmount

    // Check for existing token on mount
    const token = sessionStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        
        // Check if token is expired
        if (decoded.exp * 1000 < Date.now()) {
          logout();
          if (isMounted) setLoading(false);
        } else {
          // The backend embeds roles in the JWT. For simplicity, assume first role.
          const role = decoded.roles && decoded.roles.length > 0 ? decoded.roles[0] : null;
          
          // First set basic info from token
          if (isMounted) setUser({ email: decoded.sub, role });
          
          // Then fetch full profile asynchronously
          const fetchProfile = async () => {
            try {
              const profile = await getProfile();
              if (isMounted) {
                setUser(prev => ({
                  ...prev,
                  name: profile.fullName,
                  avatarUrl: profile.avatarUrl,
                  phone: profile.phone,
                  citizenId: profile.citizenId,
                  address: profile.address,
                  dateOfBirth: profile.dateOfBirth
                }));
              }
            } catch (err) {
              console.error("Failed to fetch profile on init:", err);
            } finally {
              if (isMounted) setLoading(false);
            }
          };
          fetchProfile();
        }
      } catch (e) {
        logout(); // Invalid token
        if (isMounted) setLoading(false);
      }
    } else {
      if (isMounted) setLoading(false);
    }

    // Listen for unauthorized events from api interceptor
    const handleUnauthorized = () => {
      logout();
    };
    window.addEventListener('unauthorized', handleUnauthorized);

    return () => {
      isMounted = false; // prevent any pending setState calls
      window.removeEventListener('unauthorized', handleUnauthorized);
    };
  }, []);

  const login = async (token, email, role) => {
    sessionStorage.setItem('token', token);
    setUser({ email, role });
    
    try {
      const profile = await getProfile();
      setUser(prev => ({
        ...prev,
        name: profile.fullName,
        avatarUrl: profile.avatarUrl,
        phone: profile.phone,
        citizenId: profile.citizenId,
        address: profile.address,
        dateOfBirth: profile.dateOfBirth
      }));
    } catch (err) {
      console.error("Failed to fetch profile after login:", err);
    }
  };

  const logout = () => {
    sessionStorage.removeItem('token');
    setUser(null);
  };

  const updateUser = (updates) => {
    setUser((prev) => ({ ...prev, ...updates }));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
