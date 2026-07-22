const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./src/routes/authRoutes');
const subjectRoutes = require('./src/routes/subjectRoutes');
const timetableRoutes = require('./src/routes/timetableRoutes');
const attendanceRoutes = require('./src/routes/attendanceRoutes');
const settingsRoutes = require('./src/routes/settingsRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const departmentRoutes = require('./src/routes/departmentRoutes');
const announcementRoutes = require('./src/routes/announcementRoutes');
const { verifyToken } = require('./src/utils/authHelper');
const userRepository = require('./src/repositories/userRepository');
const systemSettingsRepository = require('./src/repositories/systemSettingsRepository');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
const PORT = process.env.PORT || 3000;

// 1. Block dangerous/unsupported HTTP methods (TRACE, TRACK, CONNECT, DEBUG)
app.use((req, res, next) => {
  const forbiddenMethods = ['TRACE', 'TRACK', 'CONNECT', 'DEBUG'];
  if (forbiddenMethods.includes(req.method.toUpperCase())) {
    res.setHeader('Allow', 'GET, POST, PUT, DELETE, OPTIONS');
    return res.status(405).json({
      success: false,
      message: `HTTP Method ${req.method} is disabled for security reasons.`
    });
  }
  next();
});

// 2. Strict Whitelisted CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'https://trackify-z5y3.onrender.com'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, same-origin calls, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS Policy: Origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 3. Security Headers, Cache-Control and File Protections Middleware
app.use((req, res, next) => {
  // Disable server disclosure & set production security headers
  res.removeHeader('X-Powered-By');
  res.setHeader('Server', 'Trackify-Security');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Hardened Security Headers (HSTS, CSP, Permissions-Policy)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://accounts.google.com; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net; img-src 'self' data: https: blob:; connect-src 'self' https://v2.jokeapi.dev https://accounts.google.com; frame-src 'self' https://accounts.google.com;");

  // Prevent caching of sensitive routes and API responses
  if (req.path.startsWith('/api') || req.path.startsWith('/admin') || req.path.startsWith('/student')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  const url = req.path.toLowerCase();

  // 1. Block sensitive files completely
  const sensitiveFiles = ['.env', '.git', '.sql', 'package.json', 'package-lock.json'];
  const isSensitive = sensitiveFiles.some(file => url.includes(file));

  // 2. Block direct browser navigation to JS files (e.g. main.js)
  const isDirectJs = url.startsWith('/assets/js/') && url.endsWith('.js');
  const secFetchDest = req.headers['sec-fetch-dest'];
  const acceptHeader = req.headers['accept'] || '';
  const isDirectBrowserRequest = secFetchDest === 'document' || acceptHeader.includes('text/html');

  if (isSensitive || (isDirectJs && isDirectBrowserRequest)) {
    res.status(403);
    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Access Denied</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --paper: #f6f5f2;
    --paper-warm: #ffffff;
    --ink: #15141a;
    --alarm: #d81324;
    --alarm-dark: #9c0d1a;
    --line: #15141a;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    min-height: 100vh;
    background: var(--paper);
    background-image:
      radial-gradient(circle at 15% 20%, rgba(216,19,36,0.05), transparent 40%),
      radial-gradient(circle at 85% 80%, rgba(216,19,36,0.05), transparent 40%);
    font-family: 'IBM Plex Mono', monospace;
    color: var(--ink);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow-x: hidden;
    text-align: center;
  }

  /* hazard tape */
  .tape {
    width: 100%;
    height: 14px;
    background: repeating-linear-gradient(
      -45deg,
      var(--ink), var(--ink) 14px,
      #f3b900 14px, #f3b900 28px
    );
    flex-shrink: 0;
  }

  .stage {
    flex: 1;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3rem 1.25rem;
  }

  .card-wrap {
    position: relative;
    animation: slam 0.5s cubic-bezier(.2,1.4,.4,1) both;
  }

  .card {
    position: relative;
    background: var(--paper-warm);
    border: 3px solid var(--ink);
    width: min(480px, 90vw);
    padding: 2.75rem 2rem 2.25rem;
    box-shadow: 10px 10px 0 var(--ink);
    animation: rattle 3.4s ease-in-out infinite;
    /* bite taken out of the top-right corner */
    clip-path: polygon(
      0% 0%, 78% 0%,
      80% 3%, 83% 0%, 86% 4%, 89% 0%, 92% 3%, 95% 0%, 100% 0%,
      100% 100%, 0% 100%
    );
  }

  .stamp {
    position: absolute;
    top: 1.1rem;
    right: -0.5rem;
    transform: rotate(-13deg);
    border: 4px solid var(--alarm);
    color: var(--alarm);
    font-family: 'Archivo Black', sans-serif;
    font-size: 0.85rem;
    letter-spacing: 0.12em;
    padding: 0.35rem 0.6rem;
    border-radius: 6px;
    background: rgba(216,19,36,0.06);
    animation: tremor 0.18s ease-in-out infinite;
  }

  .eyebrow {
    font-size: 0.7rem;
    letter-spacing: 0.22em;
    color: var(--alarm-dark);
    font-weight: 600;
    margin-bottom: 0.9rem;
  }

  .eyebrow::before { content: "▲ "; }

  .title {
    font-family: 'Archivo Black', sans-serif;
    font-size: clamp(1.9rem, 6vw, 2.6rem);
    line-height: 1.05;
    margin: 0 0 1.4rem;
    letter-spacing: -0.01em;
  }

  .title span {
    display: block;
    color: var(--alarm);
    -webkit-text-stroke: 1px var(--ink);
  }

  .terminal {
    background: var(--ink);
    color: #e9e6de;
    border-radius: 4px;
    padding: 1.1rem 1rem;
    text-align: left;
    font-size: 0.86rem;
    line-height: 1.55;
    margin-bottom: 1.75rem;
    position: relative;
    min-height: 5.4em;
  }

  .terminal::before {
    content: "";
    position: absolute;
    top: 0.6rem;
    left: 0.7rem;
    width: 8px; height: 8px;
    border-radius: 50%;
    background: var(--alarm);
    box-shadow: 14px 0 0 #f3b900, 28px 0 0 #3aa657;
  }

  .terminal-body {
    margin-top: 1.3rem;
  }

  .terminal-line {
    display: block;
    color: #ff8a8a;
  }
  .terminal-line + .terminal-line { margin-top: 0.35rem; }
  .terminal-line::before { content: "$ "; color: #6fd08c; }

  .terminal-line.you::before { content: "you> "; color: #f3b900; }
  .terminal-line.you { color: #e9e6de; }
  .terminal-line.sys::before { content: "sys> "; color: #ff5d6c; }
  .terminal-line.sys { color: #ff8a8a; }

  .actions {
    display: flex;
    gap: 0.7rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  .btn {
    font-family: 'IBM Plex Mono', monospace;
    font-weight: 600;
    font-size: 0.85rem;
    letter-spacing: 0.02em;
    padding: 0.7rem 1.2rem;
    border-radius: 4px;
    border: 2.5px solid var(--ink);
    cursor: pointer;
    text-decoration: none;
    color: var(--ink);
    background: var(--paper-warm);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    box-shadow: 4px 4px 0 var(--ink);
  }

  .btn:hover {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0 var(--ink);
  }

  .btn.primary {
    background: var(--ink);
    color: #fff;
  }
  .btn.primary:hover { background: var(--alarm-dark); border-color: var(--alarm-dark); }

  .footnote {
    margin-top: 1.1rem;
    font-size: 0.68rem;
    color: #6b6a70;
    letter-spacing: 0.04em;
  }

  @keyframes slam {
    0% { transform: translateY(-40px) rotate(-3deg); opacity: 0; }
    60% { transform: translateY(6px) rotate(1deg); opacity: 1; }
    100% { transform: translateY(0) rotate(0deg); }
  }

  @keyframes rattle {
    0%, 100% { transform: rotate(0deg); }
    2% { transform: rotate(-0.6deg); }
    4% { transform: rotate(0.6deg); }
    6% { transform: rotate(0deg); }
  }

  @keyframes tremor {
    0%, 100% { transform: rotate(-13deg) translate(0,0); }
    50% { transform: rotate(-12deg) translate(0.5px,-0.5px); }
  }

  @media (prefers-reduced-motion: reduce) {
    .card, .card-wrap, .stamp { animation: none !important; }
  }
</style>
</head>
<body>
  <div class="tape"></div>

  <div class="stage">
    <div class="card-wrap">
      <div class="card">
        <div class="stamp">DENIED</div>
        <div class="eyebrow">Intrusion Detected</div>
        <h1 class="title">Nice try.<span>Bit off more than you could chew.</span></h1>

        <div class="terminal">
          <div class="terminal-body" id="joke-container">Loading roast…</div>
        </div>

        <div class="actions">
          <button class="btn" id="reroll-btn" type="button">Poke it again</button>
          <a href="/" class="btn primary">Get out</a>
        </div>
        <div class="footnote">this attempt has been logged, mocked, and forgotten</div>
      </div>
    </div>
  </div>

  <div class="tape"></div>

  <script>
    // single-line roasts
    const jokes = [
      "whoami: not authorized. not clever either.",
      "directory traversal at this hour? bold. also useless.",
      "your exploit just woke up three interns, and they're laughing.",
      "checked your payload twice. found nothing. like your plan.",
      "spoofed the user-agent, forgot to spoof 'competent'.",
      "this isn't a vulnerability, it's a cry for help. try a tutorial.",
      "access log updated. category: adorable attempt.",
      "toddlers bang on keyboards with more strategy than this.",
      "view-source isn't a skill, it's a phase you outgrow in 8th grade.",
      "error 403: even the firewall felt secondhand embarrassment.",
      "brute-forcing 'password123'? groundbreaking. truly.",
      "your VPN is showing. so is your effort level: low.",
      "SQL injection attempt logged. grammar: also injected.",
      "if persistence were skill, you'd already be inside.",
      "nmap scanned. results: disappointing, much like this attempt.",
      "tried admin/admin first, didn't you.",
      "the only thing you breached today was our patience.",
      "devtools isn't a backdoor, it's just curiosity with extra steps.",
      "your packet sniffer found one thing: our sense of humor.",
      "we've seen better attacks from a Roomba bumping into a wall.",
      "0 vulnerabilities found. 1 ego, currently deflating.",
      "this server has met real hackers. you are not one of them.",
      "keep trying. it's free entertainment for the security team.",
      "your exploit kit called. it wants a refund.",
      "not even autocomplete believes in this attempt.",
      "burp suite, cold coffee, and zero results. relatable.",
      "you've unlocked: a strongly worded log entry.",
      "we rate this intrusion attempt two stars. would not be hacked again.",
      "curl -X GET a personality while you're at it.",
      "ping received. respect: not included."
    ];

    // little back-and-forths, rendered as two lines
    const dialogs = [
      ["you: let me in.", "sys: no."],
      ["you: i know what i'm doing.", "sys: the logs strongly disagree."],
      ["you: this is just for research.", "sys: sure. and this roast is just for you."],
      ["you: i found a vulnerability!", "sys: yes. it's you."],
      ["you: one more try?", "sys: bold of you to assume there's a limit."],
      ["you: i'm a white hat hacker.", "sys: your traffic says otherwise, champ."],
      ["you: can i speak to your manager?", "sys: he's a firewall. he also said no."],
      ["you: what if i said please?", "sys: what if you said goodbye."],
      ["you: i'll just try again in incognito.", "sys: bro, it's not a haunted house."],
      ["you: rate my exploit out of 10.", "sys: negative numbers exist for a reason."],
      ["you: at least tell me i'm close.", "sys: you're close to a strongly worded email."],
      ["you: fine, i'll leave.", "sys: don't let the 404 hit you on the way out."]
    ];

    const jokeEl = document.getElementById('joke-container');
    const cardWrap = document.querySelector('.card-wrap');
    let lastPool = null;
    let lastIndex = -1;

    function render(lines, cls) {
      jokeEl.innerHTML = '';
      lines.forEach(text => {
        const line = document.createElement('span');
        line.className = 'terminal-line' + (cls ? ' ' + cls : '');
        line.textContent = text;
        jokeEl.appendChild(line);
      });
    }

    function roast() {
      // ~35% chance of a dialog exchange, rest single roast lines
      const useDialog = Math.random() < 0.35;
      const pool = useDialog ? dialogs : jokes;

      let i;
      do { i = Math.floor(Math.random() * pool.length); }
      while (pool === lastPool && i === lastIndex && pool.length > 1);
      lastPool = pool;
      lastIndex = i;

      if (useDialog) {
        const [youLine, sysLine] = pool[i];
        jokeEl.innerHTML = '';
        const you = document.createElement('span');
        you.className = 'terminal-line you';
        you.textContent = youLine.replace(/^you:\s*/, '');
        const sys = document.createElement('span');
        sys.className = 'terminal-line sys';
        sys.textContent = sysLine.replace(/^sys:\s*/, '');
        jokeEl.appendChild(you);
        jokeEl.appendChild(sys);
      } else {
        render([pool[i]], null);
      }

      cardWrap.style.animation = 'none';
      void cardWrap.offsetWidth;
      cardWrap.style.animation = 'slam 0.4s cubic-bezier(.2,1.4,.4,1) both';
    }

    roast();
    document.getElementById('reroll-btn').addEventListener('click', roast);
  </script>
</body>
</html>
    `);
  }

  next();
});

// Server-side Route Guard for static HTML files
const protectHtml = (roleRequired) => {
  return async (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
      return res.redirect('/login');
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      res.clearCookie('token');
      return res.redirect('/login');
    }

    try {
      const user = await userRepository.findById(decoded.id);
      if (!user) {
        res.clearCookie('token');
        return res.redirect('/login');
      }

      if (user.is_suspended) {
        res.clearCookie('token');
        return res.redirect('/login?suspended=true');
      }

      if (user.is_approved === false) {
        return res.redirect('/pending-approval');
      }

      if (roleRequired && user.role !== roleRequired) {
        // If they are an admin trying to access student pages, redirect to admin dashboard
        if (user.role === 'admin') {
          return res.redirect('/admin/dashboard');
        }
        // If student trying to access admin, redirect to student dashboard
        return res.redirect('/student/dashboard');
      }

      next();
    } catch (err) {
      console.error('HTML protection middleware error:', err.message);
      return res.redirect('/login');
    }
  };
};

// Middleware to redirect logged-in users away from public auth pages
const redirectIfLoggedIn = async (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return next();
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    res.clearCookie('token');
    return next();
  }

  try {
    const user = await userRepository.findById(decoded.id);
    if (!user || user.is_suspended) {
      res.clearCookie('token');
      return next();
    }

    if (user.is_approved === false) {
      return res.redirect('/pending-approval');
    }

    if (user.role === 'admin') {
      return res.redirect('/admin/dashboard');
    }
    return res.redirect('/student/dashboard');
  } catch (err) {
    console.error('redirectIfLoggedIn middleware error:', err.message);
    return next();
  }
};

// API ROUTES (Must be registered before static HTML middlewares)
app.use('/api/auth', authRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/announcements', announcementRoutes);

// Protected HTML pages for student and admin
app.use('/student', protectHtml('student'), express.static(path.join(__dirname, '../frontend/student'), { extensions: ['html'] }));
app.use('/admin', protectHtml('admin'), express.static(path.join(__dirname, '../frontend/admin'), { extensions: ['html'] }));

// Serve assets globally
app.use('/assets', express.static(path.join(__dirname, '../assets')));

// Apply redirectIfLoggedIn to public entry routes
app.get('/', redirectIfLoggedIn, (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/login', redirectIfLoggedIn, (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

app.get('/login.html', redirectIfLoggedIn, (req, res) => {
  res.redirect('/login');
});

app.get('/register', redirectIfLoggedIn, async (req, res) => {
  try {
    const allowSelfReg = await systemSettingsRepository.getSetting('allow_self_registration', 'true');
    if (allowSelfReg === 'true') {
      res.sendFile(path.join(__dirname, '../frontend/register.html'));
    } else {
      res.redirect('/login?msg=registration_disabled');
    }
  } catch (error) {
    console.error('Error checking self registration status:', error);
    res.redirect('/login');
  }
});

// Dedicated Waiting Lounge route for pending account approvals
app.get(['/pending-approval', '/pending-approval.html'], async (req, res) => {
  const token = req.cookies.token;
  if (!token) {
    return res.redirect('/login');
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    res.clearCookie('token');
    return res.redirect('/login');
  }

  try {
    const user = await userRepository.findById(decoded.id);
    if (!user) {
      res.clearCookie('token');
      return res.redirect('/login');
    }

    if (user.is_suspended) {
      res.clearCookie('token');
      return res.redirect('/login?suspended=true');
    }

    if (user.is_approved !== false) {
      return res.redirect(user.role === 'admin' ? '/admin/dashboard' : '/student/dashboard');
    }

    res.sendFile(path.join(__dirname, '../frontend/pending-approval.html'));
  } catch (err) {
    console.error('Pending approval route error:', err.message);
    return res.redirect('/login');
  }
});

// Serve public static folder (Landing, Login, Register)
app.use(express.static(path.join(__dirname, '../frontend'), { extensions: ['html'] }));

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error'
  });
});

// START SERVER
app.listen(PORT, () => {
  console.log(`Trackify Server is running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  console.log(`Landing Page: http://localhost:${PORT}`);
  
  // Start background reminders and low attendance alarm scheduler
  try {
    const { startScheduler } = require('./src/services/reminderScheduler');
    startScheduler();
  } catch (err) {
    console.error('Failed to start background reminders scheduler service:', err.message);
  }
});
