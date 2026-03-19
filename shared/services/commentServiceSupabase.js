import { authService } from './authServiceSupabase.js'
import { SUPABASE_CONFIG } from './config.js'

const EDGE_FUNCTION_URL = SUPABASE_CONFIG.functions.comments

async function callEdgeFunction(action, data = {}) {
  const token = authService.getToken()
  console.log('[commentService] Token:', token ? token.substring(0, 20) + '...' : 'EMPTY');
  console.log('[commentService] Token length:', token?.length || 0);
  
  if (!token) {
    console.warn('[commentService] No token - checking session...');
    await authService.checkSession();
    const refreshedToken = authService.getToken();
    console.log('[commentService] Token after checkSession:', refreshedToken ? refreshedToken.substring(0, 20) + '...' : 'EMPTY');
  }
  
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    },
    body: JSON.stringify({ action, data })
  })

  console.log('[commentService] Response status:', response.status);
  
  if (!response.ok) {
    const text = await response.text();
    console.error('[commentService] Error response:', text);
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  
  const result = await response.json()
  
  if (!result.success) {
    throw new Error(result.error || 'Unknown error')
  }
  
  return result.data
}

export const commentService = {
  async list(limit = 20) {
    return await callEdgeFunction('list', { limit })
  },

  async byDocument(documentId) {
    return await callEdgeFunction('by-document', { documentId })
  },

  async get(id) {
    return await callEdgeFunction('get', { id })
  },

  async create(content, documentId, isTask = false, assignees = []) {
    return await callEdgeFunction('create', {
      content,
      documentId,
      isTask,
      assignees
    })
  },

  async update(id, content) {
    return await callEdgeFunction('update', { id, content })
  },

  async delete(id) {
    return await callEdgeFunction('delete', { id })
  },

  async assign(id, assignees) {
    return await callEdgeFunction('assign', { id, assignees })
  },

  async complete(id, completed = true) {
    return await callEdgeFunction('complete', { id, completed })
  },

  async count() {
    return await callEdgeFunction('count')
  }
}
