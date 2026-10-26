// src/utils/api.js
import axios from 'axios';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({ baseURL: BASE });

// Attach JWT token to every request if available
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('eco_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login = (email, password) =>
  api.post('/auth/login', { email, password });

// ── Landing ───────────────────────────────────────────────────────────────────
export const getLandingSummary = () => api.get('/landing/summary');

// ── Admin ─────────────────────────────────────────────────────────────────────
export const uploadCityFile   = (formData) =>
  api.post('/admin/upload-city', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });

export const getAdminDashboard = () => api.get('/admin/dashboard');
export const getAdminCity      = (city) => api.get(`/admin/city/${city}`);
export const exportCityPDF     = (city) =>
  api.post(`/admin/export-pdf/${city}`, {}, { responseType: 'blob' });

export const runSimulator = (city, component, improvement) =>
  api.post('/admin/simulate', { city, component, improvement });

// ── Public ────────────────────────────────────────────────────────────────────
export const getLeaderboard  = () => api.get('/public/leaderboard');
export const getPublicCities = () => api.get('/public/cities');
export const getPublicCity   = (city) => api.get(`/public/city/${city}`);
export const getHeadToHead   = (a, b) => api.get(`/public/head-to-head/${a}/${b}`);

// ── Citizen ───────────────────────────────────────────────────────────────────
export const checkCitizenInput    = (data) => api.post('/citizen/check', data);
export const getPersonalExposure  = (city, years) =>
  api.post('/citizen/personal-exposure', { city, years_lived: years });
