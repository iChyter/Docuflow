// authServiceSupabase.js - Sistema de autenticación con Supabase Auth
import { supabase } from './supabaseClient.js'
import { SUPABASE_CONFIG } from './config.js'

const EDGE_FUNCTION_URL = SUPABASE_CONFIG.functions.auth

export const authService = {
  async login(email, password) {
    try {
      // Usar Supabase Auth directamente para obtener token JWT válido
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        throw new Error(error.message)
      }

      const { user, session } = data
      
      // Guardar en localStorage
      localStorage.setItem('docuflow_user', JSON.stringify(user))
      localStorage.setItem('docuflow_login_time', Date.now().toString())
      if (session?.access_token) {
        localStorage.setItem('docuflow_token', session.access_token)
      }

      return { user, token: session?.access_token }
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  },

  async register(email, password, username, fullName) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            full_name: fullName
          }
        }
      })

      if (error) {
        throw new Error(error.message)
      }

      return data
    } catch (error) {
      console.error('Register error:', error)
      throw error
    }
  },

  async logout() {
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.warn('Logout warning:', error.message)
    }

    localStorage.removeItem('docuflow_user')
    localStorage.removeItem('docuflow_login_time')
    localStorage.removeItem('docuflow_token')

    // ✅ Invalidar caché de rol al cerrar sesión
    localStorage.removeItem('docuflow_role')
    localStorage.removeItem('docuflow_role_time')
  },

  async getCurrentUser() {
    try {
      await this.checkSession();
      
      const { data: { user }, error } = await supabase.auth.getUser()
      
      if (error) {
        console.warn('Error getting user:', error.message)
        const stored = localStorage.getItem('docuflow_user')
        return stored ? JSON.parse(stored) : null
      }
      
      if (user) {
        localStorage.setItem('docuflow_user', JSON.stringify(user))
      }
      
      return user
    } catch (error) {
      const stored = localStorage.getItem('docuflow_user')
      return stored ? JSON.parse(stored) : null
    }
  },

  isAuthenticated() {
    const user = localStorage.getItem('docuflow_user')
    if (!user) return false
    
    const loginTime = parseInt(localStorage.getItem('docuflow_login_time') || '0')
    const now = Date.now()
    const elapsed = now - loginTime
    const SESSION_DURATION = 24 * 60 * 60 * 1000
    
    if (elapsed > SESSION_DURATION) {
      this.logout()
      return false
    }
    
    return true
  },

  getToken() {
    return localStorage.getItem('docuflow_token') || ''
  },

  async checkSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (session) {
        localStorage.setItem('docuflow_token', session.access_token)
        localStorage.setItem('docuflow_user', JSON.stringify(session.user))
        localStorage.setItem('docuflow_login_time', Date.now().toString())
        return true
      }
      
      return false
    } catch (error) {
      return false
    }
  }
}

// Verificar sesión al cargar
authService.checkSession()
