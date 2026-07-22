const { WebSocketServer, WebSocket } = require('ws');

let wss = null;

/**
 * Initialize WebSocket Server attached to HTTP server
 * @param {import('http').Server} server 
 */
const initWebSocketServer = (server) => {
  wss = new WebSocketServer({ server, path: '/ws/audit-logs' });

  wss.on('connection', (ws, req) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    // Send initial connection acknowledgment
    ws.send(JSON.stringify({
      type: 'CONNECTED',
      message: 'Real-time Activity Audit Stream connected'
    }));

    ws.on('error', (err) => {
      console.error('[WEBSOCKET CLIENT ERROR]:', err.message);
    });
  });

  // Heartbeat ping interval to clean dead connections
  const interval = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  console.log('[WEBSOCKET SERVER]: Initialized on path /ws/audit-logs');
};

/**
 * Broadcast a newly saved audit log row to all connected clients in real-time
 * @param {object} logEntry 
 */
const broadcastAuditLog = (logEntry) => {
  if (!wss || !wss.clients) return;

  const payload = JSON.stringify({
    type: 'NEW_AUDIT_LOG',
    log: logEntry
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
};

module.exports = {
  initWebSocketServer,
  broadcastAuditLog
};
