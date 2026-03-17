// Servicio para gestión de perfiles de usuario
import { SUPABASE_CONFIG } from './config.js';
import { authService } from './authServiceSupabase.js';
import { supabase } from './supabaseClient.js';

const EDGE_FUNCTION_URL = SUPABASE_CONFIG.functions.users;

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

class ProfileService {
  constructor() {
    this.currentProfile = null;
    this.preferences = null;
    this.activityHistory = [];
    this.sessions = [];
    
    this.cache = {
      profile: null,
      preferences: null,
      activity: null,
      stats: null,
      lastUpdate: null
    };
    
    this.cacheTimeout = 5 * 60 * 1000;
  }

  async getCurrentProfile(forceRefresh = false) {
    const now = Date.now();
    
    if (!forceRefresh && 
        this.cache.profile && 
        this.cache.lastUpdate && 
        (now - this.cache.lastUpdate) < this.cacheTimeout) {
      return this.cache.profile;
    }

    try {
      const profile = await callEdgeFunction('get-profile');
      
      this.currentProfile = profile;
      this.cache.profile = profile;
      this.cache.lastUpdate = now;
      
      return profile;
    } catch (error) {
      console.error('Error getting current profile:', error);
      throw error;
    }
  }

  async updateProfile(profileData) {
    try {
      const validatedData = this.validateProfileData(profileData);
      
      const profile = await callEdgeFunction('update-profile', { updates: validatedData });
      
      this.currentProfile = { ...this.currentProfile, ...validatedData };
      this.cache.profile = this.currentProfile;
      this.cache.lastUpdate = Date.now();
      
      return profile;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }

  validateProfileData(data) {
    const validatedData = { ...data };
    
    if (validatedData.email && !this.isValidEmail(validatedData.email)) {
      throw new Error('El formato del email no es válido');
    }
    
    if (validatedData.phone && !this.isValidPhone(validatedData.phone)) {
      throw new Error('El formato del teléfono no es válido');
    }
    
    Object.keys(validatedData).forEach(key => {
      if (validatedData[key] === '') {
        validatedData[key] = null;
      }
    });
    
    return validatedData;
  }

  async uploadAvatar(file) {
    try {
      this.validateAvatarFile(file);
      
      const user = authService.getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      const fileName = `avatar_${user.id}_${Date.now()}`;
      
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type
        });

      if (error) {
        throw new Error(error.message || 'Upload failed');
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      if (this.currentProfile) {
        this.currentProfile.avatarUrl = publicUrl;
        this.cache.profile = this.currentProfile;
      }
      
      return { avatarUrl: publicUrl };
    } catch (error) {
      console.error('Error uploading avatar:', error);
      throw error;
    }
  }

