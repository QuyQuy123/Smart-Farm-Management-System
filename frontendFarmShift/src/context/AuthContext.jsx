// d:\Smart-Farm-Management-System\frontendFarmShift\src\context\AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import { getProfile } from '../services/userService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing token on mount
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        
        // Check if token is expired
        if (decoded.exp * 1000 < Date.now()) {
          logout();
          setLoading(false);
        } else {
          // The backend embeds roles in the JWT. For simplicity, assume first role.
          const role = decoded.roles && decoded.roles.length > 0 ? decoded.roles[0] : null;
          
          // First set basic info from token
          setUser({ email: decoded.sub, role });
          
          // Then fetch full profile asynchronously
          const fetchProfile = async () => {
            try {
              const profile = await getProfile();
              setUser(prev => ({
                ...prev,
                name: profile.fullName,
                avatarUrl: profile.avatarUrl
              }));
            } catch (err) {
              console.error("Failed to fetch profile on init:", err);
            } finally {
              setLoading(false);
            }
          };
          fetchProfile();
        }
      } catch (e) {
        logout(); // Invalid token
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const login = (token, email, role) => {
    localStorage.setItem('token', token);
    setUser({ email, role });
  };

  const logout = () => {
    localStorage.removeItem('token');
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
