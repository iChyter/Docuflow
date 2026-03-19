// permissionService.js - Servicio de gestión de permisos basado en roles
import { supabase } from './supabaseClient.js'

export const permissionService = {
  // Cache de permisos para evitar múltiples consultas
  _permissionsCache: null,
  _userRole: null,
  _cacheTimestamp: null,
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutos

  // localStorage keys para caché de rol
  ROLE_CACHE_KEY: 'docuflow_role',
  ROLE_CACHE_TIME_KEY: 'docuflow_role_time',

  // Limpiar cache
  clearCache() {
    this._permissionsCache = null
    this._userRole = null
    this._cacheTimestamp = null
  },

  // Obtener el rol del usuario actual
  async getUserRole() {
    try {
      // 1. Verificar caché en localStorage primero
      const cachedRole = localStorage.getItem(this.ROLE_CACHE_KEY)
      const cachedTime = localStorage.getItem(this.ROLE_CACHE_TIME_KEY)

      if (cachedRole && cachedTime) {
        const cacheAge = Date.now() - parseInt(cachedTime)
        // Si caché es válido (menos de 5 minutos), retornar inmediatamente
        if (cacheAge < this.CACHE_DURATION) {
          this._userRole = cachedRole
          console.log('[PermissionService] Rol obtenido de caché localStorage:', cachedRole, `(${Math.round(cacheAge / 1000)}s)`)
          return cachedRole
        }
      }

      // 2. Si no hay caché o expiró, consultar BD
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const role = profile?.role || 'usuario'
      this._userRole = role

      // 3. Guardar en caché localStorage
      localStorage.setItem(this.ROLE_CACHE_KEY, role)
      localStorage.setItem(this.ROLE_CACHE_TIME_KEY, Date.now().toString())

      console.log('[PermissionService] Rol consultado de BD y guardado en caché:', role)
      return role
    } catch (error) {
      console.error('Error getting user role:', error)
      return 'usuario'
    }
  },

  // Invalidar caché de rol (usar al login/logout/cambios de rol)
  invalidateRoleCache() {
    console.log('[PermissionService] Invalidando caché de rol')
    localStorage.removeItem(this.ROLE_CACHE_KEY)
    localStorage.removeItem(this.ROLE_CACHE_TIME_KEY)
    this._userRole = null
    this._permissionsCache = null
    this._cacheTimestamp = null
  },

  // Verificar si el cache es válido
  _isCacheValid() {
    if (!this._cacheTimestamp) return false
    return (Date.now() - this._cacheTimestamp) < this.CACHE_DURATION
  },

  // Cargar todos los permisos del rol actual
  async loadPermissions() {
    try {
      if (this._permissionsCache && this._isCacheValid()) {
        console.log('[PermissionService] Usando cache de permisos:', this._permissionsCache)
        return this._permissionsCache
      }

      const role = await this.getUserRole()
      console.log('[PermissionService] Cargando permisos para rol:', role)
      
      if (!role) {
        console.warn('[PermissionService] No hay rol de usuario, devolviendo permisos vacíos')
        return {}
      }

      const { data, error } = await supabase
        .from('role_permissions')
        .select('module, permission, allowed')
        .eq('role', role)
        .eq('allowed', true)

      if (error) {
        console.error('[PermissionService] Error en consulta:', error)
        throw error
      }

      console.log('[PermissionService] Permisos cargados de BD:', data?.length || 0, 'permisos')

      // Convertir a estructura más fácil de usar: { modulo: { permiso: true } }
      const permissions = {}
      data.forEach(({ module, permission }) => {
        if (!permissions[module]) {
          permissions[module] = {}
        }
        permissions[module][permission] = true
      })

      this._permissionsCache = permissions
      this._cacheTimestamp = Date.now()
      
      console.log('[PermissionService] Permisos procesados:', permissions)
      return permissions
    } catch (error) {
      console.error('[PermissionService] Error loading permissions:', error)
      // En caso de error, devolver permisos por defecto para no romper la UI
      // El sidebar usará estos como fallback
      return {
        dashboard: { ver: true },
        archivos: { ver: true, subir: true, descargar: true },
        comentarios: { ver: true, crear: true },
        usuarios: { ver: true }
      }
    }
  },

  // Verificar si tiene un permiso específico
  async hasPermission(module, permission) {
    // ✅ Verificar primero si hay cache, no volver a cargar
    if (this._permissionsCache && this._isCacheValid()) {
      return !!this._permissionsCache[module]?.[permission]
    }
    const permissions = await this.loadPermissions()
    return !!permissions[module]?.[permission]
  },

  // Verificar múltiples permisos (retorna true si tiene AL MENOS UNO)
  async hasAnyPermission(module, permissions) {
    const userPermissions = await this.loadPermissions()
    return permissions.some(p => userPermissions[module]?.[p])
  },

  // Verificar múltiples permisos (retorna true si tiene TODOS)
  async hasAllPermissions(module, permissions) {
    const userPermissions = await this.loadPermissions()
    return permissions.every(p => userPermissions[module]?.[p])
  },

  // ============ HELPERS POR MÓDULO ============
  
  // Archivos
  async canViewFiles() {
    return this.hasPermission('archivos', 'ver')
  },
  
  async canUploadFiles() {
    return this.hasPermission('archivos', 'subir')
  },
  
  async canDownloadFiles() {
    return this.hasPermission('archivos', 'descargar')
  },
  
  async canDeleteFiles() {
    return this.hasPermission('archivos', 'eliminar')
  },
  
  async canShareFiles() {
    return this.hasPermission('archivos', 'compartir')
  },

  // Comentarios
  async canViewComments() {
    return this.hasPermission('comentarios', 'ver')
  },
  
  async canCreateComments() {
    return this.hasPermission('comentarios', 'crear')
  },
  
  async canEditComments() {
    return this.hasPermission('comentarios', 'editar')
  },
  
  async canDeleteComments() {
    return this.hasPermission('comentarios', 'eliminar')
  },
  
  async canAssignTasks() {
    return this.hasPermission('comentarios', 'asignar') || 
           this.hasPermission('comentarios', 'asignar_tareas')
  },

  // Usuarios
  async canViewUsers() {
    return this.hasPermission('usuarios', 'ver')
  },
  
  async canCreateUsers() {
    return this.hasPermission('usuarios', 'crear')
  },
  
  async canEditUsers() {
    return this.hasPermission('usuarios', 'editar')
  },
  
  async canDeleteUsers() {
    return this.hasPermission('usuarios', 'eliminar')
  },
  
  async canManagePermissions() {
    return this.hasPermission('usuarios', 'gestionar_permisos')
  },

  // Logs
  async canViewLogs() {
    return this.hasPermission('logs', 'ver')
  },
  
  async canExportLogs() {
    return this.hasPermission('logs', 'exportar')
  },
  
  async canDeleteLogs() {
    return this.hasPermission('logs', 'eliminar')
  },

  // Dashboard
  async canViewDashboard() {
    return this.hasPermission('dashboard', 'ver')
  },
  
  async canViewStats() {
    return this.hasPermission('dashboard', 'estadisticas')
  },
  
  async canExportDashboard() {
    return this.hasPermission('dashboard', 'exportar')
  },

  // Sistema
  async canAccessSettings() {
    return this.hasPermission('sistema', 'configuraciones')
  },
  
  async canManageBackups() {
    return this.hasPermission('sistema', 'respaldos')
  },
  
  async canAccessMaintenance() {
    return this.hasPermission('sistema', 'mantenimiento')
  },

  // Obtener todos los permisos como objeto plano (útil para debugging)
  async getAllPermissions() {
    return this.loadPermissions()
  },

  // Verificar si es administrador
  async isAdmin() {
    const role = await this.getUserRole()
    return role === 'admin'
  }
}

export default permissionService
