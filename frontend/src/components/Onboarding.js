import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../AppContext';
import { useTheme } from '../ThemeContext';
import useIsMobile from '../useIsMobile';

const PLATFORM_LIST = ['WhatsApp', 'Instagram', 'Facebook'];

function Onboarding() {
  const navigate = useNavigate();
  const { platforms, togglePlatform } = useAppContext();
  const { theme } = useTheme();
  const isMobile = useIsMobile();

  // Matches the pill switch used on the Settings page, so toggles look and
  // behave the same everywhere in the app.
  const Switch = ({ checked }) => (
    <span
      aria-hidden="true"
      style={{
        ...styles.slider,
        backgroundColor: checked ? theme.accent : '#5a6b7d55',
        boxShadow: checked ? `0 0 0 2px ${theme.accent}33` : 'none',
      }}
    >
      <span
        style={{
          ...styles.sliderKnob,
          transform: checked ? 'translateX(20px)' : 'translateX(0px)',
        }}
      />
    </span>
  );

  return (
    <div style={{ ...styles.container, backgroundColor: theme.background, color: theme.text }}>
      <h1 style={{ ...styles.title, fontSize: isMobile ? '22px' : '28px' }}>
        🛡️ Welcome to SentinelZone
      </h1>
      <p style={{ ...styles.subtitle, color: theme.textMuted, fontSize: isMobile ? '14px' : '16px' }}>
        We help protect you from cyber harassment, fraud and fake AI-generated content.
      </p>
      <p style={{ ...styles.text, color: theme.textMuted }}>
        Before we start, please choose which platforms you'd like SentinelZone to monitor.
        Nothing is tracked without your permission.
      </p>

      <div style={styles.toggleList}>
        {PLATFORM_LIST.map((name) => (
          // The whole row is a <label>, not just the switch, so the tappable
          // area on mobile is the full row width instead of a small checkbox.
          <label
            key={name}
            style={{
              ...styles.toggleRow,
              borderBottom: `1px solid ${theme.border}`,
              padding: isMobile ? '16px 4px' : '14px 4px',
            }}
          >
            <span style={styles.toggleLabel}>{name}</span>
            <input
              type="checkbox"
              checked={platforms[name]}
              onChange={() => togglePlatform(name)}
              style={styles.hiddenCheckbox}
            />
            <Switch checked={platforms[name]} />
          </label>
        ))}
      </div>

      <button
        style={{
          ...styles.button,
          backgroundColor: theme.accent,
          width: isMobile ? '100%' : 'auto',
          maxWidth: '300px',
        }}
        onClick={() => navigate('/connect')}
      >
        Continue
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
    justifyContent: 'center',
    padding: '30px 16px',
    fontFamily: 'Arial',
    boxSizing: 'border-box',
  },
  title: {
    marginBottom: '10px',
    textAlign: 'center',
  },
  subtitle: {
    marginBottom: '20px',
    textAlign: 'center',
  },
  text: {
    fontSize: '14px',
    lineHeight: 1.5,
    marginBottom: '30px',
    textAlign: 'center',
    maxWidth: '400px',
  },
  toggleList: {
    width: '100%',
    maxWidth: '320px',
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    boxSizing: 'border-box',
    cursor: 'pointer',
    // Extra horizontal padding via toggleList's maxWidth keeps this from
    // touching the screen edge on narrow phones.
  },
  toggleLabel: {
    fontSize: '15px',
  },
  hiddenCheckbox: {
    // Kept in the DOM (not display:none) so screen readers and keyboard
    // navigation still work; visually replaced by the Switch component.
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0,
  },
  slider: {
    position: 'relative',
    display: 'inline-block',
    width: '46px',
    height: '26px',
    borderRadius: '999px',
    transition: 'background-color 0.25s ease, box-shadow 0.25s ease',
    flexShrink: 0,
  },
  sliderKnob: {
    position: 'absolute',
    height: '22px',
    width: '22px',
    left: '2px',
    top: '2px',
    backgroundColor: 'white',
    borderRadius: '50%',
    transition: 'transform 0.25s ease',
    boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
  },
  button: {
    marginTop: '30px',
    color: 'white',
    border: 'none',
    padding: '14px 30px',
    borderRadius: '8px',
    fontSize: '16px',
    cursor: 'pointer',
    boxSizing: 'border-box',
  },
};

export default Onboarding;