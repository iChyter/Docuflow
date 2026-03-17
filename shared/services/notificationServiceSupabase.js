import { authService } from './authServiceSupabase.js'
import { SUPABASE_CONFIG } from './config.js'

const EDGE_FUNCTION_URL = SUPABASE_CONFIG.functions.notifications

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

export const notificationService = {
  async list(limit = 20) {
    return await callEdgeFunction('list', { limit })
  },

  async adminList(limit = 20) {
    return await callEdgeFunction('admin-list', { limit })
  },

  async get(id) {
    return await callEdgeFunction('get', { id })
  },

  async create(title, message, type = 'info', priority = 'medium', isGlobal = false, userId = null) {
    return await callEdgeFunction('create', {
      title,
      message,
      type,
      priority,
      isGlobal,
      userId
    })
  },

  async deactivate(id) {
    return await callEdgeFunction('deactivate', { id })
  },

  async delete(id) {
    return await callEdgeFunction('delete', { id })
  },

  async stats() {
    return await callEdgeFunction('stats')
  },

  async types() {
    return await callEdgeFunction('types')
  },

  async priorities() {
    return await callEdgeFunction('priorities')
  },

  async byType(type) {
    return await callEdgeFunction('by-type', { type })
  }
}
