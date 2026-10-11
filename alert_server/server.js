/**
 * CyberShield AI — Alert Broadcast Server
 *
 * Receives alerts from Django on HTTP port 4001 and broadcasts them
 * to all connected React frontend clients via WebSocket on port 4000.
 *
 * This is a publish-subscribe pattern:
 *   Django (publisher) → Alert Server (broker) → Frontend (subscribers)
 */

const http = require('http');
const { WebSocketServer } = require('ws');

// ------------------------------------------------------------
// Configuration
// ------------------------------------------------------------
const WS_PORT = 4000;
const HTTP_PORT = 4001;

// ------------------------------------------------------------
// WebSocket Server (port 4000)
// ------------------------------------------------------------
const wsServer = new WebSocketServer({ port: WS_PORT });

console.log(`[WS] WebSocket server listening on ws://localhost:${WS_PORT}`);

wsServer.on('connection', (socket, request) => {
  const clientIp = request.socket.remoteAddress;
  console.log(`[WS] Client connected from ${clientIp}`);

  // Send a welcome message so the client knows it's connected
  socket.send(JSON.stringify({
    type: 'connection',
    message: 'Connected to CyberShield alert server',
    timestamp: new Date().toISOString(),
  }));

  socket.on('close', () => {
    console.log(`[WS] Client disconnected (${clientIp})`);
  });

  socket.on('error', (err) => {
    console.error(`[WS] Client error: ${err.message}`);
  });
});

/**
 * Broadcast a JSON payload to all currently connected WebSocket clients.
 */
function broadcast(payload) {
  const message = JSON.stringify(payload);
  let count = 0;

  wsServer.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(message);
      count += 1;
    }
  });

  console.log(`[WS] Broadcast to ${count} client(s):`, payload.type || payload.sender || 'unknown');
}

// ------------------------------------------------------------
// HTTP Server (port 4001) — Django publishes alerts here
// ------------------------------------------------------------
const httpServer = http.createServer((req, res) => {
  // CORS — allow Django from any origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'CyberShield Alert Server',
      ws_clients: wsServer.clients.size,
    }));
    return;
  }

  // Publish endpoint — Django sends alerts here
  if (req.method === 'POST' && req.url === '/publish') {
    let body = '';
    req.on('data', (chunk) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        // Ensure a timestamp exists
        if (!payload.time) {
          payload.time = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          });
        }
        broadcast(payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', broadcast_to: wsServer.clients.size }));
      } catch (err) {
        console.error('[HTTP] Invalid JSON payload:', err.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // Default
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

httpServer.listen(HTTP_PORT, () => {
  console.log(`[HTTP] Publish endpoint listening on http://localhost:${HTTP_PORT}/publish`);
});

// ------------------------------------------------------------
// Graceful shutdown
// ------------------------------------------------------------
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down gracefully...');
  wsServer.close();
  httpServer.close(() => {
    console.log('[Server] Goodbye.');
    process.exit(0);
  });
});