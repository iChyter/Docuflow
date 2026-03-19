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
    this.permissions = {};
    this.userRole = null;
    this.permissionsLoaded = false;
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
    const path = window.location.pathname;

    if (!path.includes('/features/')) {
      return './';
    }

    return './';
  }

  getPath(page) {
    const path = window.location.pathname;
    const isInRoot = !path.includes('/features/');

    const basePath = isInRoot ? 'features/' : '../';

    const paths = {
      dashboard: `${basePath}dashboard/dashboard.html`,
      files: `${basePath}files/upload.html`,
      comments: `${basePath}comments/comments.html`,
      logs: `${basePath}logs/logs.html`,
      permissions: `${basePath}permissions/permissions.html`,
      export: `${basePath}export/export.html`,
      settings: `${basePath}settings/settings.html`
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

  async loadPermissions() {
    try {
      console.log('[Sidebar] Intentando cargar permisos...');
      const { permissionService } = await import('../services/permissionService.js');

      console.log('[Sidebar] permissionService importado:', !!permissionService);

      this.permissions = await permissionService.loadPermissions();
      this.userRole = await permissionService.getUserRole();

      console.log('[Sidebar] Permisos cargados:', this.permissions);
      console.log('[Sidebar] Rol del usuario:', this.userRole);
    } catch (error) {
      console.error('[Sidebar] Error cargando permisos:', error);
      this.permissions = {
        dashboard: { ver: true },
        archivos: { ver: true, subir: true, descargar: true },
        comentarios: { ver: true, crear: true },
        usuarios: { ver: true }
      };
      this.userRole = 'usuario';
      console.log('[Sidebar] Usando permisos por defecto:', this.permissions);
    }
  }

  hasPermission(module, permission) {
    if (!this.permissionsLoaded) {
      const defaults = {
        dashboard: { ver: true, exportar: true },
        archivos: { ver: true, subir: true, descargar: true },
        comentarios: { ver: true, crear: true },
        usuarios: { ver: true },
        logs: { ver: true, exportar: true }
      };
      
      if (module === 'logs' && permission === 'exportar') {
        return !!defaults.logs?.exportar;
      }
      
      return !!defaults[module]?.[permission];
    }
    return !!this.permissions[module]?.[permission];
  }

  updatePermissionsUI() {
    const showLogs = this.hasPermission('logs', 'ver');
    const showUsers = this.hasPermission('usuarios', 'ver');
    const showExport = this.hasPermission('logs', 'exportar') || this.hasPermission('dashboard', 'exportar');

    console.log('[Sidebar] Actualizando UI incremental:', { showLogs, showUsers, showExport });

    const logsNav = document.querySelector('[href*="logs"]');
    const usersNav = document.querySelector('[href*="permissions"]');
    const exportNav = document.querySelector('[href*="export"]');

    if (logsNav) {
      logsNav.style.display = showLogs ? '' : 'none';
    }
    if (usersNav) {
      usersNav.style.display = showUsers ? '' : 'none';
    }
    if (exportNav) {
      exportNav.style.display = showExport ? '' : 'none';
    }
  }

  render() {
    const sidebar = document.getElementById('sidebar-container');
    if (!sidebar) return;

    const showDashboard = this.hasPermission('dashboard', 'ver');
    const showFiles = this.hasPermission('archivos', 'ver');
    const showComments = this.hasPermission('comentarios', 'ver');
    const showLogs = this.hasPermission('logs', 'ver');
    const showUsers = this.hasPermission('usuarios', 'ver');
    const showExport = this.hasPermission('logs', 'exportar') || this.hasPermission('dashboard', 'exportar');
    const showSettings = this.hasPermission('sistema', 'configuraciones');

    console.log('[Sidebar] Renderizando sidebar:', {
      permissionsLoaded: this.permissionsLoaded,
      showDashboard,
      showFiles,
      showComments,
      showLogs,
      showUsers,
      showExport,
      showSettings
    });

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
          ${showDashboard ? this.getNavItem(this.getPath('dashboard'), 'bi-house-door', 'Inicio', 'dashboard') : ''}
          ${showFiles ? this.getNavItem(this.getPath('files'), 'bi-folder', 'Archivos', 'files') : ''}
          ${showComments ? this.getNavItem(this.getPath('comments'), 'bi-chat-dots', 'Comentarios', 'comments') : ''}
          ${showLogs ? this.getNavItem(this.getPath('logs'), 'bi-journal-text', 'Logs', 'logs') : ''}
        </div>

        <div class="nav-section">
          ${showUsers ? this.getNavItem(this.getPath('permissions'), 'bi-people', 'Usuarios', 'permissions') : ''}
          ${showExport ? this.getNavItem(this.getPath('export'), 'bi-download', 'Exportar', 'export') : ''}
        </div>
      </nav>

      <div class="sidebar-footer" style="margin-top: auto; padding: 16px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 12px; flex: 1; cursor: pointer;" id="sidebar-user-info">
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

    const searchInput = document.getElementById('sidebar-search');
    if (searchInput) {
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const query = e.target.value;
          if (query) {
            localStorage.setItem('sidebar_search_query', query);
            window.location.href = this.getPath('files');
          }
        }
      });
    }

    const userInfoDiv = document.getElementById('sidebar-user-info');
    if (userInfoDiv && showSettings) {
      userInfoDiv.onclick = () => {
        window.location.href = this.getPath('settings');
      };
    }

    if (!document.querySelector('.mobile-menu-btn')) {
      const menuBtn = document.createElement('button');
      menuBtn.className = 'mobile-menu-btn';
      menuBtn.innerHTML = '<i class="bi bi-list"></i>';
      menuBtn.onclick = () => this.toggleSidebar();
      document.body.appendChild(menuBtn);
    }

    if (!document.querySelector('.mobile-overlay')) {
      const overlay = document.createElement('div');
      overlay.className = 'mobile-overlay';
      overlay.onclick = () => this.closeSidebar();
      document.body.appendChild(overlay);
    }
  }

  toggleSidebar() {
    const sidebar = document.getElementById('sidebar-container');
    const overlay = document.querySelector('.mobile-overlay');

    if (sidebar) {
      sidebar.classList.toggle('open');
    }
    if (overlay) {
      overlay.classList.toggle('active');
    }
  }

  closeSidebar() {
    const sidebar = document.getElementById('sidebar-container');
    const overlay = document.querySelector('.mobile-overlay');

    if (sidebar) {
      sidebar.classList.remove('open');
    }
    if (overlay) {
      overlay.classList.remove('active');
    }
  }

  updateStats(stats) {
    this.stats = { ...this.stats, ...stats };

    const fileBadge = document.getElementById('nav-files-count');
    const commentBadge = document.getElementById('nav-comments-count');
    const userBadge = document.getElementById('nav-permissions-count');

    if (fileBadge) {
      fileBadge.textContent = this.stats.files;
    }
    if (commentBadge) {
      commentBadge.textContent = this.stats.comments;
    }
    if (userBadge) {
      userBadge.textContent = this.stats.users;
    }
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
      const { authService } = await import('../../shared/services/authServiceSupabase.js');
      await authService.logout();
      window.location.href = '../../features/auth/login.html';
    } catch (error) {
      console.error('Logout error:', error);
      localStorage.removeItem('docuflow_token');
      localStorage.removeItem('docuflow_user');
      window.location.href = '../../features/auth/login.html';
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

        try {
          const { supabase } = await import('../../shared/services/supabaseClient.js');

          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

          console.log('[Sidebar] Profile role from DB:', profile?.role);

          if (profile?.role) {
            this.updateUserRole(profile.role);
            this.userRole = profile.role;
          }
        } catch (roleError) {
          console.log('Could not load role from permissionService:', roleError);
        }
      } else {
        console.warn('[Sidebar] No user found');
      }
    } catch (error) {
      console.error('[Sidebar] Error loading user info:', error);
    }
  }
}

document.addEventListener('DOMContentLoaded', async function() {
  try {
    window.sidebarComponent = new SidebarComponent();

    console.log('[Sidebar] Renderizando sidebar inmediatamente...');
    window.sidebarComponent.render();

    console.log('[Sidebar] Cargando permisos en background...');
    window.sidebarComponent.loadPermissions()
      .then(() => {
        console.log('[Sidebar] Permisos cargados, actualizando UI...');
        window.sidebarComponent.updatePermissionsUI();
        window.sidebarComponent.permissionsLoaded = true;
      })
      .catch((error) => {
        console.warn('[Sidebar] Error cargando permisos, usando defaults:', error);
      });

    window.sidebarComponent.loadUserInfo().catch((e) => {
      console.warn('[Sidebar] Could not load user info:', e);
    });

    console.log('[Sidebar] Sidebar inicializado');

    window.dispatchEvent(new CustomEvent('sidebarReady'));
  } catch (error) {
    console.error('[Sidebar] Error initializing:', error);
  }
});

export { SidebarComponent };
