// Right Sidebar Component - Botones de acción para cada página
class RightSidebarComponent {
  constructor() {
    this.currentPage = this.detectCurrentPage();
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

  getPath(page) {
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

  getActions() {
    const actions = {
      dashboard: [
        { icon: 'bi-cloud-upload', text: 'Subir Archivo', onclick: "window.location.href='../files/upload.html'", primary: true },
        { icon: 'bi-plus-lg', text: 'Nuevo Comentario', onclick: "window.location.href='../comments/comments.html'" }
      ],
      files: [
        { icon: 'bi-cloud-upload', text: 'Subir Archivo', onclick: 'window.openUploadModal()', primary: true },
        { icon: 'bi-folder', text: 'Nueva Carpeta', onclick: 'alert("Próximamente")' }
      ],
      comments: [
        { icon: 'bi-plus-lg', text: 'Nuevo Comentario', onclick: 'window.openCommentModal()', primary: true }
      ],
      logs: [
        { icon: 'bi-download', text: 'Exportar Logs', onclick: 'window.exportLogs()', primary: true }
      ],
      permissions: [
        { icon: 'bi-person-plus', text: 'Crear Usuario', onclick: 'window.openCreateUserModal()', primary: true, id: 'btn-create-user-action' }
      ],
      export: [
        { icon: 'bi-file-earmark-pdf', text: 'Exportar PDF', onclick: 'window.exportPDF()' },
        { icon: 'bi-file-earmark-excel', text: 'Exportar Excel', onclick: 'window.exportExcel()' },
        { icon: 'bi-file-earmark-spreadsheet', text: 'Exportar CSV', onclick: 'window.exportCSV()' }
      ],
      settings: [
        { icon: 'bi-check-lg', text: 'Guardar Perfil', onclick: 'window.saveProfile()', primary: true },
        { icon: 'bi-key', text: 'Cambiar Contraseña', onclick: 'document.getElementById("new-password").focus()' }
      ]
    };

    return actions[this.currentPage] || [];
  }

  async loadDashboardData() {
    try {
      const { supabase } = await import('../../shared/services/supabaseClient.js');
      
      // Load last 5 logs (table is called 'logs')
      const { data: logs } = await supabase
        .from('logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      
      // Load storage info with file types
      const { data: files } = await supabase
        .from('documents')
        .select('size, file_type')
        .eq('is_deleted', false);
      
      const totalSize = files?.reduce((acc, f) => acc + (f.size || 0), 0) || 0;
      
      // Calculate by file type
      const docsSize = files?.filter(f => f.file_type?.includes('pdf') || f.file_type?.includes('document')).reduce((acc, f) => acc + (f.size || 0), 0) || 0;
      const imagesSize = files?.filter(f => f.file_type?.includes('image')).reduce((acc, f) => acc + (f.size || 0), 0) || 0;
      const othersSize = totalSize - docsSize - imagesSize;
      
      return { logs: logs || [], totalSize, docsSize, imagesSize, othersSize, fileCount: files?.length || 0 };
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      return { logs: [], totalSize: 0, docsSize: 0, imagesSize: 0, othersSize: 0, fileCount: 0 };
    }
  }

  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Ahora';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  }

  getLogIcon(action) {
    const icons = {
      'upload': 'bi-cloud-upload',
      'create': 'bi-plus-circle',
      'update': 'bi-pencil',
      'delete': 'bi-trash',
      'download': 'bi-download',
      'login': 'bi-box-arrow-in-right',
      'logout': 'bi-box-arrow-left'
    };
    return icons[action] || 'bi-circle';
  }

  async renderDashboardExtras() {
    if (this.currentPage !== 'dashboard') return '';
    
    const { logs, totalSize, docsSize, imagesSize, othersSize, fileCount } = await this.loadDashboardData();
    
    const totalLimit = 5 * 1024 * 1024 * 1024; // 5GB
    const percentage = Math.round((totalSize / totalLimit) * 100);
    
    return `
      <!-- Storage Info with detail -->
      <div style="padding: 20px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
          <span style="font-size: 16px; font-weight: 600;">Almacenamiento</span>
          <i class="bi bi-hdd" style="color: var(--primary-color); font-size: 20px;"></i>
        </div>
        
        <!-- Circle chart -->
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="width: 100px; height: 100px; margin: 0 auto 12px; position: relative;">
            <svg viewBox="0 0 36 36" style="width: 100%; height: 100%; transform: rotate(-90deg);">
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--border)" stroke-width="3"/>
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--primary-color)" stroke-width="3" stroke-dasharray="${percentage}, 100"/>
            </svg>
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">
              <div style="font-size: 18px; font-weight: 700;">${percentage}%</div>
            </div>
          </div>
          <div style="font-size: 14px; font-weight: 600;">${this.formatSize(totalSize)}</div>
          <div style="font-size: 12px; color: var(--text-muted);">de 5 GB totales</div>
        </div>
        
        <!-- File count -->
        <div style="background: var(--surface-hover); border-radius: 10px; padding: 12px; text-align: center; margin-bottom: 16px;">
          <div style="font-size: 24px; font-weight: 700; color: var(--primary-color);">${fileCount}</div>
          <div style="font-size: 12px; color: var(--text-muted);">archivos subidos</div>
        </div>
        
        <!-- Breakdown -->
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
            <span style="display: flex; align-items: center; gap: 8px;">
              <span style="width: 10px; height: 10px; background: var(--primary-color); border-radius: 50%;"></span>
              Documentos
            </span>
            <span style="font-weight: 600;">${this.formatSize(docsSize)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
            <span style="display: flex; align-items: center; gap: 8px;">
              <span style="width: 10px; height: 10px; background: var(--success); border-radius: 50%;"></span>
              Imágenes
            </span>
            <span style="font-weight: 600;">${this.formatSize(imagesSize)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
            <span style="display: flex; align-items: center; gap: 8px;">
              <span style="width: 10px; height: 10px; background: var(--warning); border-radius: 50%;"></span>
              Otros
            </span>
            <span style="font-weight: 600;">${this.formatSize(othersSize)}</span>
          </div>
        </div>
      </div>
      
      <!-- Last 5 Logs -->
      <div style="padding: 20px; border-top: 1px solid var(--border);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <span style="font-size: 14px; font-weight: 600;">Actividad Reciente</span>
          <i class="bi bi-clock-history" style="color: var(--primary-color);"></i>
        </div>
        ${logs.length === 0 ? '<div style="font-size: 13px; color: var(--text-muted);">Sin actividad reciente</div>' : ''}
        ${logs.map(log => `
          <div style="display: flex; align-items: flex-start; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border);">
            <div style="width: 28px; height: 28px; background: var(--surface-hover); border-radius: 6px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <i class="bi ${this.getLogIcon(log.action)}" style="font-size: 12px; color: var(--text-muted);"></i>
            </div>
            <div style="flex: 1; min-width: 0;">
              <div style="font-size: 12px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${log.details || log.action}</div>
              <div style="font-size: 10px; color: var(--text-muted);">${this.formatDate(log.created_at)}</div>
            </div>
          </div>
        `).join('')}
        <a href="../logs/logs.html" style="display: block; text-align: center; padding: 10px; font-size: 12px; color: var(--primary-color); text-decoration: none; margin-top: 8px;">
          Ver todos los logs <i class="bi bi-arrow-right"></i>
        </a>
      </div>
    `;
  }

  async render() {
    const actions = this.getActions();
    
    // Create buttons HTML (only for pages that don't have their own sidebar buttons)
    // Skip dashboard (has custom content) and comments (has own buttons in HTML)
    let buttonsHtml = '';
    if (this.currentPage !== 'dashboard' && this.currentPage !== 'comments' && actions.length > 0) {
      buttonsHtml = `
        <div class="sidebar-section" style="border-bottom: 1px solid var(--border); margin-bottom: 16px; padding-bottom: 16px;">
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${actions.map(action => `
              <button 
                class="${action.primary ? 'btn-primary' : 'btn-secondary'}" 
                onclick="${action.onclick}"
                ${action.id ? `id="${action.id}"` : ''}
                style="width: 100%; justify-content: flex-start; gap: 10px; padding: 12px 16px;"
              >
                <i class="bi ${action.icon}"></i>
                ${action.text}
              </button>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Get page-specific extras (like logs and storage for dashboard)
    const extras = await this.renderDashboardExtras();
    
    const html = buttonsHtml + extras;

    // Try to find existing right sidebar or create new one
    let sidebar = document.getElementById('right-sidebar-container');
    
    if (sidebar) {
      sidebar.insertAdjacentHTML('afterbegin', html);
    } else {
      const existingSidebar = document.querySelector('.right-sidebar');
      if (existingSidebar) {
        existingSidebar.insertAdjacentHTML('afterbegin', html);
      }
    }
  }
}

// Initialize right sidebar when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  try {
    window.rightSidebarComponent = new RightSidebarComponent();
    await window.rightSidebarComponent.render();
  } catch (error) {
    console.error('[RightSidebar] Error initializing:', error);
  }
});

export { RightSidebarComponent };
