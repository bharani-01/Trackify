const systemSettingsRepository = require('../repositories/systemSettingsRepository');
const { verifyToken } = require('../utils/authHelper');
const userRepository = require('../repositories/userRepository');

let cachedMaint = null;
let cachedBypassEmails = null;
let cacheTime = 0;
const CACHE_TTL_MS = 5000; // 5 seconds cache TTL

const getMaintenanceSettingsCached = async () => {
  const now = Date.now();
  if (cachedMaint === null || cachedBypassEmails === null || now - cacheTime > CACHE_TTL_MS) {
    const mode = await systemSettingsRepository.getSetting('maintenance_mode', 'false');
    const bypass = await systemSettingsRepository.getSetting('maintenance_bypass_emails', '');
    cachedMaint = (mode === 'true');
    cachedBypassEmails = bypass;
    cacheTime = now;
  }
  return { isMaintenance: cachedMaint, bypassEmails: cachedBypassEmails };
};

const setCachedMaintenanceMode = (value) => {
  cachedMaint = !!value;
  cacheTime = Date.now();
};

const setCachedBypassEmails = (emails) => {
  cachedBypassEmails = emails || '';
  cacheTime = Date.now();
};

const maintenanceMiddleware = async (req, res, next) => {
  try {
    const { isMaintenance, bypassEmails } = await getMaintenanceSettingsCached();
    const url = req.path.toLowerCase();

    // Public endpoint to query maintenance mode status
    if (url === '/api/system/maintenance-status') {
      return res.status(200).json({
        success: true,
        maintenance_mode: isMaintenance
      });
    }

    if (!isMaintenance) {
      return next();
    }

    // 1. Bypass static assets & favicon & manifest & service worker
    if (
      url.startsWith('/assets/') || 
      url === '/favicon.ico' || 
      url === '/manifest.json' ||
      url === '/sw.js'
    ) {
      return next();
    }

    // 2. Bypass the maintenance & 404 error pages
    if (url === '/maintenance' || url === '/maintenance.html' || url === '/404' || url === '/404.html') {
      return next();
    }

    // 3. Bypass login routes so administrators and bypass users can log in
    if (
      url === '/login' || 
      url === '/login.html' || 
      url === '/api/auth/login' || 
      url === '/api/auth/logout' ||
      url === '/api/auth/me' ||
      url.startsWith('/api/auth/otp/')
    ) {
      // Clear token cookie if a non-bypassed student hits the login UI page during maintenance
      if (url === '/login' || url === '/login.html') {
        const token = req.cookies.token || (req.headers.authorization && req.headers.authorization.startsWith('Bearer') ? req.headers.authorization.split(' ')[1] : null);
        if (token) {
          try {
            const decoded = verifyToken(token);
            if (decoded) {
              const user = await userRepository.findById(decoded.id);
              if (user && user.role !== 'admin') {
                let isBypassed = false;
                if (user.email && bypassEmails) {
                  const bypassList = bypassEmails.split(',').map(e => e.trim().toLowerCase());
                  if (bypassList.includes(user.email.toLowerCase())) {
                    isBypassed = true;
                  }
                }
                if (!isBypassed) {
                  res.clearCookie('token');
                }
              }
            }
          } catch (e) {
            // Safe ignore
          }
        }
      }
      return next();
    }

    // Check if the user is authenticated & determine if they have bypass permission
    const token = req.cookies.token || (req.headers.authorization && req.headers.authorization.startsWith('Bearer') ? req.headers.authorization.split(' ')[1] : null);
    let user = null;
    
    if (token) {
      const decoded = verifyToken(token);
      if (decoded) {
        user = await userRepository.findById(decoded.id);
      }
    }

    // 4. Bypass admin interface & endpoints (if authenticated admin)
    if (url.startsWith('/admin') || url.startsWith('/api/admin')) {
      if (user && user.role === 'admin') {
        return next();
      }
      
      // If not authenticated admin, block admin API or UI routes
      if (url.startsWith('/api/')) {
        return res.status(403).json({
          success: false,
          message: 'Access denied under maintenance mode.'
        });
      }
      return res.redirect('/login');
    }

    // Check if user's email is in the bypass list
    let isBypassed = false;
    if (user && user.email && bypassEmails) {
      const bypassList = bypassEmails.split(',').map(e => e.trim().toLowerCase());
      if (bypassList.includes(user.email.toLowerCase())) {
        isBypassed = true;
      }
    }

    // If the user has bypass clearance, let them proceed!
    if (isBypassed) {
      return next();
    }

    // 5. For other API requests, return 503 JSON response
    if (url.startsWith('/api/')) {
      return res.status(503).json({
        success: false,
        maintenance: true,
        message: 'The system is undergoing scheduled maintenance. Please try again later.'
      });
    }

    // 6. For page/UI requests, redirect to /maintenance
    return res.redirect('/maintenance');
  } catch (error) {
    console.error('Maintenance middleware error:', error);
    next();
  }
};

module.exports = {
  maintenanceMiddleware,
  setCachedMaintenanceMode,
  setCachedBypassEmails
};
