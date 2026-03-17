// Cliente API moderno con Supabase para DocuFlow
import { SUPABASE_CONFIG } from './config.js';
import { authService } from './authServiceSupabase.js';
import { supabase } from './supabaseClient.js';

class ApiClient {
  constructor() {
    this.baseUrl = SUPABASE_CONFIG.edgeFunctionUrl;
    this.offlineMode = false;
    this.interceptors = {
      request: [],
      response: [],
      error: []
    };
    
    this.defaults = {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    };
  }

  addRequestInterceptor(fn) {
    this.interceptors.request.push(fn);
    return this;
  }

  addResponseInterceptor(fn) {
    this.interceptors.response.push(fn);
    return this;
  }

  addErrorInterceptor(fn) {
    this.interceptors.error.push(fn);
    return this;
  }

  async request(endpoint, options = {}) {
    try {
      let config = {
        method: options.method || 'GET',
        headers: {
          ...this.defaults.headers,
          ...options.headers
        },
        ...options
      };

      for (const interceptor of this.interceptors.request) {
        config = await interceptor(config, endpoint);
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, config);

      let processedResponse = response;
      for (const interceptor of this.interceptors.response) {
        processedResponse = await interceptor(processedResponse, config, endpoint);
      }

      return await this.handleResponse(processedResponse, options);

    } catch (error) {
      for (const interceptor of this.interceptors.error) {
        error = await interceptor(error, endpoint, options);
      }
      throw error;
    }
  }

