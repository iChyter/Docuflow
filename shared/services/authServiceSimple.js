// authServiceSimple.js - Servicio de autenticación simplificado basado en Supabase
import { supabase } from './supabaseClient.js';
import { SUPABASE_CONFIG } from './config.js';

const EDGE_FUNCTION_URL = SUPABASE_CONFIG.functions.auth;

class SimpleAuthService {
  constructor() {
    this.currentUser = null;
    this.isAuthenticated = false;
  }

  async loadStoredUser() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (session) {
        this.currentUser = session.user;
        this.isAuthenticated = true;
        localStorage.setItem('docuflow_token', session.access_token);
        localStorage.setItem('docuflow_user', JSON.stringify(session.user));
        localStorage.setItem('docuflow_login_time', Date.now().toString());
      } else {
        const token = localStorage.getItem('docuflow_token');
        const userStr = localStorage.getItem('docuflow_user');
        
        if (token && userStr) {
          this.currentUser = JSON.parse(userStr);
          this.isAuthenticated = true;
        }
      }
    } catch (error) {
      console.warn('Error cargando usuario:', error.message);
    }
  }

  async login(credentials) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.username || credentials.email,
        password: credentials.password
      });

      if (error) {
        throw new Error(error.message);
      }

      const { user, session } = data;
      
      this.currentUser = user;
      this.isAuthenticated = true;
      
      localStorage.setItem('docuflow_token', session.access_token);
      localStorage.setItem('docuflow_user', JSON.stringify(user));
      localStorage.setItem('docuflow_login_time', Date.now().toString());
      
      console.log('✅ Login exitoso:', user.email);
      return { success: true, user, token: session.access_token };
    } catch (error) {
      console.error('❌ Error en login:', error);
      return { success: false, error: error.message };
    }
  }

  async logout() {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn('Error al cerrar sesión:', error.message);
    }
    
    this.currentUser = null;
    this.isAuthenticated = false;
    localStorage.removeItem('docuflow_token');
    localStorage.removeItem('docuflow_user');
    localStorage.removeItem('docuflow_login_time');
    
    console.log('✅ Sesión cerrada');
    return { success: true };
  }

  getCurrentUser() {
    if (!this.currentUser) {
      const userStr = localStorage.getItem('docuflow_user');
      if (userStr) {
        try {
          this.currentUser = JSON.parse(userStr);
        } catch (e) {}
      }
    }
    return this.currentUser;
  }

  isLoggedIn() {
    const user = localStorage.getItem('docuflow_user');
    if (!user) return false;
    
    const loginTime = parseInt(localStorage.getItem('docuflow_login_time') || '0');
    const now = Date.now();
    const elapsed = now - loginTime;
    const SESSION_DURATION = 24 * 60 * 60 * 1000;
    
    if (elapsed > SESSION_DURATION) {
      this.logout();
      return false;
    }
    
    return true;
  }

  isAuthenticated() {
    return this.isLoggedIn();
  }

  hasPermission(permission) {
    const user = this.getCurrentUser();
    if (!user) return false;
    
    const role = user.role || 'usuario';
    
    switch (permission) {
      case 'upload_files':
        return ['admin', 'colaborador'].includes(role);
      case 'edit_files':
        return ['admin', 'colaborador'].includes(role);
      case 'delete_files':
        return ['admin'].includes(role);
      case 'manage_users':
        return ['admin'].includes(role);
      case 'view_logs':
        return ['admin'].includes(role);
      case 'read_files':
        return ['admin', 'colaborador', 'usuario'].includes(role);
      case 'create_comments':
        return ['admin', 'colaborador', 'usuario'].includes(role);
      case 'edit_own_comments':
        return ['admin', 'colaborador', 'usuario'].includes(role);
      case 'delete_own_comments':
        return ['admin', 'colaborador', 'usuario'].includes(role);
      default:
        return false;
    }
  }

  isAdmin() {
    const user = this.getCurrentUser();
    return user?.role === 'admin';
  }

  isCollaborator() {
    const user = this.getCurrentUser();
    return user?.role === 'colaborador';
  }

  isUser() {
    const user = this.getCurrentUser();
    return user?.role === 'usuario';
  }

  getRole() {
    const user = this.getCurrentUser();
    return user?.role || 'usuario';
  }

  getToken() {
    return localStorage.getItem('docuflow_token') || '';
  }

  isTokenValid() {
    const token = this.getToken();
    return token.length > 0;
  }

  async refreshSession() {
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession();
      
      if (error) {
        await this.logout();
        return false;
      }
      
      if (session) {
        localStorage.setItem('docuflow_token', session.access_token);
        localStorage.setItem('docuflow_user', JSON.stringify(session.user));
        return true;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }
}

const authService = new SimpleAuthService();
authService.loadStoredUser();

export { SimpleAuthService, authService };
export default authService;
