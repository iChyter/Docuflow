// Servicio de Autenticación con Seguridad Avanzada para DocuFlow
// Implementa autenticación JWT con Supabase

import { SUPABASE_CONFIG } from './config.js';
import { supabase } from './supabaseClient.js';

const EDGE_FUNCTION_URL = SUPABASE_CONFIG.functions.auth;

class AuthService {
  constructor() {
    this.isAuthenticated = false;
    this.currentUser = null;
    this.loginAttempts = new Map();
    this.sessionTimeout = 30 * 60 * 1000;
    this.refreshTokenTimeout = null;
    this.securityConfig = {
      maxLoginAttempts: 5,
      lockoutDuration: 15 * 60 * 1000
    };
    
    this.init();
  }

  async init() {
    await this.checkStoredSession();
    this.setupSessionMonitoring();
  }

  async login(credentials) {
    try {
      if (!this.validateCredentials(credentials)) {
        throw new Error('Invalid credentials format');
      }

      if (this.isLoginRateLimited(credentials.email)) {
        const remainingTime = this.getRemainingLockoutTime(credentials.email);
        throw new Error(`Too many login attempts. Try again in ${Math.ceil(remainingTime / 60000)} minutes.`);
      }

      const response = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'login', 
          data: { email: credentials.email, password: credentials.password } 
        })
      });

      const result = await response.json();
      
      if (!result.success) {
        this.recordFailedLogin(credentials.email);
        throw new Error(result.error || 'Login failed');
      }

      await this.handleSuccessfulLogin(result.data);
      this.recordSuccessfulLogin(credentials.email);
      return result.data;

    } catch (error) {
      this.recordFailedLogin(credentials.email);
      throw error;
    }
  }

  async handleSuccessfulLogin(loginData) {
    if (loginData.user) {
      this.currentUser = loginData.user;
      localStorage.setItem('docuflow_user', JSON.stringify(loginData.user));
      localStorage.setItem('docuflow_token', loginData.token || 'supabase-session');
    }

    this.isAuthenticated = true;
    
    this.setupTokenRefresh(24 * 60 * 60 * 1000);
  }

  async logout() {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn('Server logout failed:', error.message);
    }

    await this.clearSession();
  }

  async clearSession() {
    this.isAuthenticated = false;
    this.currentUser = null;
    
    localStorage.removeItem('docuflow_user');
    localStorage.removeItem('docuflow_token');
    localStorage.removeItem('docuflow_login_time');

    if (this.refreshTokenTimeout) {
      clearTimeout(this.refreshTokenTimeout);
      this.refreshTokenTimeout = null;
    }
  }

  async getValidToken() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || localStorage.getItem('docuflow_token');
  }

  setupTokenRefresh(expiresIn) {
    if (this.refreshTokenTimeout) {
      clearTimeout(this.refreshTokenTimeout);
    }

    const refreshTime = expiresIn - (5 * 60 * 1000);
    
    this.refreshTokenTimeout = setTimeout(async () => {
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (error) throw error;
        this.setupTokenRefresh(24 * 60 * 60 * 1000);
      } catch (error) {
        console.error('Automatic token refresh failed:', error);
        await this.logout();
      }
    }, refreshTime);
  }

  validateCredentials(credentials) {
    if (!credentials || typeof credentials !== 'object') {
      return false;
    }

    const { email, password } = credentials;

    if (!email || typeof email !== 'string') {
      return false;
    }

    if (!password || typeof password !== 'string' || password.length === 0) {
      return false;
    }

    return true;
  }

  isLoginRateLimited(email) {
    const attempts = this.loginAttempts.get(email);
    
    if (!attempts) {
      return false;
    }

    return attempts.count >= this.securityConfig.maxLoginAttempts &&
           Date.now() - attempts.lastAttempt < this.securityConfig.lockoutDuration;
  }

  getRemainingLockoutTime(email) {
    const attempts = this.loginAttempts.get(email);
    
    if (!attempts) {
      return 0;
    }

    const timeSinceLastAttempt = Date.now() - attempts.lastAttempt;
    return Math.max(0, this.securityConfig.lockoutDuration - timeSinceLastAttempt);
  }

  recordFailedLogin(email) {
    const now = Date.now();
    const attempts = this.loginAttempts.get(email) || { count: 0, lastAttempt: 0 };

    if (now - attempts.lastAttempt > this.securityConfig.lockoutDuration) {
      attempts.count = 0;
    }

    attempts.count++;
    attempts.lastAttempt = now;
    
    this.loginAttempts.set(email, attempts);
  }

  recordSuccessfulLogin(email) {
    this.loginAttempts.delete(email);
  }

  setupSessionMonitoring() {
    setInterval(async () => {
      if (this.isAuthenticated) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          await this.logout();
        }
      }
    }, 60000);
  }

  async checkStoredSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (session && !error) {
        this.isAuthenticated = true;
        this.currentUser = session.user;
        
        localStorage.setItem('docuflow_user', JSON.stringify(session.user));
        
        return true;
      } else {
        const storedUser = localStorage.getItem('docuflow_user');
        if (storedUser) {
          this.isAuthenticated = true;
          this.currentUser = JSON.parse(storedUser);
          return true;
        }
        return false;
      }
    } catch (error) {
      console.error('Error checking stored session:', error);
      return false;
    }
  }

  async getCurrentUser() {
    if (!this.isAuthenticated) {
      return null;
    }

    if (!this.currentUser) {
      const stored = localStorage.getItem('docuflow_user');
      this.currentUser = stored ? JSON.parse(stored) : null;
    }

    return this.currentUser;
  }

  async isUserAuthenticated() {
    if (!this.isAuthenticated) {
      return false;
    }

    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  }

  async hasRole(role) {
    const user = await this.getCurrentUser();
    return user && user.role === role;
  }

  getToken() {
    return this.getValidToken();
  }

  getUser() {
    return this.getCurrentUser();
  }

  setUser(user) {
    this.currentUser = user;
  }

  async changePassword(currentPassword, newPassword) {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;
      return data;

    } catch (error) {
      throw error;
    }
  }

  async requestPasswordReset(email) {
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/features/auth/login.html`
      });

      if (error) throw error;
      return data;

    } catch (error) {
      throw error;
    }
  }

  clearSecurityState() {
    this.loginAttempts.clear();
    if (this.refreshTokenTimeout) {
      clearTimeout(this.refreshTokenTimeout);
    }
  }
}

const authService = new AuthService();

export { AuthService, authService };
export default authService;
