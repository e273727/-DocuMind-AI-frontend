// Centralized API Base configuration
// Supports VITE_API_BASE environment variable for production/Vercel deployments
export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';
