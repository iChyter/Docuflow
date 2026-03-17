// Sidebar Component - Reutilizable para todas las páginas
class SidebarComponent {
  constructor() {
    this.currentPage = this.detectCurrentPage();
    this.stats = {
      files: 0,
      comments: 0,
      users: 0
    };
    this.basePath = this.calculateBasePath();
  }

  detectCurrentPage() {
    const path = window.location.pathname;
    if (path.includes('dashboard')) return 'dashboard';
    if (path.includes('upload') || path.includes('files')) return 'files';
    if (path.includes('comments')) return 'comments';
    if (path.includes('logs')) return 'logs';
    if (path.includes('permissions')) return 'permissions';
    if (path.includes('export')) return 'export';
    if (path.includes('settings')) return 'settings';
    return 'dashboard';
  }

  calculateBasePath() {
    // Get the current script path to determine depth
    const currentScript = document.currentScript;
    if (currentScript) {
      const scriptSrc = currentScript.src;
      // If sidebar.js is at /shared/components/sidebar.js
      // and page is at /features/dashboard/dashboard.html
      // then base path should be './'
      if (scriptSrc.includes('shared/components/sidebar.js')) {
        return './';
      }
    }
    // Default: assume we're in a feature folder like /features/dashboard/
    return './';
  }

  getPath(page) {
    // All feature pages are at the same level: /features/[feature]/
    // So paths are relative: from any feature to another: ../[other-feature]/
    const paths = {
      dashboard: '../dashboard/dashboard.html',
      files: '../files/upload.html',
      comments: '../comments/comments.html',
      logs: '../logs/logs.html',
      permissions: '../permissions/permissions.html',
      export: '../export/export.html',
      settings: '../settings/settings.html'
    };
    return paths[page] || '#';
  }

  getNavItem(href, icon, text, page, badge = null) {
    const isActive = this.currentPage === page ? 'active' : '';
    const badgeHtml = badge ? `<span class="badge" id="nav-${page}-count">${badge}</span>` : '';
    return `
      <a href="${href}" class="nav-item ${isActive}">
        <i class="bi ${icon}"></i>
        <span>${text}</span>
        ${badgeHtml}
      </a>
    `;
  }

