import { SUPABASE_CONFIG } from './config.js';
import { supabase } from './supabaseClient.js';
import { authService } from './authServiceSupabase.js';

const EDGE_FUNCTION_URL = SUPABASE_CONFIG.functions.files;

async function callEdgeFunction(action, data = {}) {
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, data })
  });

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'Unknown error');
  }
  
  return result.data;
}

const getAuthToken = () => localStorage.getItem('docuflow_token');

export async function apiDeleteFile(fileId) {
  try {
    await callEdgeFunction('delete', { id: fileId });
    return { success: true };
  } catch (error) {
    console.error('Error deleting file:', error);
    return { success: false, error: error.message };
  }
}

export async function apiGetFiles() {
  try {
    const files = await callEdgeFunction('list', { limit: 100, offset: 0 });
    return { success: true, files: Array.isArray(files) ? files : [] };
  } catch (error) {
    console.error('Error getting files:', error);
    return { success: false, files: [], error: error.message };
  }
}

export async function apiUploadFile(file, metadata = {}) {
  try {
    const user = authService.getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const fileName = `${Date.now()}_${file.name}`;
    const filePath = `${user.id}/${fileName}`;

    const { data, error } = await supabase.storage
      .from(SUPABASE_CONFIG.bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type
      });

    if (error) {
      throw new Error(error.message || 'Upload failed');
    }

    const { data: { publicUrl } } = supabase.storage
      .from(SUPABASE_CONFIG.bucket)
      .getPublicUrl(filePath);

    const document = await callEdgeFunction('create', {
      filename: file.name,
      fileType: file.type,
      filePath: publicUrl,
      size: file.size,
      ...metadata
    });

    return { success: true, ...document };
  } catch (error) {
    console.error('Error uploading file:', error);
    return { success: false, error: error.message };
  }
}

export async function apiDownloadFile(fileId, newName) {
  try {
    const doc = await callEdgeFunction('get', { id: fileId });
    
    const { data, error } = await supabase.storage
      .from(SUPABASE_CONFIG.bucket)
      .download(doc.file_path);

    if (error) {
      throw new Error(error.message || 'Download failed');
    }

    const url = window.URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = newName || doc.filename || 'archivo';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    return { success: true };
  } catch (error) {
    console.error('Error downloading file:', error);
    return { success: false, error: error.message };
  }
}

export async function apiGetFileStats() {
  try {
    const stats = await callEdgeFunction('stats');
    return { success: true, ...stats };
  } catch (error) {
    console.error('Error getting file stats:', error);
    return { success: false, error: error.message };
  }
}

export async function apiGetFileCount() {
  try {
    const count = await callEdgeFunction('count');
    return { success: true, count };
  } catch (error) {
    console.error('Error getting file count:', error);
    return { success: false, error: error.message };
  }
}

export async function apiGetFileTotalSize() {
  try {
    const totalSize = await callEdgeFunction('total-size');
    return { success: true, totalSize };
  } catch (error) {
    console.error('Error getting total size:', error);
    return { success: false, error: error.message };
  }
}
