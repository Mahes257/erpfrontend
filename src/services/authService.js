import api from '../api/axiosInstance';

const TOKEN_KEY = 'authToken';
const USER_KEY = 'authUser';

function decodeJwtPayload(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

export function storeAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isTokenExpired(token) {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return true;
  return payload.exp * 1000 <= Date.now();
}

export function isAuthenticated() {
  const token = getStoredToken();
  return Boolean(token) && !isTokenExpired(token);
}

function toAuthError(error) {
  if (error.response) {
    const message =
      error.response.data?.message ||
      error.response.data?.error ||
      error.response.data?.detail ||
      `Request failed with status ${error.response.status}`;
    return new Error(message);
  }
  if (error.request) {
    return new Error('Unable to reach the server. Please check your network connection.');
  }
  return new Error(error.message || 'Invalid Email or Password');
}

const authService = {
  async login(email, password) {
    try {
      const { data } = await api.post('/auth/login', { email, password });
      return data;
    } catch (error) {
      throw toAuthError(error);
    }
  }
};

export default authService;
