/**
 * Trackify - Global Javascript Utilities
 */

// Helper to make API requests with credentials (cookies)
async function apiCall(url, options = {}, optionalBody = null) {
  let opts = options;
  if (typeof options === 'string') {
    opts = {
      method: options,
      body: optionalBody
    };
  }

  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  const config = {
    method: opts.method || 'GET',
    headers: {
      ...defaultHeaders,
      ...opts.headers,
    },
    credentials: 'include', // Crucial for sending and receiving HttpOnly cookies
  };

  if (opts.body) {
    config.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
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

    // Dynamic dynamic avatar letter or image initialization
    if (url.endsWith('/api/auth/me') && data.success && data.user) {
      const avatarContainer = document.querySelector('.profile-avatar-container');
      if (avatarContainer && data.user) {
        if (data.user.avatar) {
          avatarContainer.innerHTML = `<img src="${data.user.avatar}" alt="Avatar" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover;">`;
        } else if (data.user.name) {
          avatarContainer.innerHTML = `<span class="badge bg-primary text-white d-flex align-items-center justify-content-center fw-bold fs-6" style="width: 36px; height: 36px; border-radius: 50%;">${data.user.name.trim().charAt(0).toUpperCase()}</span>`;
        }
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

// Show a premium top-centered Apple/Stripe-style success HUD toast pill
function showAlert(message, type = 'success') {
  let container = document.getElementById('alert-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'alert-container';
    container.style.position = 'fixed';
    container.style.top = '24px';
    container.style.left = '50%';
    container.style.transform = 'translateX(-50%)';
    container.style.zIndex = '10000';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';
    container.style.pointerEvents = 'none';
    document.body.appendChild(container);
  }

  const alertDiv = document.createElement('div');
  alertDiv.className = `custom-toast-wrapper custom-toast-${type}`;
  alertDiv.style.pointerEvents = 'auto';
  
  let iconSvg = '';
  let bgCircleColor = '#10b981'; // Green for success
  
  if (type === 'success') {
    bgCircleColor = '#10b981';
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  } else if (type === 'danger' || type === 'error') {
    bgCircleColor = '#ef4444';
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
  } else {
    bgCircleColor = '#3b82f6';
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
  }

  alertDiv.innerHTML = `
    <div style="display: flex; align-items: center; background: #0f172a; color: #ffffff; padding: 10px 22px; border-radius: 50px; border: 1px solid rgba(255, 255, 255, 0.15); box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); margin-bottom: 8px; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.88rem; font-weight: 600; animation: toastSpringIn 0.35s cubic-bezier(0.32, 0.72, 0, 1) forwards;">
      <div style="width: 26px; height: 26px; border-radius: 50%; background-color: ${bgCircleColor}; display: flex; align-items: center; justify-content: center; margin-right: 12px; flex-shrink: 0; box-shadow: 0 2px 8px ${bgCircleColor}55;">
        ${iconSvg}
      </div>
      <span style="letter-spacing: -0.01em; color: #ffffff;">${message}</span>
    </div>
  `;

  container.appendChild(alertDiv);

  // Automatically remove after 3 seconds with exit transition
  setTimeout(() => {
    const innerPill = alertDiv.firstElementChild;
    if (innerPill) {
      innerPill.style.animation = 'toastSpringOut 0.25s ease-in forwards';
    }
    setTimeout(() => alertDiv.remove(), 250);
  }, 3000);
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

  // Inject Custom Push link into the sidebar dynamically if we are in admin area
  if (window.location.pathname.startsWith('/admin/')) {
    const sidebarMenu = document.querySelector('.app-sidebar .sidebar-menu');
    if (sidebarMenu) {
      const logoutLink = sidebarMenu.querySelector('.logout-link');
      if (!document.getElementById('sidebar-custom-push')) {
        const link = document.createElement('a');
        link.id = 'sidebar-custom-push';
        link.className = 'sidebar-link' + (window.location.pathname.includes('/admin/notifications') ? ' active' : '');
        link.href = '/admin/notifications.html';
        link.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          <span>Custom Push</span>
        `;
        if (logoutLink) {
          sidebarMenu.insertBefore(link, logoutLink);
        } else {
          sidebarMenu.appendChild(link);
        }
      }
    }
  }

  // Inject Notifications link into student sidebar dynamically if we are in student area
  if (window.location.pathname.startsWith('/student/')) {
    const sidebarMenu = document.querySelector('.app-sidebar .sidebar-menu');
    if (sidebarMenu) {
      const settingsLink = Array.from(sidebarMenu.querySelectorAll('.sidebar-link')).find(link => link.getAttribute('href').includes('/student/settings'));
      if (!document.getElementById('sidebar-student-notifications')) {
        const link = document.createElement('a');
        link.id = 'sidebar-student-notifications';
        link.className = 'sidebar-link' + (window.location.pathname.includes('/student/notifications') ? ' active' : '');
        link.href = '/student/notifications.html';
        link.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          <span>Notifications</span>
        `;
        if (settingsLink) {
          sidebarMenu.insertBefore(link, settingsLink);
        } else {
          sidebarMenu.appendChild(link);
        }
      }
    }
  }
});

// Helper to dynamically load external scripts
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// Initialize FCM Web Push token retrieval and registration
async function initPushNotifications(registration) {
  try {
    // 1. Fetch public VAPID key from backend
    const vapidRes = await apiCall('/api/notifications/vapid-key');
    if (!vapidRes.success || !vapidRes.vapidKey) {
      console.warn('[FCM] VAPID key not configured on backend. Skipping push registration.');
      return;
    }

    // 2. Load Firebase scripts dynamically if not loaded
    if (typeof firebase === 'undefined') {
      await loadScript('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
      await loadScript('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');
    }

    // 3. Initialize Firebase app
    if (!firebase.apps.length) {
      firebase.initializeApp({
        apiKey: "AIzaSyB3WJO-g8N1NHwmu_yJ_y5p5cwGTBYggss",
        authDomain: "trackify-6f561.firebaseapp.com",
        projectId: "trackify-6f561",
        storageBucket: "trackify-6f561.firebasestorage.app",
        messagingSenderId: "488314328374",
        appId: "1:488314328374:web:7190c726d2f5ddbcc98f97",
        measurementId: "G-XG7JZVJJR1"
      });
    }

    const messaging = firebase.messaging();

    // 4. Request Permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[FCM] Notification permission denied.');
      return;
    }

    // 5. Get FCM Token passing the PWA service worker registration
    const token = await messaging.getToken({
      serviceWorkerRegistration: registration,
      vapidKey: vapidRes.vapidKey
    });

    if (token) {
      console.log('[FCM] Retrieved Web FCM Token:', token);
      
      // 6. Save token to backend
      const regRes = await apiCall('/api/notifications/register-token', {
        method: 'POST',
        body: { token, device_type: 'web' }
      });
      if (regRes.success) {
        console.log('[FCM] FCM Token registered on backend successfully.');
      } else {
        console.error('[FCM] Failed to register token on backend:', regRes.message);
      }
    } else {
      console.warn('[FCM] No token retrieved.');
    }
  } catch (err) {
    console.error('[FCM ERROR] Error initializing push notifications:', err.message);
  }
}

// Register Service Worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Trackify Service Worker registered with scope:', registration.scope);
        // Only trigger push notifications registration for logged-in sessions (cookie token exists)
        // We defer this slightly to let initial page load calls finish first
        setTimeout(() => {
          // Check if user is authenticated by fetching profile
          apiCall('/api/auth/me').then(userRes => {
            if (userRes.success && userRes.user) {
              // Verify if push notifications are enabled in settings configurations
              apiCall('/api/settings').then(settingsRes => {
                if (settingsRes.success && settingsRes.settings && settingsRes.settings.push_notifications !== false) {
                  initPushNotifications(registration);
                } else {
                  console.log('[FCM] User has opted-out of push notifications in settings. Skipping registration.');
                }
              });
            }
          });
        }, 1500);
      })
      .catch((error) => {
        console.error('Trackify Service Worker registration failed:', error);
      });
  });
}
