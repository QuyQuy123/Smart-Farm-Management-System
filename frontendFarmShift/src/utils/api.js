// d:\Smart-Farm-Management-System\frontendFarmShift\src\utils\api.js
import axios from 'axios';

// The base URL should match the Spring Boot backend
export const api = axios.create({
  baseURL: 'http://localhost:8080/api', // Assuming backend is on 8080
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle 401s (e.g. token expired) globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token and force re-login if unauthorized
      localStorage.removeItem('token');
      // A full reload or custom event could be dispatched here 
      // if not relying purely on AuthContext reactivity.
    }
    return Promise.reject(error);
  }
);
