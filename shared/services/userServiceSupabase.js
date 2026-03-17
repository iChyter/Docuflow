import { authService } from './authServiceSupabase.js'
import { SUPABASE_CONFIG } from './config.js'

const EDGE_FUNCTION_URL = SUPABASE_CONFIG.functions.users

async function callEdgeFunction(action, data = {}) {
  const token = authService.getToken()
  
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    },
    body: JSON.stringify({ action, data })
  })

  const result = await response.json()
  
  if (!result.success) {
    throw new Error(result.error || 'Unknown error')
  }
  
  return result.data
}

export const userService = {
  async getProfile() {
    return await callEdgeFunction('get-profile')
  },

  async updateProfile(updates) {
    return await callEdgeFunction('update-profile', { updates })
  },

  async getUsers() {
    return await callEdgeFunction('get-users')
  },

  async getUser(userId) {
    return await callEdgeFunction('get-user', { userId })
  },

  async updateUser(userId, updates) {
    return await callEdgeFunction('update-user', { userId, updates })
  },

  async deleteUser(userId) {
    return await callEdgeFunction('delete-user', { userId })
  },

  async changePassword(password) {
    return await callEdgeFunction('change-own-password', { password })
  },

  async changeUserPassword(userId, password) {
    return await callEdgeFunction('change-password', { userId, password })
  },

  async getRoles() {
    return await callEdgeFunction('get-roles')
  },

  async setUserRole(userId, role) {
    // Try Edge Function first
    try {
      return await this.updateUser(userId, { role });
    } catch (error) {
      console.log('Edge Function failed, trying direct update');
      // Fallback: direct update
      const { supabase } = await import('./supabaseClient.js');
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', userId)
        .select()
        .single();
      
      if (updateError) {
        throw new Error(updateError.message);
      }
      
      return data;
    }
  },

  async createUser(email, password) {
    // Importar supabase client
    const { supabase } = await import('./supabaseClient.js');
    
    try {
      // Crear usuario solo en Auth (sin confirmación de email)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password
      });

      if (authError) {
        throw new Error(authError.message);
      }

      if (!authData.user) {
        throw new Error('No se pudo crear el usuario');
      }

      console.log('Usuario creado en Auth:', authData.user.id);
      return authData.user;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }
}