  render() {
    const sidebar = document.getElementById('sidebar-container');
    if (!sidebar) return;

    sidebar.innerHTML = `
      <div class="sidebar-header">
        <div class="logo">D</div>
        <span class="brand-name">DocuFlow</span>
      </div>
      
      <div class="sidebar-search">
        <div class="search-box">
          <i class="bi bi-search"></i>
          <input type="text" placeholder="Buscar..." id="sidebar-search">
        </div>
      </div>
      
      <nav class="sidebar-nav">
        <div class="nav-section">
          ${this.getNavItem(this.getPath('dashboard'), 'bi-house-door', 'Inicio', 'dashboard')}
          ${this.getNavItem(this.getPath('files'), 'bi-folder', 'Archivos', 'files')}
          ${this.getNavItem(this.getPath('comments'), 'bi-chat-dots', 'Comentarios', 'comments')}
          ${this.getNavItem(this.getPath('logs'), 'bi-journal-text', 'Logs', 'logs')}
        </div>
        
        <div class="nav-section">
          ${this.getNavItem(this.getPath('permissions'), 'bi-people', 'Usuarios', 'permissions')}
          ${this.getNavItem(this.getPath('export'), 'bi-download', 'Exportar', 'export')}
        </div>
      </nav>
      
      <div class="sidebar-footer" style="margin-top: auto; padding: 16px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 12px; flex: 1; cursor: pointer;" onclick="window.location.href='../settings/settings.html'">
            <img src="https://ui-avatars.com/api/?name=Usuario&background=6366f1&color=fff" alt="User" class="user-avatar" id="sidebar-user-avatar" style="width: 40px; height: 40px;">
            <div class="user-info" style="flex: 1; min-width: 0;">
              <div class="user-name" id="sidebar-user-name" style="font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Usuario</div>
              <div class="user-role" id="sidebar-user-role" style="font-size: 12px; color: var(--text-muted);">Colaborador</div>
            </div>
          </div>
          <a href="#" onclick="if(confirm('¿Estás seguro de que quieres cerrar sesión?')){window.sidebarComponent.handleLogout();} return false;" style="display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 8px; color: var(--danger); text-decoration: none; flex-shrink: 0;" title="Cerrar sesión">
            <i class="bi bi-box-arrow-right" style="font-size: 18px;"></i>
          </a>
        </div>
      </div>
    `;

    // Add search functionality
    const searchInput = document.getElementById('sidebar-search');
    if (searchInput) {
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const query = e.target.value;
          if (query) {
            // Store search query and redirect to files
            localStorage.setItem('sidebar_search_query', query);
            window.location.href = this.getPath('files');
          }
        }
      });
    }
  }

  updateStats(stats) {
    this.stats = { ...this.stats, ...stats };
    
    // Update badges
    const fileBadge = document.getElementById('nav-files-count');
    const commentBadge = document.getElementById('nav-comments-count');
    const userBadge = document.getElementById('nav-permissions-count');
    
    if (fileBadge) fileBadge.textContent = this.stats.files;
    if (commentBadge) commentBadge.textContent = this.stats.comments;
    if (userBadge) userBadge.textContent = this.stats.users;
  }

  updateUserInfo(user) {
    if (!user) {
      console.warn('[Sidebar] updateUserInfo called with null user');
      return;
    }
    
    console.log('[Sidebar] Updating user info:', user);
    
    const nameEl = document.getElementById('sidebar-user-name');
    const avatarEl = document.getElementById('sidebar-user-avatar');
    
    if (nameEl) {
      const displayName = user.user_metadata?.username || user.user_metadata?.full_name || user.email || 'Usuario';
      console.log('[Sidebar] Setting username to:', displayName);
      nameEl.textContent = displayName;
    } else {
      console.warn('[Sidebar] Name element not found');
    }
    
    if (avatarEl) {
      const name = user.user_metadata?.username || user.user_metadata?.full_name || user.email || 'Usuario';
      avatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff`;
    } else {
      console.warn('[Sidebar] Avatar element not found');
    }
  }

  updateUserRole(role) {
    const roleEl = document.getElementById('sidebar-user-role');
    if (roleEl) {
      const roleLabels = {
        'admin': 'Administrador',
        'colaborador': 'Colaborador',
        'usuario': 'Usuario'
      };
      roleEl.textContent = roleLabels[role] || 'Usuario';
    }
  }

  async handleLogout() {
    try {
      // Import auth service dynamically
      const { authService } = await import('../../shared/services/authServiceSupabase.js');
      await authService.logout();
      window.location.href = '../auth/login.html';
    } catch (error) {
      console.error('Logout error:', error);
      // Fallback
      localStorage.removeItem('docuflow_token');
      localStorage.removeItem('docuflow_user');
      window.location.href = '../auth/login.html';
    }
  }

  async loadUserInfo() {
    try {
      console.log('[Sidebar] Loading user info...');
      const { authService } = await import('../../shared/services/authServiceSupabase.js');
      const user = await authService.getCurrentUser();
      console.log('[Sidebar] User loaded:', user);
      if (user) {
        this.updateUserInfo(user);
        
        // Also load role from profile
        try {
          const { supabase } = await import('../../shared/services/supabaseClient.js');
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
          
          if (profile?.role) {
            this.updateUserRole(profile.role);
          }
        } catch (roleError) {
          console.log('Could not load role:', roleError);
        }
      } else {
        console.warn('[Sidebar] No user found');
      }
    } catch (error) {
      console.error('[Sidebar] Error loading user info:', error);
    }
  }
}

// Initialize sidebar when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  try {
    window.sidebarComponent = new SidebarComponent();
    window.sidebarComponent.render();
    
    // Load user info automatically (don't block if it fails)
    try {
      await window.sidebarComponent.loadUserInfo();
    } catch (e) {
      console.warn('[Sidebar] Could not load user info:', e);
    }
  } catch (error) {
    console.error('[Sidebar] Error initializing:', error);
  }
  
  // Emit event when sidebar is ready
  window.dispatchEvent(new CustomEvent('sidebarReady'));
});

export { SidebarComponent };
