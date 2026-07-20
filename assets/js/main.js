/**
 * Trackify - Global Javascript Utilities
 */

// Helper to make API requests with credentials (cookies)
async function apiCall(url, options = {}) {
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  const config = {
    method: options.method || 'GET',
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    credentials: 'include', // Crucial for sending and receiving HttpOnly cookies
  };

  if (options.body) {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, config);
    const data = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        message: data.message || 'Something went wrong',
        data
      };
    }

    // Dynamic dynamic avatar letter initialization
    if (url.endsWith('/api/auth/me') && data.success && data.user) {
      const avatarSpan = document.querySelector('.profile-avatar-container span');
      if (avatarSpan && data.user.name) {
        avatarSpan.innerText = data.user.name.trim().charAt(0).toUpperCase();
      }
    }

    return {
      success: true,
      status: response.status,
      ...data
    };
  } catch (error) {
    console.error(`API Call failed for ${url}:`, error);
    return {
      success: false,
      message: 'Network error or server is unreachable. Please try again.'
    };
  }
}

// Show a customizable toast/alert message
function showAlert(message, type = 'info') {
  // Check if there is an alert container
  let container = document.getElementById('alert-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'alert-container';
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.right = '20px';
    container.style.zIndex = '9999';
    container.style.maxWidth = '350px';
    document.body.appendChild(container);
  }

  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show glass-card border-${type === 'danger' ? 'danger' : type === 'success' ? 'success' : 'info'} text-white shadow-lg p-3 mb-2`;
  alertDiv.role = 'alert';
  alertDiv.innerHTML = `
    <div class="d-flex align-items-center">
      <div class="me-2">
        ${type === 'success' ? '✓' : type === 'danger' ? '✗' : 'ℹ'}
      </div>
      <div>${message}</div>
    </div>
    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="alert" aria-label="Close" style="padding: 1.1rem;"></button>
  `;

  container.appendChild(alertDiv);

  // Automatically remove the alert after 5 seconds
  setTimeout(() => {
    alertDiv.classList.remove('show');
    setTimeout(() => alertDiv.remove(), 300);
  }, 5000);
}

// Perform session logout
async function handleLogout() {
  const result = await apiCall('/api/auth/logout', { method: 'POST' });
  if (result.success) {
    window.location.href = '/login.html';
  } else {
    showAlert(result.message, 'danger');
  }
}

// Dynamic Theme Management (Light/Dark Mode)
document.addEventListener('DOMContentLoaded', () => {
  const currentTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', currentTheme);

  const updateLogos = (theme) => {
    const logos = document.querySelectorAll('img[src*="Logo.webp"], img[src*="logo_light.webp"], img[src*="logo_dark.webp"]');
    logos.forEach(logo => {
      logo.src = theme === 'dark' ? '/assets/images/logo_dark.webp' : '/assets/images/logo_light.webp';
    });
  };

  updateLogos(currentTheme);

  // Inject mobile header logo dynamically wrapped next to dashboard title
  const headerTitle = document.querySelector('.app-header-title');
  if (headerTitle && headerTitle.parentNode) {
    let wrapper = headerTitle.parentNode.querySelector('.header-title-group');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.className = 'header-title-group d-flex align-items-center';
      
      headerTitle.parentNode.insertBefore(wrapper, headerTitle);
      
      // Hide the text title on mobile viewports
      headerTitle.classList.add('d-none', 'd-md-block');
      
      wrapper.appendChild(headerTitle);
      
      const mobileLogo = document.createElement('img');
      mobileLogo.className = 'mobile-header-logo d-md-none';
      mobileLogo.src = currentTheme === 'dark' ? '/assets/images/logo_dark.webp' : '/assets/images/logo_light.webp';
      mobileLogo.alt = 'Trackify Logo';
      mobileLogo.style.height = '32px';
      mobileLogo.style.width = 'auto';
      mobileLogo.style.marginRight = '12px';
      
      wrapper.insertBefore(mobileLogo, headerTitle);
    }
  }

  // Restore sidebar collapse state preference on page load (synced to documentElement)
  const isSidebarCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
  if (isSidebarCollapsed) {
    document.documentElement.classList.add('sidebar-collapsed');
  }

  // Inject desktop sidebar toggle button dynamically
  const appHeader = document.querySelector('.app-header');
  if (appHeader && !appHeader.querySelector('.sidebar-toggle-btn')) {
    const sidebarToggle = document.createElement('button');
    sidebarToggle.className = 'btn btn-glass btn-sm border-0 d-none d-md-flex align-items-center justify-content-center sidebar-toggle-btn me-3';
    sidebarToggle.id = 'desktop-sidebar-toggle';
    sidebarToggle.style.padding = '8px';
    sidebarToggle.style.width = '36px';
    sidebarToggle.style.height = '36px';
    sidebarToggle.style.minWidth = 'unset';
    sidebarToggle.style.color = 'var(--text-primary)';
    sidebarToggle.style.background = 'transparent';
    sidebarToggle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-menu"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`;
    
    sidebarToggle.addEventListener('click', () => {
      document.documentElement.classList.toggle('sidebar-collapsed');
      localStorage.setItem('sidebar-collapsed', document.documentElement.classList.contains('sidebar-collapsed') ? 'true' : 'false');
    });

    // Insert at the beginning of the header
    appHeader.insertBefore(sidebarToggle, appHeader.firstChild);
  }

  // Inject theme toggle button dynamically
  const navContainer = document.querySelector('nav.navbar .container, nav.navbar .container-fluid, .app-header-profile');
  if (navContainer) {
    if (!document.getElementById('theme-toggle-btn')) {
      const toggleBtn = document.createElement('button');
      toggleBtn.id = 'theme-toggle-btn';
      toggleBtn.className = 'btn btn-glass btn-sm border-0 d-flex align-items-center justify-content-center';
      toggleBtn.style.padding = '8px';
      toggleBtn.style.width = '36px';
      toggleBtn.style.height = '36px';
      toggleBtn.style.minWidth = 'unset';
      toggleBtn.style.color = 'var(--text-primary)';
      toggleBtn.style.background = 'transparent';
      
      const setToggleIcon = (theme) => {
        toggleBtn.innerHTML = theme === 'dark'
          ? `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-sun"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></svg>`
          : `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-moon"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
      };

      setToggleIcon(currentTheme);

      toggleBtn.addEventListener('click', () => {
        const activeTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const nextTheme = activeTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', nextTheme);
        localStorage.setItem('theme', nextTheme);
        setToggleIcon(nextTheme);
        updateLogos(nextTheme);
      });

      if (navContainer.classList.contains('app-header-profile')) {
        navContainer.insertBefore(toggleBtn, navContainer.firstChild);
      } else {
        navContainer.appendChild(toggleBtn);
      }
    }
  }
});

// Register Service Worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Trackify Service Worker registered with scope:', registration.scope);
      })
      .catch((error) => {
        console.error('Trackify Service Worker registration failed:', error);
      });
  });
}
