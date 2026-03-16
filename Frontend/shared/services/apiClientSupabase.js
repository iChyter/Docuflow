// apiClientSupabase.js - Cliente API unificado para Supabase
import { authService } from './authServiceSupabase.js';
import { fileService } from './fileServiceSupabase.js';
import { commentService } from './commentServiceSupabase.js';
import { dashboardService } from './dashboardServiceSupabase.js';
import { notificationService } from './notificationServiceSupabase.js';
import { userService } from './userServiceSupabase.js';
import { logService } from './logServiceSupabase.js';
import { SUPABASE_CONFIG } from './config.js';

class SupabaseApiClient {
  constructor() {
    this.baseUrl = SUPABASE_CONFIG.url;
    this.auth = authService;
    this.files = fileService;
    this.comments = commentService;
    this.dashboard = dashboardService;
    this.notifications = notificationService;
    this.users = userService;
    this.logs = logService;
  }

  // Verificar si hay conexión
  async checkConnection() {
    try {
      await this.dashboard.stats();
      return true;
    } catch (e) {
      return false;
    }
  }
}

// Instancia global
const docuFlowAPI = new SupabaseApiClient();

export { docuFlowAPI, authService, fileService, commentService, dashboardService, notificationService, userService, logService };
export default docuFlowAPI;
