import { commentService } from '../../shared/services/commentServiceSupabase.js';
import { authService } from '../../shared/services/authServiceSupabase.js';
import { showNotification, Pagination } from '../../shared/utils/uiHelpers.js';

// Auth guard
authService.checkSession().then(async () => {
  const user = await authService.getCurrentUser();
  if (!user) {
    window.location.href = '../auth/login.html';
    return;
  }

class CommentsController {
  constructor() {
    this.comments = [];
    this.filteredComments = [];
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.currentFilter = 'all';
    this.documentId = null;
    
    this.init();
  }

  async init() {
    const urlParams = new URLSearchParams(window.location.search);
    this.documentId = urlParams.get('documentId') || urlParams.get('fileId');
    
    if (!this.documentId) {
      const input = prompt('Ingresa el ID del documento para ver comentarios:');
      if (input) {
        this.documentId = parseInt(input);
      } else {
        showNotification('No se especificó documento', 'error');
        return;
      }
    }

    this.setupEventListeners();
    await this.loadComments();
    this.updateStats();
  }

  setupEventListeners() {
    const commentForm = document.getElementById('newCommentForm');
    if (commentForm) {
      commentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleCommentSubmission();
      });
    }

    const typeRadios = document.querySelectorAll('input[name="commentType"]');
    typeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.toggleTaskFields(e.target.value === 'task');
        this.updateSubmitButton(e.target.value);
      });
    });

    const filterType = document.getElementById('filterType');
    if (filterType) {
      filterType.addEventListener('change', (e) => {
        this.currentFilter = e.target.value;
        this.filterComments();
      });
    }

    const searchInput = document.getElementById('searchComments');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.filterComments());
    }

    const markAllReadBtn = document.getElementById('markAllRead');
    const exportBtn = document.getElementById('exportComments');
    const refreshBtn = document.getElementById('refreshComments');

    if (markAllReadBtn) markAllReadBtn.addEventListener('click', () => this.markAllAsRead());
    if (exportBtn) exportBtn.addEventListener('click', () => this.exportComments());
    if (refreshBtn) refreshBtn.addEventListener('click', () => this.loadComments());
  }

  toggleTaskFields(isTask) {
    const taskFields = document.querySelectorAll('.task-fields');
    taskFields.forEach(field => {
      field.classList.toggle('d-none', !isTask);
    });
  }

  updateSubmitButton(type) {
    const submitBtn = document.getElementById('submitBtn');
    const submitText = document.getElementById('submitText');
    if (type === 'task') {
      submitText.textContent = 'Crear Tarea';
      submitBtn.querySelector('i').className = 'bi bi-list-task me-2';
    } else {
      submitText.textContent = 'Agregar Comentario';
      submitBtn.querySelector('i').className = 'bi bi-plus-circle me-2';
    }
  }

  async handleCommentSubmission() {
    const submitBtn = document.getElementById('submitBtn');
    const originalText = submitBtn.innerHTML;
    
    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="bi bi-arrow-clockwise spin me-2"></i>Guardando...';

      const commentType = document.querySelector('input[name="commentType"]:checked').value;
      const content = document.getElementById('commentContent').value.trim();
      const isTask = commentType === 'task';
      
      const assignees = isTask ? document.getElementById('assignees').value.trim() : '';
      const assigneesList = assignees ? assignees.split(',').map(a => a.trim()).filter(a => a) : [];

      await commentService.create(content, this.documentId, isTask, assigneesList);
      
      showNotification(`${isTask ? 'Tarea' : 'Comentario'} creado exitosamente`, 'success');
      
      document.getElementById('newCommentForm').reset();
      this.toggleTaskFields(false);
      this.updateSubmitButton('comment');
      
      await this.loadComments();

    } catch (error) {
      console.error('Error creating comment:', error);
      showNotification('Error al crear el comentario: ' + error.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }

  async loadComments() {
    try {
      const comments = await commentService.byDocument(this.documentId);
      
      if (comments && Array.isArray(comments)) {
        this.comments = comments;
        showNotification(`${comments.length} comentarios cargados`, 'success', 2000);
      } else {
        this.comments = [];
      }
      
      this.filterComments();
      
    } catch (error) {
      console.error('Error loading comments:', error);
      showNotification('Error al cargar comentarios: ' + error.message, 'error');
      this.comments = [];
      this.filterComments();
    }
  }

  filterComments() {
    const searchTerm = document.getElementById('searchComments')?.value.toLowerCase() || '';
    
    this.filteredComments = this.comments.filter(comment => {
      if (this.currentFilter !== 'all') {
        if (this.currentFilter === 'comments' && comment.is_task) return false;
        if (this.currentFilter === 'tasks' && !comment.is_task) return false;
        if (this.currentFilter === 'pending' && comment.completed) return false;
        if (this.currentFilter === 'completed' && !comment.completed) return false;
      }
      
      if (searchTerm) {
        return comment.content.toLowerCase().includes(searchTerm) ||
               (comment.author_username && comment.author_username.toLowerCase().includes(searchTerm));
      }
      
      return true;
    });

    this.currentPage = 1;
    this.renderComments();
    this.updateShowingCount();
  }

  renderComments() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const commentsToShow = this.filteredComments.slice(startIndex, endIndex);

    const container = document.getElementById('commentsSection');
    const emptyState = document.getElementById('commentsMsg');

    if (commentsToShow.length === 0) {
      container.innerHTML = '';
      emptyState.classList.remove('d-none');
      this.updateShowingCount();
      return;
    }

    emptyState.classList.add('d-none');
    container.innerHTML = commentsToShow.map(comment => this.renderCommentItem(comment)).join('');
    
    this.updateShowingCount();
  }

  renderCommentItem(comment) {
    const isTask = comment.is_task;
    const completedClass = comment.completed ? 'completed' : '';
    const authorName = comment.author_username || comment.profiles?.username || 'Usuario';
    
    return `
      <div class="comment-item ${isTask ? 'task' : 'comment'} ${completedClass}" data-comment-id="${comment.id}">
        <div class="comment-header">
          <div class="d-flex align-items-center gap-2">
            <span class="comment-type ${isTask ? 'task' : 'comment'}">
              <i class="bi bi-${isTask ? 'list-task' : 'chat-text'}"></i>
              ${isTask ? 'Tarea' : 'Comentario'}
            </span>
            ${comment.completed ? '<span class="badge bg-success ms-2">Completada</span>' : ''}
          </div>
          <div class="comment-meta">
            <span><i class="bi bi-person"></i> ${authorName}</span>
            <span><i class="bi bi-clock"></i> ${this.formatDate(comment.created_at)}</span>
            ${comment.due_date ? `<span><i class="bi bi-calendar"></i> ${this.formatDate(comment.due_date)}</span>` : ''}
          </div>
        </div>
        
        <div class="comment-content">
          ${comment.content}
        </div>
        
        <div class="comment-actions">
          ${isTask && !comment.completed ? `
            <button class="action-btn complete" onclick="commentsController.completeTask('${comment.id}')">
              <i class="bi bi-check-circle"></i> Completar
            </button>
          ` : ''}
          <button class="action-btn delete" onclick="commentsController.deleteComment('${comment.id}')">
            <i class="bi bi-trash"></i> Eliminar
          </button>
        </div>
      </div>
    `;
  }

  formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  updateShowingCount() {
    const showingElement = document.getElementById('showingCount');
    const totalElement = document.getElementById('totalCount');
    
    if (showingElement && totalElement) {
      const startIndex = (this.currentPage - 1) * this.itemsPerPage;
      const endIndex = Math.min(startIndex + this.itemsPerPage, this.filteredComments.length);
      
      showingElement.textContent = this.filteredComments.length > 0 ? `${startIndex + 1}-${endIndex}` : '0';
      totalElement.textContent = this.filteredComments.length;
    }
  }

  async updateStats() {
    const commentsCount = this.comments.filter(c => !c.is_task).length;
    const tasksCount = this.comments.filter(c => c.is_task).length;
    const completedCount = this.comments.filter(c => c.is_task && c.completed).length;
    
    document.getElementById('commentsCount').textContent = commentsCount;
    document.getElementById('tasksCount').textContent = tasksCount;
    document.getElementById('completedCount').textContent = completedCount;
  }

  async completeTask(commentId) {
    try {
      const comment = this.comments.find(c => c.id === commentId);
      if (!comment || !comment.is_task) return;

      await commentService.complete(commentId, !comment.completed);
      showNotification(comment.completed ? 'Tarea desmarcada' : 'Tarea completada', 'success');
      await this.loadComments();
    } catch (error) {
      console.error('Error completing task:', error);
      showNotification('Error al completar la tarea: ' + error.message, 'error');
    }
  }

  async deleteComment(commentId) {
    if (!confirm('¿Estás seguro de eliminar este elemento?')) return;

    try {
      await commentService.delete(commentId);
      showNotification('Elemento eliminado', 'success');
      await this.loadComments();
    } catch (error) {
      console.error('Error deleting comment:', error);
      showNotification('Error al eliminar: ' + error.message, 'error');
    }
  }

  async markAllAsRead() {
    showNotification('Función no implementada', 'info');
  }

  async exportComments() {
    try {
      const csvContent = this.generateCSV();
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `comentarios_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      showNotification('Comentarios exportados', 'success');
    } catch (error) {
      console.error('Export error:', error);
      showNotification('Error al exportar', 'error');
    }
  }

  generateCSV() {
    const headers = ['ID', 'Tipo', 'Contenido', 'Autor', 'Fecha', 'Estado'];
    const rows = this.comments.map(comment => [
      comment.id,
      comment.is_task ? 'Tarea' : 'Comentario',
      `"${(comment.content || '').replace(/"/g, '""')}"`,
      comment.author_username || '',
      this.formatDate(comment.created_at),
      comment.completed ? 'Completado' : 'Pendiente'
    ]);
    
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }
}

let commentsController;
document.addEventListener('DOMContentLoaded', () => {
  commentsController = new CommentsController();
});
}); // End auth guard
