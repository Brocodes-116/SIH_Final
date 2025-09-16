import axios from 'axios';

// Base URL for API calls
const API_BASE_URL = 'http://localhost:5001/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Soft-handle 401s without nuking session to avoid unintended logouts on background calls
    // Callers should catch and handle 401s contextually
    return Promise.reject(error);
  }
);

// Authentication APIs
export const authAPI = {
  // User signup
  signup: async (userData) => {
    const response = await api.post('/auth/signup', userData);
    return response.data;
  },

  // User login
  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },
};

// Tourist APIs
export const touristAPI = {
  // Get all tourists
  getAllTourists: async () => {
    const response = await api.get('/tourists');
    return response.data;
  },

  // Create tourist profile
  createTourist: async (touristData) => {
    const response = await api.post('/tourists', touristData);
    return response.data;
  },

  // Update tourist location
  updateLocation: async (touristId, location) => {
    const response = await api.put(`/tourists/${touristId}/location`, location);
    return response.data;
  },
};

// SOS APIs
export const sosAPI = {
  // Get all SOS alerts
  getAllSOS: async () => {
    const response = await api.get('/sos');
    return response.data;
  },

  // Create SOS alert
  createSOS: async (sosData) => {
    const response = await api.post('/sos', sosData);
    return response.data;
  },

  // Respond to SOS alert
  respondToSOS: async (sosId, responseData) => {
    const response = await api.put(`/sos/${sosId}/respond`, responseData);
    return response.data;
  },

  // Delete SOS alert
  deleteSOS: async (sosId) => {
    const response = await api.delete(`/sos/${sosId}`);
    return response.data;
  },
};

// Position APIs
export const positionAPI = {
  // Get all live positions (authorities only)
  getLivePositions: async () => {
    const response = await api.get('/position/live');
    return response.data;
  },
};

// Health check API
export const healthAPI = {
  check: async () => {
    const response = await api.get('/health');
    return response.data;
  },
};

export default api;
