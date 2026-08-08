import axios from 'axios';

// Creating a reusable axios instance pointing to your Java Spring Boot server.
// Same-origin (/v1) so the app works identically on localhost and the ngrok URL
// from any device; Vite dev-server proxy forwards /v1 to the backend.
const api = axios.create({
  baseURL: '/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Automatic ah user-oda secure JWT token-ah Java API-ku attach பண்ணும்
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: on 401/403 from protected endpoints, clear the session and send the user back to sign in
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    const isAuthRequest = url.startsWith('/auth/');
    if ((status === 401 || status === 403) && !isAuthRequest) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
      if (window.location.pathname !== '/signin') {
        window.location.assign('/signin');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
