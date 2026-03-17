import { SUPABASE_CONFIG } from './config.js';
import { authService } from './authServiceSupabase.js';

const EDGE_FUNCTION_URL = SUPABASE_CONFIG.functions.users;

async function callEdgeFunction(action, data = {}) {
  const token = authService.getToken();
  
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

export async function apiGetRoles() {
  try {
    const roles = await callEdgeFunction('get-roles');
    return { 
      success: true, 
      roles: roles || [] 
    };
  } catch (error) {
    console.error('Error obteniendo roles:', error);
    return { 
      success: false, 
      roles: [], 
      error: error.message || 'Error al obtener roles'
    };
  }
}

export async function apiSetUserRole(userId, role) {
  try {
    await callEdgeFunction('set-user-role', { userId, role });
    return { success: true };
  } catch (error) {
    console.error('Error cambiando rol de usuario:', error);
    return { 
      success: false, 
      error: error.message || 'Error al cambiar el rol del usuario'
    };
  }
}

export async function apiGetUserPermissions(userId) {
  try {
    const permissions = await callEdgeFunction('get-user-permissions', { userId });
    return { success: true, permissions: permissions || [] };
  } catch (error) {
    console.error('Error obteniendo permisos:', error);
    return { success: false, permissions: [], error: error.message };
  }
}

export async function apiSetUserPermissions(userId, permissions) {
  try {
    await callEdgeFunction('set-user-permissions', { userId, permissions });
    return { success: true };
  } catch (error) {
    console.error('Error estableciendo permisos:', error);
    return { success: false, error: error.message };
  }
}

export async function apiGetUsers() {
  try {
    const users = await callEdgeFunction('get-users');
    return { 
      success: true, 
      users: Array.isArray(users) ? users : [] 
    };
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    return { 
      success: false, 
      users: [], 
      error: error.message || 'Error al obtener usuarios'
    };
  }
}

export async function apiCreateUser(userData) {
  try {
    const user = await callEdgeFunction('create-user', userData);
    return { 
      success: true, 
      user: user || userData 
    };
  } catch (error) {
    console.error('Error creando usuario:', error);
    return { 
      success: false, 
      error: error.message || 'Error al crear usuario'
    };
  }
}

export async function apiUpdateUser(userId, userData) {
  try {
    const user = await callEdgeFunction('update-user', { userId, ...userData });
    return { 
      success: true, 
      user: user || userData 
    };
  } catch (error) {
    console.error('Error actualizando usuario:', error);
    return { 
      success: false, 
      error: error.message || 'Error al actualizar usuario'
    };
  }
}

export async function apiDeleteUser(userId) {
  try {
    await callEdgeFunction('delete-user', { userId });
    return { success: true };
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    return { 
      success: false, 
      error: error.message || 'Error al eliminar usuario'
    };
  }
}

export async function login(email, password) {
  try {
    const result = await authService.login(email, password);
    return { success: true, user: result.user, token: result.token };
  } catch (error) {
    console.error('Error en login:', error);
    return { success: false, error: error.message || 'No se pudo conectar con el servidor' };
  }
}
