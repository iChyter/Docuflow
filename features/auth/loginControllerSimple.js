// loginControllerSimple.js - Controlador de login con Supabase
import { authService } from '../../shared/services/authServiceSupabase.js';
import { showNotification } from '../../shared/utils/uiHelpers.js';

class SimpleLoginController {
  constructor() {
    this.init();
  }

  init() {
    // Solo configurar eventos, no verificar autenticación aquí
    this.setupEventListeners();
    this.clearStoredCredentials(); // Limpiar cualquier sesión previa
  }

  setupEventListeners() {
    // Formulario de login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    }

    // Mostrar/ocultar contraseña
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    
    if (togglePassword && passwordInput) {
      togglePassword.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        
        const icon = togglePassword.querySelector('i');
        if (icon) {
          icon.className = type === 'password' ? 'bi bi-eye' : 'bi bi-eye-slash';
        }
      });
    }
  }

  async handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById('username')?.value.trim();
    const password = document.getElementById('password')?.value;

    if (!email || !password) {
      showNotification('Por favor, completa todos los campos', 'error');
      return;
    }

    this.setLoading(true);

    try {
      const result = await authService.login(email, password);

      if (result && result.user) {
        const user = result.user;
        showNotification(`¡Bienvenido ${user?.full_name || user?.username || 'Usuario'}!`, 'success');

        setTimeout(() => {
          window.location.href = '../dashboard/dashboard.html';
        }, 1000);

      } else {
        throw new Error('Credenciales incorrectas');
      }

    } catch (error) {
      console.error('Login error:', error);
      showNotification(error.message || 'Error al iniciar sesión', 'error');
    } finally {
      this.setLoading(false);
    }
  }

  setLoading(isLoading) {
    const loginBtn = document.getElementById('loginBtn');
    const btnText = document.querySelector('.btn-text');
    const btnLoading = document.querySelector('.btn-loading');

    if (loginBtn) {
      loginBtn.disabled = isLoading;
    }

    if (btnText && btnLoading) {
      if (isLoading) {
        btnText.classList.add('d-none');
        btnLoading.classList.remove('d-none');
      } else {
        btnText.classList.remove('d-none');
        btnLoading.classList.add('d-none');
      }
    }
  }

  showForgotPassword() {
    showNotification('Contacte al administrador del sistema para recuperar su contraseña.', 'info', 4000);
  }

  // Limpiar credenciales almacenadas para forzar login real
  clearStoredCredentials() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    localStorage.removeItem('refreshToken');
  }
}

// Instancia global
const loginController = new SimpleLoginController();

// Hacer disponible globalmente para uso en HTML
window.loginController = loginController;
window.showForgotPassword = () => loginController.showForgotPassword();

export default loginController;