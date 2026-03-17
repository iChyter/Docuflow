import { supabase } from './supabaseClient.js'
import { SUPABASE_CONFIG } from './config.js'
import { authService } from './authServiceSupabase.js'

const EDGE_FUNCTION_URL = SUPABASE_CONFIG.functions.files

async function callEdgeFunction(action, data = {}) {
  const token = authService.getToken() || ''
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
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
    const user = await authService.getCurrentUser()
    console.log('Upload - User:', user);
    if (!user) throw new Error('Not authenticated')
    
    // Obtener el ID del usuario - puede estar en diferentes campos
    const userId = user.id || user.user_id;
    if (!userId) throw new Error('User ID not found')

    const fileName = `${Date.now()}_${file.name}`
    const filePath = `${userId}/${fileName}`
    console.log('Upload - File path:', filePath);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(SUPABASE_CONFIG.bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type
      })

    if (error) {
      console.error('Storage upload error:', error)
      throw new Error(error.message || 'Upload failed')
    }

    const { data: urlData } = supabase.storage
      .from(SUPABASE_CONFIG.bucket)
      .getPublicUrl(filePath)

    const document = await callEdgeFunction('create', {
      filename: file.name,
      fileType: file.type,
      filePath: urlData.publicUrl,
      size: file.size
    })

    return document
  },

  async delete(id) {
    // Primero obtener el documento para obtener el file_path
    const doc = await callEdgeFunction('get', { id })
    console.log('Delete - Document:', doc)
    
    let filePath = doc?.file_path
    
    // Extraer el path relativo
    if (filePath) {
      if (filePath.includes('/storage/v1/object/public/')) {
        filePath = filePath.split('/storage/v1/object/public/')[1]
      } else if (filePath.includes('/storage/v1/object/')) {
        filePath = filePath.split('/storage/v1/object/')[1]
      }
      console.log('Delete - Storage path:', filePath)
      
      // Intentar eliminar del storage
      if (filePath && filePath.includes('/')) {
        try {
          const { error } = await supabase.storage
            .from(SUPABASE_CONFIG.bucket)
            .remove([filePath])
          
          if (error) {
            console.warn('Storage delete warning:', error.message)
          } else {
            console.log('File deleted from storage')
          }
        } catch (e) {
          console.warn('Storage delete error:', e.message)
        }
      }
    }
    
    // Luego eliminar el registro de la base de datos
    return await callEdgeFunction('delete', { id })
  },

  async download(id) {
    try {
      // Get document directly from database
      const { data: doc, error: docError } = await supabase
        .from('documents')
        .select('filename, file_path')
        .eq('id', id)
        .single()
      
      if (docError || !doc) {
        throw new Error(docError?.message || 'Documento no encontrado')
      }

      if (!doc.file_path) {
        throw new Error('Ruta del archivo no encontrada')
      }

      // Extract path from URL
      const pathParts = doc.file_path.split('/storage/v1/object/public/')
      const filePath = pathParts[1] || doc.file_path
      
      // Download from Supabase Storage
      const { data, error } = await supabase.storage
        .from(SUPABASE_CONFIG.bucket)
        .download(filePath)

      if (error) {
        console.error('Storage download error:', error)
        throw new Error(error.message || 'Error al descargar')
      }

      return { blob: data, filename: doc.filename }
    } catch (error) {
      console.error('Download error:', error)
      throw error
    }
  },

  async getDownloadUrl(id) {
    const doc = await callEdgeFunction('get', { id })
    return doc?.file_path
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
