import { SUPABASE_CONFIG } from './config.js';
import { authService } from './authServiceSupabase.js';

const EDGE_FUNCTION_URL = SUPABASE_CONFIG.functions.logs;

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

export async function apiGetLogs() {
  try {
    const logs = await callEdgeFunction('list', { limit: 100 });
    return { success: true, logs: Array.isArray(logs) ? logs : [] };
  } catch (error) {
    console.error('Error getting logs:', error);
    return { success: false, logs: [], error: error.message };
  }
}
