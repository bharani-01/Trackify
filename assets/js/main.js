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
