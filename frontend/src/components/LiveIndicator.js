import React, { useEffect, useState } from 'react';
import { useTheme } from '../ThemeContext';
import { connectSocket, onStatusChange, getSocketStatus } from '../services/socket';

const STATUS_INFO = {
  connected: { color: '#52e07a', label: 'Live detection on', pulse: true },
  connecting: { color: '#e0a852', label: 'Connecting...', pulse: false },
  disconnected: { color: '#e05252', label: 'Offline, retrying', pulse: false },
};

/**
 * Small status dot for the sidebar.
 *   <LiveIndicator />                 dot + text
 *   <LiveIndicator showLabel={false} />   dot only (collapsed sidebar / mobile)
 */
function LiveIndicator({ showLabel = true }) {
  const { theme } = useTheme();
  const [status, setStatus] = useState(getSocketStatus());

  useEffect(() => {
    // Safe to call more than once: it does nothing if already connected.
    connectSocket();
    return onStatusChange(setStatus);
  }, []);

  const info = STATUS_INFO[status] || STATUS_INFO.disconnected;

  return (
    <div style={styles.wrapper} role="status" aria-live="polite" title={info.label}>
      <style>{`
        @keyframes cs-live-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(82, 224, 122, 0.6); }
          70%  { box-shadow: 0 0 0 8px rgba(82, 224, 122, 0); }
          100% { box-shadow: 0 0 0 0 rgba(82, 224, 122, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .cs-live-dot { animation: none !important; }
        }
      `}</style>
      <span
        className="cs-live-dot"
        style={{
          ...styles.dot,
          backgroundColor: info.color,
          animation: info.pulse ? 'cs-live-pulse 1.8s infinite' : 'none',
        }}
      />
      {showLabel && (
        <span style={{ ...styles.label, color: theme.textMuted }}>{info.label}</span>
      )}
    </div>
  );
}

const styles = {
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  dot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  label: {
    fontSize: '12px',
    whiteSpace: 'nowrap',
  },
};

export default LiveIndicator;