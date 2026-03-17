// Servicio especializado para sistema de exportación
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

class ExportService {
  constructor() {
    this.activeExports = new Map();
    this.exportHistory = [];
    this.scheduledReports = [];
    this.templates = {};
    this.statistics = {
      pdf: 0,
      excel: 0,
      csv: 0,
      scheduled: 0
    };
    
    this.presets = {
      quick: {
        pdf: { format: 'A4', orientation: 'portrait', compression: true },
        excel: { autoWidth: true, includeHeaders: true },
        csv: { delimiter: ',', encoding: 'UTF-8' }
      },
      detailed: {
        pdf: { format: 'A4', orientation: 'landscape', includeCharts: true, includeImages: true },
        excel: { charts: true, freeze: true, autoWidth: true },
        csv: { includeHeaders: true, includeMetadata: true }
      },
      minimal: {
        pdf: { format: 'A4', orientation: 'portrait', compression: true, minimal: true },
        excel: { minimal: true, includeHeaders: true },
        csv: { delimiter: ',', minimal: true }
      }
    };

    this.initializeService();
  }

  async initializeService() {
    try {
      await this.loadExportStatistics();
      await this.loadExportHistory();
      await this.loadScheduledReports();
      await this.loadAvailableTemplates();
      
      this.setupAutomaticCleanup();
      
      return true;
    } catch (error) {
      console.error('Error initializing export service:', error);
      return false;
    }
  }

  async generateReport(type, format, options = {}, preset = 'quick') {
    try {
      this.validateExportRequest(type, format, options);
      
      const finalOptions = this.mergeOptionsWithPreset(options, preset, format);
      
      const reportId = this.generateReportId();
      
      this.trackExport(reportId, type, format, finalOptions);
      
      let response;
      switch (format) {
        case 'pdf':
          response = await callEdgeFunction('export-pdf', { type, options: finalOptions });
          break;
        case 'excel':
          response = await callEdgeFunction('export-excel', { type, options: finalOptions });
          break;
        case 'csv':
          response = await callEdgeFunction('export-csv', { type, options: finalOptions });
          break;
        default:
          throw new Error(`Formato no soportado: ${format}`);
      }
      
      if (response) {
        this.updateStatistics(format);
        
        return {
          success: true,
          reportId,
          data: response
        };
      }
      
      throw new Error('Error al generar el reporte');
      
    } catch (error) {
      console.error('Error generating report:', error);
      throw error;
    }
  }

  validateExportRequest(type, format, options) {
    const validTypes = ['dashboard', 'files', 'users', 'logs', 'comments', 'permissions', 'activity', 'custom'];
    if (!validTypes.includes(type)) {
      throw new Error(`Tipo de reporte no válido: ${type}`);
    }

    const validFormats = ['pdf', 'excel', 'csv'];
    if (!validFormats.includes(format)) {
      throw new Error(`Formato no válido: ${format}`);
    }

    if (options.dateRange) {
      this.validateDateRange(options.dateRange);
    }

    return true;
  }

  validateDateRange(dateRange) {
    if (!dateRange.start || !dateRange.end) {
      return true;
    }

    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    const now = new Date();

    if (startDate > endDate) {
      throw new Error('La fecha de inicio no puede ser posterior a la fecha de fin');
    }

    if (startDate > now) {
      throw new Error('La fecha de inicio no puede ser futura');
    }

    const daysDiff = Math.abs(endDate - startDate) / (1000 * 60 * 60 * 24);
    if (daysDiff > 365) {
      throw new Error('El rango de fechas no puede exceder un año');
    }

    return true;
  }

  validateFileSize(estimatedSize) {
    const maxSize = 100 * 1024 * 1024;
    if (estimatedSize > maxSize) {
      throw new Error('El tamaño estimado del reporte excede el límite permitido (100MB)');
    }
    return true;
  }

  mergeOptionsWithPreset(options, preset, format) {
    const presetOptions = this.presets[preset]?.[format] || {};
    
    return {
      ...presetOptions,
      ...options,
      [format]: {
        ...presetOptions,
        ...(options[format] || {})
      }
    };
  }

