// Share real login sessions across tabs; migrate sessions from older versions.
export const getAuthToken = () => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  if (token) localStorage.setItem('token', token);
  sessionStorage.removeItem('token');
  return token;
};

export const setAuthToken = (token) => {
  localStorage.setItem('token', token);
  sessionStorage.removeItem('token');
};

export const clearAuthToken = () => {
  localStorage.removeItem('token');
  sessionStorage.removeItem('token');
};
