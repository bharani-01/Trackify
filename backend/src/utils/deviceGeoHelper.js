const http = require('http');

// In-memory cache for IP Geolocation queries
const geoCache = new Map();

/**
 * Parse User-Agent string to detect Device Type, OS, Browser, and Bot detection
 * @param {string} uaString 
 * @returns {object} { deviceType, isBot, botName, os, browser }
 */
const parseUserAgent = (uaString = '') => {
  const ua = (uaString || '').toLowerCase();

  // 1. Detect Automated Bots & Security Crawlers
  const botPatterns = [
    { pattern: 'googlebot', name: 'Googlebot' },
    { pattern: 'bingbot', name: 'Bingbot' },
    { pattern: 'yandexbot', name: 'Yandexbot' },
    { pattern: 'duckduckbot', name: 'DuckDuckGo Bot' },
    { pattern: 'slurp', name: 'Yahoo! Slurp' },
    { pattern: 'baiduspider', name: 'Baidu Spider' },
    { pattern: 'facebookexternalhit', name: 'Facebook Crawler' },
    { pattern: 'twitterbot', name: 'Twitterbot' },
    { pattern: 'python', name: 'Python Script' },
    { pattern: 'curl', name: 'cURL Command' },
    { pattern: 'wget', name: 'Wget Downloader' },
    { pattern: 'postman', name: 'Postman API Client' },
    { pattern: 'insomnia', name: 'Insomnia API Client' },
    { pattern: 'go-http-client', name: 'Go HTTP Client' },
    { pattern: 'java/', name: 'Java HTTP Client' },
    { pattern: 'node-fetch', name: 'Node.js Script' },
    { pattern: 'axios', name: 'Axios HTTP Client' },
    { pattern: 'sqlmap', name: 'SQLMap Scanner' },
    { pattern: 'nikto', name: 'Nikto Security Scanner' },
    { pattern: 'nmap', name: 'Nmap Scanner' },
    { pattern: 'nuclei', name: 'Nuclei Security Scanner' },
    { pattern: 'headlesschrome', name: 'Headless Chrome Automation' },
    { pattern: 'puppeteer', name: 'Puppeteer Automation' },
    { pattern: 'playwright', name: 'Playwright Automation' },
    { pattern: 'bot', name: 'Automated Bot' },
    { pattern: 'spider', name: 'Web Spider' },
    { pattern: 'crawler', name: 'Web Crawler' }
  ];

  for (const bot of botPatterns) {
    if (ua.includes(bot.pattern)) {
      return {
        deviceType: 'bot',
        isBot: true,
        botName: bot.name,
        os: 'Automated Agent',
        browser: bot.name
      };
    }
  }

  // 2. Detect Device Category (Mobile, Tablet, Desktop)
  let deviceType = 'desktop';
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile|wpdesktop/i.test(ua)) {
    deviceType = 'mobile';
  }

  // 3. Detect Operating System
  let os = 'Unknown OS';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('macintosh') || ua.includes('mac os')) os = 'macOS';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) os = 'iOS';
  else if (ua.includes('linux')) os = 'Linux';

  // 4. Detect Browser
  let browser = 'Unknown Browser';
  if (ua.includes('edg/')) browser = 'Edge';
  else if (ua.includes('chrome/')) browser = 'Chrome';
  else if (ua.includes('firefox/')) browser = 'Firefox';
  else if (ua.includes('safari/') && !ua.includes('chrome')) browser = 'Safari';

  return {
    deviceType,
    isBot: false,
    botName: null,
    os,
    browser
  };
};

const https = require('https');

/**
 * Resolve IP address to Geo-Location String with multi-provider fallback
 * @param {string} ipAddress 
 * @returns {Promise<string>}
 */
const getGeoLocation = async (ipAddress) => {
  let ip = ipAddress || '';
  if (ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }

  // Clean local loopback IPs
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return 'Localhost / Local Network';
  }

  if (geoCache.has(ip)) {
    return geoCache.get(ip);
  }

  // Provider 1: ip-api.com (HTTP)
  try {
    const geoData = await new Promise((resolve) => {
      const req = http.get(`http://ip-api.com/json/${ip}?fields=status,country,city,regionName,isp`, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve(null);
          }
        });
      });
      req.on('error', () => resolve(null));
      req.setTimeout(1500, () => {
        req.destroy();
        resolve(null);
      });
    });

    if (geoData && geoData.status === 'success') {
      const parts = [geoData.city, geoData.regionName, geoData.country].filter(Boolean);
      const locStr = parts.length > 0 ? parts.join(', ') : 'Unknown Region';
      const result = `${locStr} (${geoData.isp || 'ISP'})`;
      geoCache.set(ip, result);
      return result;
    }
  } catch (err) {}

  // Provider 2 (Fallback): freeipapi.com (HTTPS)
  try {
    const geoData2 = await new Promise((resolve) => {
      const req = https.get(`https://freeipapi.com/api/json/${ip}`, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve(null);
          }
        });
      });
      req.on('error', () => resolve(null));
      req.setTimeout(1500, () => {
        req.destroy();
        resolve(null);
      });
    });

    if (geoData2 && geoData2.countryName) {
      const parts = [geoData2.cityName, geoData2.regionName, geoData2.countryName].filter(Boolean);
      const locStr = parts.length > 0 ? parts.join(', ') : 'Unknown Region';
      const result = `${locStr} (IP Location)`;
      geoCache.set(ip, result);
      return result;
    }
  } catch (err) {}

  // Provider 3 (Fallback): ipwho.is (HTTPS)
  try {
    const geoData3 = await new Promise((resolve) => {
      const req = https.get(`https://ipwho.is/${ip}`, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve(null);
          }
        });
      });
      req.on('error', () => resolve(null));
      req.setTimeout(1500, () => {
        req.destroy();
        resolve(null);
      });
    });

    if (geoData3 && geoData3.success) {
      const parts = [geoData3.city, geoData3.region, geoData3.country].filter(Boolean);
      const locStr = parts.length > 0 ? parts.join(', ') : 'Unknown Region';
      const result = `${locStr} (${geoData3.connection?.isp || 'ISP'})`;
      geoCache.set(ip, result);
      return result;
    }
  } catch (err) {}

  const fallback = 'Unknown Geolocation';
  geoCache.set(ip, fallback);
  return fallback;
};

module.exports = {
  parseUserAgent,
  getGeoLocation
};
