// authServiceSupabase.js - Sistema simple de sesión
import { SUPABASE_CONFIG } from './config.js'

const EDGE_FUNCTION_URL = SUPABASE_CONFIG.functions.auth

export const authService = {
  async login(email, password) {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'login', 
        data: { email, password } 
      })
    })

    const result = await response.json()
    
    if (!result.success) {
      throw new Error(result.error || 'Login failed')
    }

    const { user } = result.data
    
    // Guardar en localStorage
    localStorage.setItem('docuflow_user', JSON.stringify(user))
    localStorage.setItem('docuflow_login_time', Date.now().toString())

    return { user }
  },

  async register(email, password, username, fullName) {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'register', 
        data: { email, password, username, fullName } 
      })
    })

    const result = await response.json()
    
    if (!result.success) {
      throw new Error(result.error || 'Registration failed')
    }

    return result.data
  },

  logout() {
    localStorage.removeItem('docuflow_user')
    localStorage.removeItem('docuflow_login_time')
  },

  getCurrentUser() {
    const user = localStorage.getItem('docuflow_user')
    return user ? JSON.parse(user) : null
  },

  isAuthenticated() {
    const user = localStorage.getItem('docuflow_user')
    if (!user) return false
    
    const loginTime = parseInt(localStorage.getItem('docuflow_login_time') || '0')
    const now = Date.now()
    const elapsed = now - loginTime
    const SESSION_DURATION = 24 * 60 * 60 * 1000 // 24 horas
    
    if (elapsed > SESSION_DURATION) {
      this.logout()
      return false
    }
    
    return true
  },

  getToken() {
    return 'simple-session-token'
  }
}
