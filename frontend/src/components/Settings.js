import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../ThemeContext';
import { useLanguage } from '../LanguageContext';
import { useAppContext } from '../AppContext';
import { accountsApi } from '../services/api';

function Settings() {
  const { theme, themeName, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const { liveAlerts, setLiveAlerts, emailAlerts, setEmailAlerts, platforms } = useAppContext();
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const connectedAccounts = Object.entries(platforms).map(([name, connected]) => ({
    name,
    status: connected ? t('settings.connected') : t('settings.notConnected'),
    connected,
  }));

  // Switch language locally AND persist to the backend so the choice
  // survives across devices. If the API call fails, we keep the local
  // change (better UX than reverting) and log the error.
  const handleLanguageChange = async (lang) => {
    if (lang === language) return;
    setLanguage(lang);
    try {
      if (accountsApi && typeof accountsApi.updateProfile === 'function') {
        await accountsApi.updateProfile({ language: lang });
      }
    } catch (err) {
      console.error('Failed to save language preference to server:', err);
    }
  };

  const handleDeleteData = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await accountsApi.deleteAccount();
      setShowDeleteConfirm(false);
      alert('All data has been permanently deleted. You will be logged out.');
      localStorage.removeItem('sentinelzone_token');
      navigate('/login');
    } catch (err) {
      setDeleteError(err.message || t('settings.deleteFailed'));
      setDeleting(false);
    }
  };

  const isDark = themeName === 'dark';
  const isUrdu = language === 'ur';

  const Switch = ({ checked, onChange }) => (
    <label style={styles.switch}>
      <input type="checkbox" checked={checked} onChange={onChange} style={styles.switchInput} />
      <span
        style={{
          ...styles.slider,
          backgroundColor: checked ? theme.accent : '#5a6b7d55',
          boxShadow: checked ? `0 0 0 2px ${theme.accent}33` : 'none',
        }}
      >
        <span
          style={{
            ...styles.sliderKnob,
            transform: checked
              ? `translateX(${isUrdu ? '-20px' : '20px'})`
              : 'translateX(0px)',
          }}
        />
      </span>
    </label>
  );

  return (
    <div style={{ ...styles.container, backgroundColor: theme.background, color: theme.text }}>
      <h1 style={styles.title}>⚙️ {t('settings.title')}</h1>
      <p style={{ ...styles.subtitle, color: theme.textMuted }}>{t('settings.subtitle')}</p>

      {/* Appearance */}
      <div style={{ ...styles.section, backgroundColor: theme.cardBackground }}>
        <h2 style={styles.sectionTitle}>{t('settings.appearance')}</h2>

        <div style={{ ...styles.row, borderBottom: `1px solid ${theme.border}` }}>
          <div>
            <p style={styles.rowLabel}>{t('settings.theme')}</p>
            <p style={{ ...styles.rowDesc, color: theme.textMuted }}>
              {isDark ? t('settings.theme.dark') : t('settings.theme.light')}
            </p>
          </div>
          <Switch checked={isDark} onChange={toggleTheme} />
        </div>

        <div style={styles.row}>
          <div>
            <p style={styles.rowLabel}>{t('settings.language')}</p>
            <p style={{ ...styles.rowDesc, color: theme.textMuted }}>{t('settings.language.desc')}</p>
          </div>
          <div style={{ ...styles.langSwitchGroup, backgroundColor: theme.background }}>
            <button
              type="button"
              onClick={() => handleLanguageChange('en')}
              aria-pressed={!isUrdu}
              style={{
                ...styles.langOption,
                backgroundColor: !isUrdu ? theme.accent : 'transparent',
                color: !isUrdu ? '#ffffff' : theme.textMuted,
              }}
            >
              {t('settings.language.en')}
            </button>
            <button
              type="button"
              onClick={() => handleLanguageChange('ur')}
              aria-pressed={isUrdu}
              style={{
                ...styles.langOption,
                backgroundColor: isUrdu ? theme.accent : 'transparent',
                color: isUrdu ? '#ffffff' : theme.textMuted,
                fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', Arial, sans-serif",
              }}
            >
              {t('settings.language.ur')}
            </button>
          </div>
        </div>
      </div>

      {/* Notification Preferences */}
      <div style={{ ...styles.section, backgroundColor: theme.cardBackground }}>
        <h2 style={styles.sectionTitle}>{t('settings.notifications')}</h2>

        <div style={{ ...styles.row, borderBottom: `1px solid ${theme.border}` }}>
          <div>
            <p style={styles.rowLabel}>{t('settings.liveAlerts')}</p>
            <p style={{ ...styles.rowDesc, color: theme.textMuted }}>{t('settings.liveAlerts.desc')}</p>
          </div>
          <Switch checked={liveAlerts} onChange={() => setLiveAlerts(!liveAlerts)} />
        </div>

        <div style={styles.row}>
          <div>
            <p style={styles.rowLabel}>{t('settings.emailAlerts')}</p>
            <p style={{ ...styles.rowDesc, color: theme.textMuted }}>{t('settings.emailAlerts.desc')}</p>
          </div>
          <Switch checked={emailAlerts} onChange={() => setEmailAlerts(!emailAlerts)} />
        </div>
      </div>

      {/* Connected Accounts */}
      <div style={{ ...styles.section, backgroundColor: theme.cardBackground }}>
        <h2 style={styles.sectionTitle}>{t('settings.connectedAccounts')}</h2>
        {connectedAccounts.map((acc, i) => (
          <div
            key={i}
            style={{
              ...styles.row,
              borderBottom: i < connectedAccounts.length - 1 ? `1px solid ${theme.border}` : 'none',
            }}
          >
            <p style={styles.rowLabel}>{acc.name}</p>
            <span
              style={{
                ...styles.statusChip,
                backgroundColor: acc.connected ? '#0df480f5' : '#e0828233',
                color: acc.connected ? '#0f1010' : '#ec5555',
              }}
            >
              {acc.status}
            </span>
          </div>
        ))}
      </div>

      {/* Danger Zone */}
      <div style={{ ...styles.section, backgroundColor: theme.cardBackground, borderColor: '#5c2b2b' }}>
        <h2 style={{ ...styles.sectionTitle, color: '#d83535' }}>{t('settings.dangerZone')}</h2>
        <div style={styles.row}>
          <div>
            <p style={styles.rowLabel}>{t('settings.deleteData')}</p>
            <p style={{ ...styles.rowDesc, color: theme.textMuted }}>{t('settings.deleteData.desc')}</p>
          </div>
          <button style={styles.deleteButton} onClick={() => setShowDeleteConfirm(true)}>
            {t('settings.deleteButton')}
          </button>
        </div>
      </div>

      {/* Confirm Delete Modal */}
      {showDeleteConfirm && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalBox, backgroundColor: theme.cardBackground, color: theme.text }}>
            <h3 style={styles.modalTitle}>{t('settings.confirm.title')}</h3>
            <p style={{ ...styles.modalText, color: theme.textMuted }}>{t('settings.confirm.text')}</p>
            {deleteError && (
              <p style={{ color: '#e05252', fontSize: '13px', marginBottom: '12px' }}>
                ⚠️ {deleteError}
              </p>
            )}
            <div style={styles.modalButtons}>
              <button
                style={styles.cancelButton}
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                {t('settings.confirm.cancel')}
              </button>
              <button
                style={styles.confirmDeleteButton}
                onClick={handleDeleteData}
                disabled={deleting}
              >
                {deleting ? t('settings.confirm.deleting') : t('settings.confirm.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    padding: '40px 60px',
    fontFamily: 'Arial',
  },
  title: {
    fontSize: '26px',
    marginBottom: '5px',
  },
  subtitle: {
    marginBottom: '30px',
  },
  section: {
    borderRadius: '12px',
    padding: '25px',
    marginBottom: '20px',
    maxWidth: '600px',
    border: '1px solid transparent',
  },
  sectionTitle: {
    fontSize: '16px',
    marginBottom: '15px',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    gap: '16px',
    flexWrap: 'wrap',
  },
  rowLabel: {
    margin: '0 0 4px 0',
    fontSize: '14px',
  },
  rowDesc: {
    margin: 0,
    fontSize: '12px',
  },
  statusChip: {
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '12px',
  },
  switch: {
    position: 'relative',
    display: 'inline-block',
    width: '46px',
    height: '26px',
    cursor: 'pointer',
    flexShrink: 0,
  },
  switchInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    margin: 0,
    opacity: 0,
    cursor: 'pointer',
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
  },
  slider: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: '999px',
    transition: 'background-color 0.25s ease, box-shadow 0.25s ease',
    pointerEvents: 'none',
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
  langSwitchGroup: {
    display: 'inline-flex',
    borderRadius: '999px',
    padding: '3px',
    flexShrink: 0,
  },
  langOption: {
    border: 'none',
    borderRadius: '999px',
    padding: '6px 16px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.2s ease, color 0.2s ease',
  },
  deleteButton: {
    backgroundColor: '#d83535',
    color: '#0d0d0d',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBox: {
    padding: '30px',
    borderRadius: '12px',
    maxWidth: '380px',
    textAlign: 'center',
  },
  modalTitle: {
    marginTop: 0,
  },
  modalText: {
    fontSize: '13px',
    marginBottom: '20px',
  },
  modalButtons: {
    display: 'flex',
    justifyContent: 'center',
    gap: '10px',
  },
  cancelButton: {
    backgroundColor: '#131415',
    color: 'white',
    border: 'none',
    padding: '10px 18px',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  confirmDeleteButton: {
    backgroundColor: '#f15e5e',
    color: 'white',
    border: 'none',
    padding: '10px 18px',
    borderRadius: '6px',
    cursor: 'pointer',
  },
};

export default Settings;