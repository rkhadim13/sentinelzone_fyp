import React, { useState } from 'react';
import { useTheme } from '../ThemeContext';
import { useLanguage } from '../LanguageContext';
import { useAppContext } from '../AppContext';
import useIsMobile from '../useIsMobile';

const MIN_PASSWORD_LENGTH = 8;

// Accepts a handful of likely field names for the join date, since the
// exact one the backend uses hasn't been confirmed yet.
function formatJoinDate(user, fallback) {
  const raw = user?.joinDate ?? user?.join_date ?? user?.date_joined ?? user?.created_at;
  if (!raw) return fallback;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function initials(name, email) {
  const source = (name || email || '').trim();
  if (!source) return '?';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function ProfilePage() {
  const { theme } = useTheme();
  const { t, isRtl } = useLanguage();
  const { currentUser, updateProfile, changePassword, evidenceList, platforms } = useAppContext();
  const isMobile = useIsMobile();

  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(currentUser?.name || '');
  const [phoneDraft, setPhoneDraft] = useState(currentUser?.phone || '');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null); // { type: 'success' | 'error', text }

  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);

  const startEditing = () => {
    setNameDraft(currentUser?.name || '');
    setPhoneDraft(currentUser?.phone || '');
    setSaveMsg(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setSaveMsg(null);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      await updateProfile({ name: nameDraft.trim(), phone: phoneDraft.trim() });
      setSaveMsg({ type: 'success', text: t('profile.updateSuccess') });
      setEditing(false);
    } catch (err) {
      setSaveMsg({ type: 'error', text: err.message || t('profile.updateError') });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwMsg(null);

    if (pwNew.length < MIN_PASSWORD_LENGTH) {
      setPwMsg({ type: 'error', text: t('profile.password.tooShort') });
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwMsg({ type: 'error', text: t('profile.password.mismatch') });
      return;
    }

    setPwSubmitting(true);
    try {
      await changePassword({ currentPassword: pwCurrent, newPassword: pwNew });
      setPwMsg({ type: 'success', text: t('profile.password.success') });
      setPwCurrent('');
      setPwNew('');
      setPwConfirm('');
    } catch (err) {
      setPwMsg({ type: 'error', text: err.message || t('profile.password.error') });
    } finally {
      setPwSubmitting(false);
    }
  };

  const name = currentUser?.name || '';
  const email = currentUser?.email || '';
  const phone = currentUser?.phone || '';
  const joinDateText = formatJoinDate(currentUser, t('profile.joined.unknown'));
  const platformCount = Object.values(platforms || {}).filter(Boolean).length;

  const inputStyle = {
    ...styles.input,
    backgroundColor: theme.background,
    color: theme.text,
    border: `1px solid ${theme.border}`,
  };

  return (
    <div
      style={{
        ...styles.container,
        padding: isMobile ? '24px 16px' : '40px 60px',
        backgroundColor: theme.background,
        color: theme.text,
      }}
    >
      <h1 style={{ ...styles.title, fontSize: isMobile ? '22px' : '26px' }}>
        👤 {t('profile.title')}
      </h1>
      <p style={{ ...styles.subtitle, color: theme.textMuted }}>{t('profile.subtitle')}</p>

      {/* Identity card */}
      <div style={{ ...styles.card, backgroundColor: theme.cardBackground }}>
        <div
          style={{
            ...styles.identityRow,
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'stretch' : 'flex-start',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ ...styles.avatar, backgroundColor: theme.accent }}>{initials(name, email)}</div>
            {!editing && isMobile && (
              <div>
                <h2 style={styles.name}>{name || email || '—'}</h2>
                <p style={{ ...styles.email, color: theme.textMuted, margin: 0 }}>{email}</p>
              </div>
            )}
          </div>

          <div style={styles.identityText}>
            {!editing ? (
              <>
                {!isMobile && (
                  <>
                    <h2 style={styles.name}>{name || email || '—'}</h2>
                    <p style={{ ...styles.email, color: theme.textMuted }}>{email}</p>
                  </>
                )}
                <p style={{ ...styles.meta, color: theme.textMuted, marginTop: isMobile ? '10px' : 0 }}>
                  {phone || t('profile.phone.placeholder')} · {t('profile.joined')}: {joinDateText}
                </p>
              </>
            ) : (
              <div style={styles.editForm}>
                <label style={styles.fieldLabel}>
                  <span style={{ color: theme.textMuted }}>{t('profile.name')}</span>
                  <input
                    type="text"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    style={inputStyle}
                  />
                </label>
                <label style={styles.fieldLabel}>
                  <span style={{ color: theme.textMuted }}>{t('profile.phone')}</span>
                  <input
                    type="tel"
                    value={phoneDraft}
                    onChange={(e) => setPhoneDraft(e.target.value)}
                    style={inputStyle}
                  />
                </label>
                <label style={styles.fieldLabel}>
                  <span style={{ color: theme.textMuted }}>{t('profile.email')}</span>
                  <input type="email" value={email} disabled style={{ ...inputStyle, opacity: 0.6 }} />
                  <span style={{ ...styles.hint, color: theme.textMuted }}>{t('profile.email.locked')}</span>
                </label>
              </div>
            )}
          </div>

          {!editing && (
            <button
              style={{
                ...styles.editButton,
                width: isMobile ? '100%' : 'auto',
                padding: isMobile ? '12px 16px' : '8px 16px',
                fontSize: isMobile ? '15px' : '13px',
                marginTop: isMobile ? '6px' : 0,
                backgroundColor: theme.accent,
              }}
              onClick={startEditing}
            >
              {t('profile.edit')}
            </button>
          )}
        </div>

        {editing && (
          <div style={{ ...styles.editActions, flexDirection: isMobile ? 'column' : 'row' }}>
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              style={{
                ...styles.saveButton,
                width: isMobile ? '100%' : 'auto',
                padding: isMobile ? '12px 18px' : '9px 18px',
                backgroundColor: theme.accent,
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? t('profile.saving') : t('profile.save')}
            </button>
            <button
              onClick={cancelEditing}
              disabled={saving}
              style={{
                ...styles.cancelButton,
                width: isMobile ? '100%' : 'auto',
                padding: isMobile ? '12px 18px' : '9px 18px',
                backgroundColor: theme.border,
                color: theme.text,
              }}
            >
              {t('profile.cancel')}
            </button>
          </div>
        )}

        {saveMsg && (
          <p style={{ ...styles.message, color: saveMsg.type === 'success' ? '#52e07a' : '#e05252' }}>
            {saveMsg.type === 'success' ? '✅ ' : '⚠️ '}
            {saveMsg.text}
          </p>
        )}
      </div>

      {/* Stats — stack full-width on mobile so numbers stay readable */}
      <div style={{ ...styles.statsRow, flexDirection: isMobile ? 'column' : 'row' }}>
        <div style={{ ...styles.statCard, backgroundColor: theme.cardBackground }}>
          <p style={styles.statNumber}>{evidenceList ? evidenceList.length : 0}</p>
          <p style={{ ...styles.statLabel, color: theme.textMuted }}>{t('profile.stats.evidence')}</p>
        </div>
        <div style={{ ...styles.statCard, backgroundColor: theme.cardBackground }}>
          <p style={styles.statNumber}>{platformCount}</p>
          <p style={{ ...styles.statLabel, color: theme.textMuted }}>{t('profile.stats.platforms')}</p>
        </div>
      </div>

      {/* Change password */}
      <div
        style={{
          ...styles.card,
          backgroundColor: theme.cardBackground,
          maxWidth: isMobile ? '100%' : '420px',
        }}
      >
        <h2 style={styles.sectionTitle}>{t('profile.password.title')}</h2>
        <form onSubmit={handleChangePassword} style={styles.passwordForm}>
          <label style={styles.fieldLabel}>
            <span style={{ color: theme.textMuted }}>{t('profile.password.current')}</span>
            <input
              type="password"
              value={pwCurrent}
              onChange={(e) => setPwCurrent(e.target.value)}
              required
              autoComplete="current-password"
              style={inputStyle}
            />
          </label>
          <label style={styles.fieldLabel}>
            <span style={{ color: theme.textMuted }}>{t('profile.password.new')}</span>
            <input
              type="password"
              value={pwNew}
              onChange={(e) => setPwNew(e.target.value)}
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              style={inputStyle}
            />
          </label>
          <label style={styles.fieldLabel}>
            <span style={{ color: theme.textMuted }}>{t('profile.password.confirm')}</span>
            <input
              type="password"
              value={pwConfirm}
              onChange={(e) => setPwConfirm(e.target.value)}
              required
              autoComplete="new-password"
              style={inputStyle}
            />
          </label>

          <button
            type="submit"
            disabled={pwSubmitting}
            style={{
              ...styles.saveButton,
              width: isMobile ? '100%' : 'auto',
              padding: isMobile ? '12px 18px' : '9px 18px',
              backgroundColor: theme.accent,
              opacity: pwSubmitting ? 0.6 : 1,
              alignSelf: isMobile ? 'stretch' : isRtl ? 'flex-end' : 'flex-start',
            }}
          >
            {pwSubmitting ? t('profile.password.submitting') : t('profile.password.submit')}
          </button>

          {pwMsg && (
            <p style={{ ...styles.message, color: pwMsg.type === 'success' ? '#52e07a' : '#e05252' }}>
              {pwMsg.type === 'success' ? '✅ ' : '⚠️ '}
              {pwMsg.text}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', fontFamily: 'Arial', boxSizing: 'border-box' },
  title: { marginBottom: '5px' },
  subtitle: { marginBottom: '30px' },
  card: {
    borderRadius: '12px',
    padding: '25px',
    marginBottom: '24px',
    maxWidth: '600px',
    boxSizing: 'border-box',
  },
  identityRow: { display: 'flex', gap: '18px', flexWrap: 'wrap' },
  avatar: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    fontWeight: 'bold',
    color: 'white',
    flexShrink: 0,
  },
  identityText: { flex: 1, minWidth: '200px' },
  name: { margin: '0 0 2px 0', fontSize: '19px' },
  email: { margin: '0 0 6px 0', fontSize: '13px' },
  meta: { margin: 0, fontSize: '13px' },
  editButton: {
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
  },
  editForm: { display: 'flex', flexDirection: 'column', gap: '12px' },
  fieldLabel: { display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' },
  // width: 100% fixes a real bug — these inputs had no explicit width before,
  // so they rendered at the browser's tiny default text-input size.
  input: {
    width: '100%',
    padding: '9px 12px',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  hint: { fontSize: '11px' },
  editActions: { display: 'flex', gap: '10px', marginTop: '18px' },
  saveButton: {
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  cancelButton: {
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  message: { fontSize: '13px', marginTop: '14px', marginBottom: 0 },
  statsRow: { display: 'flex', gap: '16px', maxWidth: '600px', marginBottom: '24px' },
  statCard: { flex: '1 1 160px', borderRadius: '12px', padding: '18px 20px', textAlign: 'center' },
  statNumber: { fontSize: '26px', fontWeight: 'bold', margin: '0 0 4px 0' },
  statLabel: { fontSize: '12px', margin: 0 },
  sectionTitle: { fontSize: '16px', marginBottom: '16px' },
  passwordForm: { display: 'flex', flexDirection: 'column', gap: '14px' },
};

export default ProfilePage;