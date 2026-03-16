// Configuración centralizada de DocuFlow

// Detectar entorno automáticamente
const isLocalhost = ['localhost', '127.0.0.1', '0.0.0.0', ''].includes(window.location.hostname);

// Configuración de Supabase
const SUPABASE_URL = 'https://nlgcevktvqwgddibxsja.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sZ2Nldmt0dnF3Z2RkaWJ4c2phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2OTEzMDIsImV4cCI6MjA4OTI2NzMwMn0.bGRQHbEcrQMKnacIqM76aCS86wOEyL1p4O-4enZypXE';
const EDGE_FUNCTION_BASE = `${SUPABASE_URL}/functions/v1`;

export const SUPABASE_CONFIG = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
  edgeFunctionUrl: EDGE_FUNCTION_BASE,
  bucket: 'documents',
  functions: {
    auth: `${EDGE_FUNCTION_BASE}/auth`,
    files: `${EDGE_FUNCTION_BASE}/files`,
    comments: `${EDGE_FUNCTION_BASE}/comments`,
    logs: `${EDGE_FUNCTION_BASE}/logs`,
    dashboard: `${EDGE_FUNCTION_BASE}/dashboard`,
    notifications: `${EDGE_FUNCTION_BASE}/notifications`,
    users: `${EDGE_FUNCTION_BASE}/users`
  }
};

// Inyectar config globalmente para los servicios
window.APP_CONFIG = {
  SUPABASE_URL: SUPABASE_CONFIG.url,
  SUPABASE_ANON_KEY: SUPABASE_CONFIG.anonKey,
  EDGE_FUNCTION_URL: SUPABASE_CONFIG.edgeFunctionUrl,
  functions: SUPABASE_CONFIG.functions
};

export const CONFIG = {
  // URLs de API por entorno (Legacy - para compatibilidad)
  API_ENDPOINTS: {
    development: 'http://localhost:3000/api',
    production: 'https://docuflow-backend.onrender.com/api'
  },

  // Configuraciones de la aplicación
  APP: {
    name: 'DocuFlow',
    version: '2.0.0',  // Nueva versión con Supabase
    timeout: 10000
  },

  // Configuraciones de autenticación
  AUTH: {
    tokenKey: 'authToken',
    userDataKey: 'userData',
    refreshTokenKey: 'refreshToken',
    sessionTimeout: 24 * 60 * 60 * 1000 // 24 horas
  },

  // Modo Supabase (nuevo)
  USE_SUPABASE: true
};

// URL del backend (Legacy)
export const BACKEND_URL = isLocalhost 
  ? 'http://localhost:8080'
  : 'https://docuflow-backend.onrender.com';

// URL de la API (Legacy)
export const API_URL = isLocalhost
  ? CONFIG.API_ENDPOINTS.development
  : CONFIG.API_ENDPOINTS.production;

// Función para obtener configuración actual
export function getCurrentConfig() {
  return {
    ...CONFIG,
    supabase: SUPABASE_CONFIG,
    environment: isLocalhost ? 'development' : 'production',
    apiUrl: API_URL,
    backendUrl: BACKEND_URL,
    isDevelopment: isLocalhost,
    isProduction: !isLocalhost
  };
}