import { SUPABASE_CONFIG } from './config.js';
import { authService } from './authServiceSupabase.js';

const EDGE_FUNCTION_URL = SUPABASE_CONFIG.functions.comments;

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

export async function apiGetCommentsByDocument(documentId) {
  try {
    const comments = await callEdgeFunction('get-by-document', { documentId });
    return { success: true, comments: Array.isArray(comments) ? comments : [] };
  } catch (error) {
    console.error('Error getting comments:', error);
    return { success: false, comments: [], error: error.message };
  }
}

export async function apiCreateComment(comment) {
  try {
    const newComment = await callEdgeFunction('create', comment);
    return { success: true, comment: newComment };
  } catch (error) {
    console.error('Error creating comment:', error);
    return { success: false, error: error.message };
  }
}

export async function apiEditComment(id, comment) {
  try {
    const updated = await callEdgeFunction('update', { id, ...comment });
    return { success: true, comment: updated };
  } catch (error) {
    console.error('Error editing comment:', error);
    return { success: false, error: error.message };
  }
}

export async function apiAssignUsersToComment(id, assignees) {
  try {
    const updated = await callEdgeFunction('assign', { id, assignees });
    return { success: true, comment: updated };
  } catch (error) {
    console.error('Error assigning users:', error);
    return { success: false, error: error.message };
  }
}

export async function apiDeleteComment(id) {
  try {
    await callEdgeFunction('delete', { id });
    return { success: true };
  } catch (error) {
    console.error('Error deleting comment:', error);
    return { success: false, error: error.message };
  }
}
