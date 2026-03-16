import { authService } from './authServiceSupabase.js'
import { SUPABASE_CONFIG } from './config.js'

const EDGE_FUNCTION_URL = SUPABASE_CONFIG.functions.dashboard

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

export const dashboardService = {
  async stats() {
    return await callEdgeFunction('stats')
  },

  async activity(limit = 10) {
    return await callEdgeFunction('activity', { limit })
  },

  async users() {
    return await callEdgeFunction('users')
  },

  async comments(limit = 20) {
    return await callEdgeFunction('comments', { limit })
  },

  async files(limit = 20) {
    return await callEdgeFunction('files', { limit })
  },

  async filesStats() {
    return await callEdgeFunction('files-stats')
  },

  async recentFiles(limit = 5) {
    return await callEdgeFunction('recent-files', { limit })
  },

  async recentActivities(limit = 10) {
    return await callEdgeFunction('recent-activities', { limit })
  },

  async full() {
    return await callEdgeFunction('full')
  }
}
