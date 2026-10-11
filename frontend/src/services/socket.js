/**
 * WebSocket client for CyberShield AI live alerts.
 *
 * Filters out non-alert messages (like connection handshakes)
 * so the app only receives properly-shaped alert payloads:
 *   { sender, type, risk, time }   (extra fields such as username,
 *   message_text, confidence, sha256 are passed through untouched)
 *
 * Also exposes the connection status ('connecting' | 'connected' |
 * 'disconnected') so the sidebar live indicator can show it, and
 * reconnects automatically if the connection drops.
 */

let socket = null;
let listeners = [];
let statusListeners = [];
let status = 'disconnected';
let manualClose = false;
let reconnectTimer = null;
let attempts = 0;

const WS_URL = process.env.REACT_APP_ALERT_WS_URL || 'ws://localhost:4000';
const MAX_RECONNECT_DELAY_MS = 15000;

function setStatus(next) {
  if (status === next) return;
  status = next;
  statusListeners.forEach((cb) => {
    try {
      cb(status);
    } catch (err) {
      console.error('[WS] Status listener threw:', err);
    }
  });
}

/**
 * Only pass through messages that look like real alerts.
 * The alert server sends a welcome message on connection that must be ignored.
 */
function isAlertPayload(data) {
  return (
    data &&
    typeof data === 'object' &&
    typeof data.sender === 'string' &&
    typeof data.type === 'string' &&
    typeof data.risk === 'string'
  );
}

function scheduleReconnect() {
  if (manualClose || reconnectTimer) return;
  const delay = Math.min(1000 * 2 ** attempts, MAX_RECONNECT_DELAY_MS);
  attempts += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectSocket();
  }, delay);
}

export const connectSocket = () => {
  manualClose = false;

  // Avoid double-connect if already open or still connecting
  if (
    socket &&
    (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }

  setStatus('connecting');
  const ws = new WebSocket(WS_URL);
  socket = ws;

  ws.onopen = () => {
    if (socket !== ws) return;
    attempts = 0;
    console.log('[WS] Connected to alert server');
    setStatus('connected');
  };

  ws.onmessage = (event) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch (err) {
      console.warn('[WS] Ignored non-JSON message:', event.data);
      return;
    }

    if (!isAlertPayload(data)) {
      // Connection handshake, heartbeat, or unknown message — ignore
      console.debug('[WS] Ignored non-alert message:', data && data.type ? data.type : 'unknown');
      return;
    }

    listeners.forEach((callback) => {
      try {
        callback(data);
      } catch (err) {
        console.error('[WS] Listener threw:', err);
      }
    });
  };

  ws.onclose = () => {
    // Ignore close events from a socket we already replaced
    if (socket !== ws) return;
    console.log('[WS] Disconnected from alert server');
    setStatus('disconnected');
    scheduleReconnect();
  };

  ws.onerror = (err) => {
    console.error('[WS] Socket error:', err);
  };
};

/**
 * Subscribe to alerts. Returns a function that removes just this listener,
 * so a page can unsubscribe without closing the shared connection.
 */
export const onAlert = (callback) => {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((cb) => cb !== callback);
  };
};

/**
 * Subscribe to connection status changes. Calls back immediately with the
 * current status. Returns an unsubscribe function.
 */
export const onStatusChange = (callback) => {
  statusListeners.push(callback);
  callback(status);
  return () => {
    statusListeners = statusListeners.filter((cb) => cb !== callback);
  };
};

export const getSocketStatus = () => status;

/**
 * Fully close the connection and stop reconnecting (use on logout).
 * Status listeners are kept so the indicator keeps updating.
 */
export const disconnectSocket = () => {
  manualClose = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  attempts = 0;
  if (socket) {
    const ws = socket;
    socket = null;
    ws.close();
  }
  listeners = [];
  setStatus('disconnected');
};