import { supabase } from './supabaseClient.js'
import { SUPABASE_CONFIG } from './config.js'
import { authService } from './authServiceSupabase.js'

const EDGE_FUNCTION_URL = SUPABASE_CONFIG.functions.files

async function callEdgeFunction(action, data = {}) {
  // No enviar token, las funciones son públicas para lectura
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ action, data })
  })

  const result = await response.json()
  
  if (!result.success) {
    throw new Error(result.error || 'Unknown error')
  }
  
  return result.data
}

export const fileService = {
  async list(limit = 20, offset = 0) {
    return await callEdgeFunction('list', { limit, offset })
  },

  async search(query, limit = 10) {
    return await callEdgeFunction('search', { q: query, limit })
  },

  async recent(limit = 5) {
    return await callEdgeFunction('recent', { limit })
  },

  async get(id) {
    return await callEdgeFunction('get', { id })
  },

  async upload(file, onProgress = null) {
    const user = authService.getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    const fileName = `${Date.now()}_${file.name}`
    const filePath = `${user.id}/${fileName}`

    const { data, error } = await supabase.storage
      .from(SUPABASE_CONFIG.bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type
      })

    if (error) {
      throw new Error(error.message || 'Upload failed')
    }

    const { data: { publicUrl } } = supabase.storage
      .from(SUPABASE_CONFIG.bucket)
      .getPublicUrl(filePath)

    const document = await callEdgeFunction('create', {
      filename: file.name,
      fileType: file.type,
      filePath: publicUrl,
      size: file.size
    })

    return document
  },

  async delete(id) {
    const doc = await callEdgeFunction('get', { id })
    
    const filePath = doc.file_path.split('/').slice(-2).join('/')
    
    await supabase.storage
      .from(SUPABASE_CONFIG.bucket)
      .remove([filePath])

    return await callEdgeFunction('delete', { id })
  },

  async download(id) {
    const doc = await callEdgeFunction('get', { id })
    
    const { data, error } = await supabase.storage
      .from(SUPABASE_CONFIG.bucket)
      .download(doc.file_path)

    if (error) {
      throw new Error(error.message || 'Download failed')
    }

    return { blob: data, filename: doc.filename }
  },

  async getDownloadUrl(id) {
    const doc = await callEdgeFunction('get', { id })
    return doc.file_path
  },

  async stats() {
    return await callEdgeFunction('stats')
  },

  async count() {
    return await callEdgeFunction('count')
  },

  async totalSize() {
    return await callEdgeFunction('total-size')
  }
}
