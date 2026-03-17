import { SUPABASE_CONFIG } from './config.js';
import { authService } from './authServiceSupabase.js';

const EDGE_FUNCTION_URL = SUPABASE_CONFIG.functions.dashboard;

async function callEdgeFunction(action, data = {}) {
  const token = authService.getToken();
  
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    },
    body: JSON.stringify({ action, data })
  });

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'Unknown error');
  }
  
  return result.data;
}

export async function apiGetDownloadsToday() {
  try {
    const data = await callEdgeFunction('downloads-today');
    return { success: true, count: data?.count ?? 0 };
  } catch (error) {
    console.error('Error getting downloads:', error);
    return { success: false, count: 0, error: error.message };
  }
}