  async handleResponse(response, options = {}) {
    const contentType = response.headers.get('content-type');
    let data;

    try {
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else if (contentType && contentType.includes('text/')) {
        data = await response.text();
      } else {
        data = await response.blob(); 
      }
    } catch (parseError) {
      console.warn('Could not parse response:', parseError);
      data = null;
    }

    if (response.ok) {
      return {
        success: true,
        data,
        status: response.status,
        headers: response.headers,
        response
      };
    } else {
      const error = new ApiError(
        data?.error || data?.message || `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        data,
        response
      );
      throw error;
    }
  }

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, body, options = {}) {
    const config = { ...options, method: 'POST' };
    if (body) {
      if (body instanceof FormData) {
        delete config.headers['Content-Type'];
        config.body = body;
      } else {
        config.body = JSON.stringify(body);
      }
    }
    return this.request(endpoint, config);
  }

  put(endpoint, body, options = {}) {
    const config = { ...options, method: 'PUT' };
    if (body) {
      if (body instanceof FormData) {
        delete config.headers['Content-Type'];
        config.body = body;
      } else {
        config.body = JSON.stringify(body);
      }
    }
    return this.request(endpoint, config);
  }

  patch(endpoint, body, options = {}) {
    const config = { ...options, method: 'PATCH' };
    if (body) {
      config.body = JSON.stringify(body);
    }
    return this.request(endpoint, config);
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }

  async upload(endpoint, file, options = {}) {
    const user = authService.getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const fileName = `${Date.now()}_${file.name}`;
    const filePath = `${user.id}/${fileName}`;

    const { data, error } = await supabase.storage
      .from(SUPABASE_CONFIG.bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type
      });

    if (error) {
      throw new Error(error.message || 'Upload failed');
    }

    return { success: true, data: { path: filePath } };
  }

  async download(endpoint, options = {}) {
    const filePath = endpoint.replace('/download?', '').replace('/', '');
    
    const { data, error } = await supabase.storage
      .from(SUPABASE_CONFIG.bucket)
      .download(filePath);

    if (error) {
      throw new Error(error.message || 'Download failed');
    }

    return { success: true, data };
  }

  setTimeout(timeout) {
    this.defaults.timeout = timeout;
    return this;
  }

  setDefaultHeaders(headers) {
    this.defaults.headers = { ...this.defaults.headers, ...headers };
    return this;
  }

  setBaseUrl(baseUrl) {
    this.baseUrl = baseUrl;
    return this;
  }
}

class ApiError extends Error {
  constructor(message, status = 0, data = null, response = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.response = response;
  }

  get isNetworkError() {
    return this.status === 0;
  }

  get isClientError() {
    return this.status >= 400 && this.status < 500;
  }

  get isServerError() {
    return this.status >= 500;
  }

  get isAuthError() {
    return this.status === 401 || this.status === 403;
  }
}

const apiClient = new ApiClient();

apiClient.addRequestInterceptor((config, endpoint) => {
  const token = localStorage.getItem('docuflow_token');
  if (token && !config.headers['Authorization']) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

const EDGE_FUNCTION_URL = SUPABASE_CONFIG.edgeFunctionUrl;

async function callEdgeFunction(action, data = {}) {
  const token = localStorage.getItem('docuflow_token');
  
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    },
    body: JSON.stringify({ action, data })
  });

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'Unknown error');
  }
  
  return result.data;
}

const docuFlowAPI = {
  auth: {
    login: async (credentials) => {
      const result = await callEdgeFunction('auth-login', credentials);
      if (result.token) {
        localStorage.setItem('docuflow_token', result.token);
        localStorage.setItem('docuflow_user', JSON.stringify(result.user));
      }
      return { success: true, ...result };
    },
    register: (userData) => callEdgeFunction('auth-register', userData),
    logout: async () => {
      await supabase.auth.signOut();
      localStorage.removeItem('docuflow_token');
      localStorage.removeItem('docuflow_user');
    }
  },

  files: {
    getAll: () => callEdgeFunction('files-list', {}),
    getById: (id) => callEdgeFunction('files-get', { id }),
    upload: (file, metadata = {}) => callEdgeFunction('files-upload', { file, metadata }),
    download: (id) => callEdgeFunction('files-download', { id }),
    delete: (id) => callEdgeFunction('files-delete', { id })
  },

  comments: {
    getAll: () => callEdgeFunction('comments-list', {}),
    getByFileId: (fileId) => callEdgeFunction('comments-get-by-file', { fileId }),
    create: (comment) => callEdgeFunction('comments-create', comment),
    update: (id, comment) => callEdgeFunction('comments-update', { id, ...comment }),
    delete: (id) => callEdgeFunction('comments-delete', { id })
  },

  dashboard: {
    getStats: () => callEdgeFunction('dashboard-stats', {}),
    getRecentActivity: () => callEdgeFunction('dashboard-activity', {})
  },

  permissions: {
    getAll: () => callEdgeFunction('permissions-list', {}),
    update: (userId, permissions) => callEdgeFunction('permissions-update', { userId, permissions })
  },

  logs: {
    getAll: (params = {}) => callEdgeFunction('logs-list', params)
  },

  profile: {
    getCurrent: () => callEdgeFunction('profile-get', {}),
    update: (data) => callEdgeFunction('profile-update', data),
    uploadAvatar: (file) => callEdgeFunction('profile-upload-avatar', { file }),
    removeAvatar: () => callEdgeFunction('profile-remove-avatar', {}),
    getActivity: (params) => callEdgeFunction('profile-activity', params),
    getPreferences: () => callEdgeFunction('profile-preferences-get', {}),
    updatePreferences: (preferences) => callEdgeFunction('profile-preferences-update', { preferences }),
    changePassword: (data) => callEdgeFunction('profile-change-password', data),
    getStats: () => callEdgeFunction('profile-stats', {}),
    getSessions: () => callEdgeFunction('profile-sessions', {}),
    revokeSession: (sessionId) => callEdgeFunction('profile-revoke-session', { sessionId })
  },

  export: {
    generatePdf: (type, options) => callEdgeFunction('export-pdf', { type, options }),
    generateExcel: (type, options) => callEdgeFunction('export-excel', { type, options }),
    generateCsv: (type, options) => callEdgeFunction('export-csv', { type, options }),
    getReportStatus: (reportId) => callEdgeFunction('export-status', { reportId }),
    downloadReport: (reportId, format) => callEdgeFunction('export-download', { reportId, format }),
    getReportPreview: (type, options) => callEdgeFunction('export-preview', { type, options }),
    getExportHistory: () => callEdgeFunction('export-history', {}),
    scheduleReport: (scheduleData) => callEdgeFunction('export-schedule', scheduleData),
    cancelScheduledReport: (scheduleId) => callEdgeFunction('export-cancel-schedule', { scheduleId }),
    deleteReport: (reportId) => callEdgeFunction('export-delete', { reportId }),
    getScheduledReports: () => callEdgeFunction('export-scheduled', {})
  }
};

export function persistAuthTokens(accessToken, refreshToken) {
  if (accessToken) {
    localStorage.setItem('docuflow_token', accessToken);
  }
}

export function clearAuthTokens() {
  localStorage.removeItem('docuflow_token');
  localStorage.removeItem('docuflow_user');
}

export function getStoredAccessToken() {
  return localStorage.getItem('docuflow_token');
}

export function getStoredRefreshToken() {
  return localStorage.getItem('docuflow_refresh_token');
}

export { ApiClient, ApiError, apiClient, docuFlowAPI };
export default apiClient;