  generateReportId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `${timestamp}-${random}`;
  }

  trackExport(reportId, type, format, options) {
    this.activeExports.set(reportId, {
      id: reportId,
      type,
      format,
      options,
      startTime: new Date(),
      status: 'processing',
      progress: 0
    });
  }

  updateExportProgress(reportId, progress, status = 'processing') {
    const exportInfo = this.activeExports.get(reportId);
    if (exportInfo) {
      exportInfo.progress = progress;
      exportInfo.status = status;
      exportInfo.lastUpdate = new Date();
      
      this.emitProgressEvent(reportId, exportInfo);
    }
  }

  emitProgressEvent(reportId, exportInfo) {
    const event = new CustomEvent('exportProgress', {
      detail: { reportId, exportInfo }
    });
    document.dispatchEvent(event);
  }

  completeExport(reportId, result) {
    const exportInfo = this.activeExports.get(reportId);
    if (exportInfo) {
      exportInfo.status = 'completed';
      exportInfo.progress = 100;
      exportInfo.endTime = new Date();
      exportInfo.result = result;
      
      this.exportHistory.unshift({
        ...exportInfo,
        completedAt: new Date()
      });
      
      this.activeExports.delete(reportId);
      
      const event = new CustomEvent('exportCompleted', {
        detail: { reportId, result }
      });
      document.dispatchEvent(event);
    }
  }

  getExportStatus(reportId) {
    return this.activeExports.get(reportId);
  }

  async cancelExport(reportId) {
    const exportInfo = this.activeExports.get(reportId);
    if (exportInfo) {
      exportInfo.status = 'cancelled';
      exportInfo.endTime = new Date();
      
      this.activeExports.delete(reportId);
      
      return true;
    }
    return false;
  }

  async scheduleReport(scheduleConfig) {
    try {
      this.validateScheduleConfig(scheduleConfig);
      
      const result = await callEdgeFunction('schedule-report', scheduleConfig);
      
      if (result) {
        this.scheduledReports.push(result);
        this.updateStatistics('scheduled', 1);
        
        return result;
      }
      
      throw new Error('Error al programar el reporte');
      
    } catch (error) {
      console.error('Error scheduling report:', error);
      throw error;
    }
  }

  validateScheduleConfig(config) {
    const requiredFields = ['reportType', 'format', 'frequency'];
    for (const field of requiredFields) {
      if (!config[field]) {
        throw new Error(`Campo requerido: ${field}`);
      }
    }

    const validFrequencies = ['daily', 'weekly', 'monthly', 'quarterly'];
    if (!validFrequencies.includes(config.frequency)) {
      throw new Error('Frecuencia no válida');
    }

    return true;
  }

  async loadAvailableTemplates() {
    try {
      this.templates = {};
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  }

  async loadExportStatistics() {
    try {
      const stats = await callEdgeFunction('get-export-stats');
      if (stats) {
        this.statistics = { ...this.statistics, ...stats };
      }
    } catch (error) {
      console.error('Error loading export statistics:', error);
    }
  }

  async loadExportHistory() {
    try {
      const history = await callEdgeFunction('get-export-history');
      if (history) {
        this.exportHistory = history;
        return this.exportHistory;
      }
    } catch (error) {
      console.error('Error loading export history:', error);
      return [];
    }
  }

  async loadScheduledReports() {
    try {
      const reports = await callEdgeFunction('get-scheduled-reports');
      if (reports) {
        this.scheduledReports = reports;
        return this.scheduledReports;
      }
    } catch (error) {
      console.error('Error loading scheduled reports:', error);
      return [];
    }
  }

  updateStatistics(format, increment = 1) {
    if (this.statistics.hasOwnProperty(format)) {
      this.statistics[format] += increment;
    }
  }

  getStatistics() {
    return { ...this.statistics };
  }

  setupAutomaticCleanup() {
    setInterval(() => {
      this.cleanupCompletedExports();
    }, 600000);
    
    setInterval(() => {
      this.cleanupOldHistory();
    }, 3600000);
  }

  cleanupCompletedExports() {
    const now = new Date();
    const maxAge = 30 * 60 * 1000;
    
    for (const [reportId, exportInfo] of this.activeExports.entries()) {
      if (exportInfo.status === 'completed' && 
          now - exportInfo.endTime > maxAge) {
        this.activeExports.delete(reportId);
      }
    }
  }

  cleanupOldHistory() {
    const maxHistoryItems = 100;
    if (this.exportHistory.length > maxHistoryItems) {
      this.exportHistory = this.exportHistory.slice(0, maxHistoryItems);
    }
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatDuration(startTime, endTime) {
    const duration = endTime - startTime;
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  getAvailablePresets() {
    return Object.keys(this.presets);
  }

  getPresetConfig(preset, format) {
    return this.presets[preset]?.[format] || {};
  }

  cleanup() {
    for (const reportId of this.activeExports.keys()) {
      this.cancelExport(reportId);
    }
    
    this.activeExports.clear();
  }
}

const exportService = new ExportService();

export { ExportService, exportService };
export default exportService;
