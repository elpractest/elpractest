import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: true,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

let csrfPromise = null;

export const getCsrfToken = () => {
  if (!csrfPromise) {
    csrfPromise = api.get('/sanctum/csrf-cookie')
      .catch((err) => {
        csrfPromise = null; // reset on error so it can retry
        throw err;
      });
  }
  return csrfPromise;
};

// Add interceptor to automatically fetch CSRF cookie before write requests
api.interceptors.request.use(async (config) => {
  if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase())) {
    await getCsrfToken();
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

let on2FARequired = null;

export const setOn2FARequired = (callback) => {
  on2FARequired = callback;
};

// Add interceptor to capture 403 responses that require 2FA setup/verification
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response &&
      error.response.status === 403 &&
      error.response.data &&
      error.response.data['2fa_required']
    ) {
      if (on2FARequired) {
        on2FARequired(!!error.response.data['2fa_setup_needed']);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
