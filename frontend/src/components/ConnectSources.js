import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../AppContext';
import { useTheme } from '../ThemeContext';
import useIsMobile from '../useIsMobile';

function ConnectSources() {
  const navigate = useNavigate();
  const { platforms, togglePlatform } = useAppContext();
  const { theme } = useTheme();
  const isMobile = useIsMobile();
  const platformList = Object.keys(platforms);

  return (
    <div
      style={{
        ...styles.container,
        padding: isMobile ? '24px 16px' : '30px 16px',
        backgroundColor: theme.background,
        color: theme.text,
      }}
    >
      <h1 style={{ ...styles.title, fontSize: isMobile ? '22px' : '28px' }}>
        🔗 Connect Your Sources
      </h1>
      <p
        style={{
          ...styles.subtitle,
          fontSize: isMobile ? '14px' : '16px',
          marginBottom: isMobile ? '28px' : '40px',
          color: theme.textMuted,
        }}
      >
        Link the platforms you want SentinelZone to protect.
      </p>

      {platformList.map((name) => (
        <div
          key={name}
          style={{
            ...styles.card,
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'stretch' : 'center',
            gap: isMobile ? '14px' : '0',
            backgroundColor: theme.cardBackground,
          }}
        >
          <div>
            <h3 style={{ ...styles.platformName, fontSize: isMobile ? '16px' : '18px' }}>
              {name}
            </h3>
            <span
              style={{
                ...styles.statusChip,
                backgroundColor: platforms[name] ? '#3ba771' : '#e39a9a',
                color: platforms[name] ? '#a6f4c5' : '#161515e6',
              }}
            >
              {platforms[name] ? 'Connected' : 'Not Connected'}
            </span>
          </div>
          {/* Full-width, taller button on mobile — well past the ~44px
              minimum tap target guideline; auto-width on desktop. */}
          <button
            style={{
              ...styles.button,
              width: isMobile ? '100%' : 'auto',
              padding: isMobile ? '12px 16px' : '8px 16px',
              fontSize: isMobile ? '15px' : '14px',
              backgroundColor: platforms[name] ? theme.border : theme.accent,
            }}
            onClick={() => togglePlatform(name)}
          >
            {platforms[name] ? 'Disconnect' : 'Connect'}
          </button>
        </div>
      ))}

      <button
        style={{
          ...styles.continueButton,
          width: isMobile ? '100%' : 'auto',
          padding: isMobile ? '14px 30px' : '12px 30px',
          backgroundColor: theme.accent,
        }}
        onClick={() => navigate('/dashboard')}
      >
        Continue to Dashboard
      </button>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    fontFamily: 'Arial',
    boxSizing: 'border-box',
  },
  title: {
    marginBottom: '10px',
  },
  subtitle: {
    textAlign: 'center',
  },
  card: {
    width: '100%',
    maxWidth: '350px',
    padding: '20px',
    borderRadius: '10px',
    marginBottom: '15px',
    display: 'flex',
    justifyContent: 'space-between',
    boxSizing: 'border-box',
  },
  platformName: {
    margin: '0 0 8px 0',
  },
  statusChip: {
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '12px',
  },
  button: {
    color: 'black',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  continueButton: {
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    cursor: 'pointer',
    marginTop: '20px',
    maxWidth: '350px',
  },
};

export default ConnectSources;