  validateAvatarFile(file) {
    if (!file.type.startsWith('image/')) {
      throw new Error('El archivo debe ser una imagen');
    }
    
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error('La imagen debe ser menor a 5MB');
    }
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const maxDimension = 2048;
        if (img.width > maxDimension || img.height > maxDimension) {
          reject(new Error(`Las dimensiones máximas son ${maxDimension}x${maxDimension}px`));
        } else {
          resolve(true);
        }
      };
      img.onerror = () => reject(new Error('No se pudo procesar la imagen'));
      img.src = URL.createObjectURL(file);
    });
  }

  async removeAvatar() {
    try {
      if (this.currentProfile) {
        this.currentProfile.avatarUrl = null;
        this.cache.profile = this.currentProfile;
      }
      return { success: true };
    } catch (error) {
      console.error('Error removing avatar:', error);
      throw error;
    }
  }

  async getActivityHistory(params = {}) {
    try {
      const activity = await callEdgeFunction('get-activity', params);
      this.activityHistory = activity || [];
      this.cache.activity = activity;
      return activity;
    } catch (error) {
      console.error('Error getting activity history:', error);
      throw error;
    }
  }

  addActivityRecord(activity) {
    if (this.activityHistory) {
      this.activityHistory.unshift(activity);
      
      if (this.activityHistory.length > 50) {
        this.activityHistory = this.activityHistory.slice(0, 50);
      }
      
      this.cache.activity = this.activityHistory;
    }
  }

  async getPreferences() {
    try {
      const preferences = await callEdgeFunction('get-preferences');
      this.preferences = preferences;
      this.cache.preferences = preferences;
      return preferences;
    } catch (error) {
      console.error('Error getting preferences:', error);
      throw error;
    }
  }

  async updatePreferences(preferences) {
    try {
      const updated = await callEdgeFunction('update-preferences', { preferences });
      this.preferences = { ...this.preferences, ...preferences };
      this.cache.preferences = this.preferences;
      
      this.applyPreferences(this.preferences);
      localStorage.setItem('userPreferences', JSON.stringify(this.preferences));
      
      return updated;
    } catch (error) {
      console.error('Error updating preferences:', error);
      throw error;
    }
  }

  applyPreferences(preferences) {
    if (!preferences) return;
    
    if (preferences.theme) {
      document.documentElement.setAttribute('data-theme', preferences.theme);
    }
    
    if (preferences.language) {
      document.documentElement.setAttribute('lang', preferences.language);
    }
    
    if (window.notificationController) {
      window.notificationController.setSoundEnabled(preferences.soundNotifications);
    }
    
    this.configureSystemPreferences(preferences);
  }

  configureSystemPreferences(preferences) {
    if (preferences.autoSave !== undefined) {
      console.log('Auto-save:', preferences.autoSave);
    }
    
    if (preferences.filePreview !== undefined) {
      console.log('File preview:', preferences.filePreview);
    }
    
    if (preferences.timezone) {
      console.log('Timezone:', preferences.timezone);
    }
  }

  async changePassword(passwordData) {
    try {
      this.validatePasswordData(passwordData);
      
      const { currentPassword, newPassword } = passwordData;
      await callEdgeFunction('change-own-password', { currentPassword, password: newPassword });
      
      return { success: true };
    } catch (error) {
      console.error('Error changing password:', error);
      throw error;
    }
  }

  validatePasswordData(data) {
    const { currentPassword, newPassword } = data;
    
    if (!currentPassword || currentPassword.length < 1) {
      throw new Error('La contraseña actual es requerida');
    }
    
    if (!newPassword || newPassword.length < 8) {
      throw new Error('La nueva contraseña debe tener al menos 8 caracteres');
    }
  }

  async getProfileStats() {
    try {
      const stats = await callEdgeFunction('get-stats');
      this.cache.stats = stats;
      return stats;
    } catch (error) {
      console.error('Error getting profile stats:', error);
      throw error;
    }
  }

  async getSessions() {
    try {
      const sessions = await callEdgeFunction('get-sessions');
      this.sessions = sessions || [];
      return sessions;
    } catch (error) {
      console.error('Error getting sessions:', error);
      throw error;
    }
  }

  async revokeSession(sessionId) {
    try {
      await callEdgeFunction('revoke-session', { sessionId });
      this.sessions = this.sessions.filter(session => session.id !== sessionId);
      return { success: true };
    } catch (error) {
      console.error('Error revoking session:', error);
      throw error;
    }
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  isValidPhone(phone) {
    const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,}$/;
    return phoneRegex.test(phone);
  }

  isStrongPassword(password) {
    const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/;
    return strongRegex.test(password);
  }

  getUserInitials(profile = null) {
    const userProfile = profile || this.currentProfile;
    if (!userProfile) return 'U';
    
    const firstName = userProfile.firstName || '';
    const lastName = userProfile.lastName || '';
    
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    } else if (firstName) {
      return firstName.charAt(0).toUpperCase();
    } else {
      return userProfile.username?.charAt(0).toUpperCase() || 'U';
    }
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  clearCache() {
    this.cache = {
      profile: null,
      preferences: null,
      activity: null,
      stats: null,
      lastUpdate: null
    };
  }

  loadStoredPreferences() {
    try {
      const stored = localStorage.getItem('userPreferences');
      if (stored) {
        const preferences = JSON.parse(stored);
        this.applyPreferences(preferences);
        return preferences;
      }
    } catch (error) {
      console.warn('Error loading stored preferences:', error);
    }
    return null;
  }

  async initialize() {
    try {
      this.loadStoredPreferences();
      await this.getCurrentProfile();
      return true;
    } catch (error) {
      console.error('Error initializing profile service:', error);
      return false;
    }
  }
}

const profileService = new ProfileService();

export { ProfileService, profileService };
export default profileService;
