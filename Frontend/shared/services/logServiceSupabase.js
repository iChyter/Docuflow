import { authService } from './authServiceSupabase.js'
import { SUPABASE_CONFIG } from './config.js'

const EDGE_FUNCTION_URL = SUPABASE_CONFIG.functions.logs

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

export const logService = {
  async list(limit = 20, offset = 0) {
    return await callEdgeFunction('list', { limit, offset })
  },

  async recent(limit = 10) {
    return await callEdgeFunction('recent', { limit })
  },

  async byUser(userId) {
    return await callEdgeFunction('by-user', { userId })
  },

  async count() {
    return await callEdgeFunction('count')
  },

  async export(format = 'json', limit = 1000) {
    return await callEdgeFunction('export', { format, limit })
  }
}
