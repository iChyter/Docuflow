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
    
    // Permisos que tienen TODOS los roles (admin, colaborador, usuario)
    const allRoles = ['admin', 'colaborador', 'usuario'];
    
    // Permisos exclusivos de admin
    const adminOnly = ['admin'];
    
    switch (permission) {
      // ARCHIVOS - Todos los roles pueden ver, subir, descargar
      case 'read_files':
      case 'view_files':
      case 'upload_files':
      case 'download_files':
      case 'share_files':
        return allRoles.includes(role);
      
      // ARCHIVOS - Solo admin puede eliminar cualquiera, otros solo propios
      case 'delete_any_file':
        return adminOnly.includes(role);
      case 'delete_own_file':
        return allRoles.includes(role);
      case 'delete_files':
        // Fallback: verificar si es admin o propietario en la lógica del componente
        return allRoles.includes(role);
      
      // ARCHIVOS - Editar: admin cualquiera, otros solo propios
      case 'edit_any_file':
        return adminOnly.includes(role);
      case 'edit_own_file':
        return allRoles.includes(role);
      case 'edit_files':
        return allRoles.includes(role);
      
      // COMENTARIOS - Todos los roles pueden ver, crear
      case 'read_comments':
      case 'view_comments':
      case 'create_comments':
        return allRoles.includes(role);
      
      // COMENTARIOS - Editar/Eliminar: admin cualquiera, otros solo propios
      case 'edit_any_comment':
        return adminOnly.includes(role);
      case 'edit_own_comment':
      case 'edit_comments':
        return allRoles.includes(role);
      case 'delete_any_comment':
        return adminOnly.includes(role);
      case 'delete_own_comment':
      case 'delete_comments':
        return allRoles.includes(role);
      
      // TAREAS - Asignar tareas
      case 'assign_tasks':
        return allRoles.includes(role);
      
      // USUARIOS - Solo admin
      case 'view_users':
      case 'create_users':
      case 'edit_users':
      case 'delete_users':
      case 'manage_users':
      case 'manage_permissions':
        return adminOnly.includes(role);
      
      // LOGS - Solo admin
      case 'view_logs':
      case 'export_logs':
      case 'delete_logs':
        return adminOnly.includes(role);
      
      // DASHBOARD - Todos pueden ver, estadísticas, exportar
      case 'view_dashboard':
      case 'view_statistics':
      case 'export_dashboard':
        return allRoles.includes(role);
      
      // SISTEMA - Solo admin
      case 'system_settings':
      case 'system_backup':
      case 'system_maintenance':
      case 'manage_system':
        return adminOnly.includes(role);
      
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
