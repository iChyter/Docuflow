// permissionGuard.js - Utilidad para proteger páginas según permisos
import { permissionService } from './permissionService.js'

/**
 * Verifica si el usuario tiene permiso para acceder a una página
 * @param {string} module - Módulo requerido (archivos, comentarios, usuarios, logs, dashboard, sistema)
 * @param {string} permission - Permiso requerido (ver, crear, editar, eliminar, etc.)
 * @param {string} redirectTo - URL a redirigir si no tiene permiso (default: dashboard)
 */
export async function requirePermission(module, permission, redirectTo = null) {
  const hasAccess = await permissionService.hasPermission(module, permission)
  
  if (!hasAccess) {
    console.warn(`[PermissionGuard] Acceso denegado: ${module}.${permission}`)
    
    // Mostrar mensaje de error
    if (typeof showToast === 'function') {
      showToast('No tienes permiso para acceder a esta sección', 'error')
    } else {
      alert('No tienes permiso para acceder a esta sección')
    }
    
    // Redirigir
    const redirectUrl = redirectTo || getDashboardPath()
    window.location.href = redirectUrl
    return false
  }
  
  return true
}

/**
 * Obtiene la ruta al dashboard según la ubicación actual
 */
function getDashboardPath() {
  const path = window.location.pathname
  const isInRoot = !path.includes('/features/')
  return isInRoot ? 'features/dashboard/dashboard.html' : '../dashboard/dashboard.html'
}

/**
 * Aplica permisos a elementos de la UI
 * Oculta o deshabilita elementos según los permisos del usuario
 */
export async function applyPermissions() {
  // Ocultar botones de eliminar si no tiene permiso
  const canDeleteFiles = await permissionService.canDeleteFiles()
  if (!canDeleteFiles) {
    document.querySelectorAll('[data-perm="files:delete"]').forEach(el => {
      el.style.display = 'none'
    })
  }
  
  // Ocultar botones de eliminar comentarios si no tiene permiso
  const canDeleteComments = await permissionService.canDeleteComments()
  if (!canDeleteComments) {
    document.querySelectorAll('[data-perm="comments:delete"]').forEach(el => {
      el.style.display = 'none'
    })
  }
  
  // Ocultar sección de usuarios si no tiene permiso
  const canViewUsers = await permissionService.canViewUsers()
  if (!canViewUsers) {
    document.querySelectorAll('[data-perm="users:view"]').forEach(el => {
      el.style.display = 'none'
    })
  }
  
  // Ocultar sección de logs si no tiene permiso
  const canViewLogs = await permissionService.canViewLogs()
  if (!canViewLogs) {
    document.querySelectorAll('[data-perm="logs:view"]').forEach(el => {
      el.style.display = 'none'
    })
  }
  
  // Ocultar exportar si no tiene permiso
  const canExport = await permissionService.canExportDashboard() || await permissionService.canExportLogs()
  if (!canExport) {
    document.querySelectorAll('[data-perm="export"]').forEach(el => {
      el.style.display = 'none'
    })
  }
}

/**
 * Verifica permisos específicos para habilitar/deshabilitar botones
 * @param {string} module - Módulo
 * @param {string} permission - Permiso
 * @param {HTMLElement} element - Elemento a habilitar/deshabilitar
 */
export async function checkPermission(module, permission, element) {
  const hasPermission = await permissionService.hasPermission(module, permission)
  
  if (!hasPermission) {
    element.disabled = true
    element.style.opacity = '0.5'
    element.style.cursor = 'not-allowed'
    element.title = 'No tienes permiso para esta acción'
  }
}

/**
 * Inicializa el guardián de permisos en una página
 * @param {Object} config - Configuración de permisos requeridos
 */
export async function initPermissionGuard(config = {}) {
  // Verificar permiso de acceso a la página
  if (config.module && config.permission) {
    const hasAccess = await requirePermission(config.module, config.permission, config.redirectTo)
    if (!hasAccess) return false
  }
  
  // Aplicar permisos a elementos de UI
  await applyPermissions()
  
  return true
}

export { permissionService }
export default permissionService
