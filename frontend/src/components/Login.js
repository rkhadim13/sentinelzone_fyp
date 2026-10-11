import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../ThemeContext';
import { useLanguage } from '../LanguageContext';
import { useAppContext } from '../AppContext';
import { FiEye, FiEyeOff } from 'react-icons/fi';

function Login() {
  const { theme } = useTheme();
  const { t, language, setLanguage, isRTL } = useLanguage();
  const { login, signup } = useAppContext();
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();
  const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])[\s\S]{8,}$/;
  const validPhone = /^03\d{9}$/;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password || (!isLogin && (!name || !gender || !dob || !phone))) {
      setError(t('auth.error.fillAll'));
      return;
    }

    if (!isLogin) {
      if (!validPhone.test(phone)) {
        setError(t('auth.error.phone'));
        return;
      }
      if (!strongPassword.test(password)) {
        setError(t('auth.error.password'));
        return;
      }
    }

    setSubmitting(true);
    try {
      if (isLogin) {
        await login({ email, password });
        navigate('/dashboard');
      } else {
        await signup({ name, email, password, gender, dob, phone });
        navigate('/onboarding');
      }
    } catch (err) {
      setError(err.message || t('auth.error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  // Urdu font for titles when RTL is active
  const urduFont = "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', Arial, sans-serif";

  return (
    <div style={{ ...styles.container, backgroundColor: theme.background, color: theme.text }}>

      {/* Language toggle — top of page, so users can switch BEFORE logging in */}
      <div style={styles.langToggleWrap}>
        <div style={{ ...styles.langSwitchGroup, backgroundColor: theme.cardBackground, border: `1px solid ${theme.border}` }}>
          <button
            type="button"
            onClick={() => setLanguage('en')}
            aria-pressed={language === 'en'}
            style={{
              ...styles.langOption,
              backgroundColor: language === 'en' ? theme.accent : 'transparent',
              color: language === 'en' ? '#ffffff' : theme.textMuted,
            }}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setLanguage('ur')}
            aria-pressed={language === 'ur'}
            style={{
              ...styles.langOption,
              backgroundColor: language === 'ur' ? theme.accent : 'transparent',
              color: language === 'ur' ? '#ffffff' : theme.textMuted,
              fontFamily: urduFont,
            }}
          >
            اردو
          </button>
        </div>
      </div>

      <div style={{ ...styles.card, backgroundColor: theme.cardBackground }}>
        <h1 style={{ ...styles.title, color: theme.accent, fontFamily: isRTL ? urduFont : 'Arial' }}>
          🛡️ {t('app.name')}
        </h1>
        <p style={{ ...styles.subtitle, color: theme.textMuted, fontFamily: isRTL ? urduFont : 'Arial' }}>
          {isLogin ? t('auth.login.subtitle') : t('auth.signup.subtitle')}
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          {!isLogin && (
            <div style={styles.field}>
              <label style={{ ...styles.label, color: theme.textMuted }}>{t('auth.name')}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ ...styles.input, backgroundColor: theme.background, border: `1px solid ${theme.border}`, color: theme.text }}
                placeholder={t('auth.name.placeholder')}
              />
            </div>
          )}

          <div style={styles.field}>
            <label style={{ ...styles.label, color: theme.textMuted }}>{t('auth.email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ ...styles.input, backgroundColor: theme.background, border: `1px solid ${theme.border}`, color: theme.text }}
              placeholder={t('auth.email.placeholder')}
            />
          </div>

          <div style={styles.field}>
            <label style={{ ...styles.label, color: theme.textMuted }}>{t('auth.password')}</label>
            <div style={styles.passwordWrapper}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  ...styles.input,
                  backgroundColor: theme.background,
                  border: `1px solid ${theme.border}`,
                  color: theme.text,
                  // Logical padding — swaps sides automatically in RTL
                  paddingInlineEnd: '40px',
                  width: '100%',
                }}
                placeholder={t('auth.password.placeholder')}
              />
              <span
                onClick={() => setShowPassword(!showPassword)}
                style={{ ...styles.eyeIcon, color: theme.textMuted }}
              >
                {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </span>
            </div>
          </div>

          {!isLogin && (
            <>
              <div style={styles.field}>
                <label style={{ ...styles.label, color: theme.textMuted }}>{t('auth.gender')}</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  style={{ ...styles.input, backgroundColor: theme.background, border: `1px solid ${theme.border}`, color: theme.text }}
                >
                  <option value="">{t('auth.gender.select')}</option>
                  <option value="Male">{t('auth.gender.male')}</option>
                  <option value="Female">{t('auth.gender.female')}</option>
                  <option value="Other">{t('auth.gender.other')}</option>
                </select>
              </div>

              <div style={styles.field}>
                <label style={{ ...styles.label, color: theme.textMuted }}>{t('auth.dob')}</label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  style={{
                    ...styles.input,
                    backgroundColor: theme.background,
                    border: `1px solid ${theme.border}`,
                    color: theme.text,
                    colorScheme: theme.mode === 'dark' ? 'dark' : 'light',
                  }}
                />
              </div>

              <div style={styles.field}>
                <label style={{ ...styles.label, color: theme.textMuted }}>{t('auth.phone')}</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{ ...styles.input, backgroundColor: theme.background, border: `1px solid ${theme.border}`, color: theme.text }}
                  placeholder={t('auth.phone.placeholder')}
                />
              </div>
            </>
          )}

          {error && <p style={{ ...styles.error, color: theme.danger }}>{error}</p>}

          <button type="submit" disabled={submitting} style={{ ...styles.submitButton, backgroundColor: theme.accent }}>
            {submitting
              ? (isLogin ? t('auth.login.loading') : t('auth.signup.loading'))
              : (isLogin ? t('auth.login') : t('auth.signup'))}
          </button>
        </form>

        {isLogin && (
          <p style={styles.forgotText}>
            <span
              style={{ ...styles.switchLink, color: theme.accent }}
              onClick={() => navigate('/forgot-password')}
            >
              {t('auth.forgot')}
            </span>
          </p>
        )}

        <p style={{ ...styles.switchText, color: theme.textMuted }}>
          {isLogin ? t('auth.noAccount') : t('auth.haveAccount')}{' '}
          <span
            style={{ ...styles.switchLink, color: theme.accent }}
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
          >
            {isLogin ? t('auth.switchToSignup') : t('auth.switchToLogin')}
          </span>
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Arial',
    padding: '20px',
    position: 'relative',
  },
  langToggleWrap: {
    position: 'absolute',
    top: '20px',
    // Logical property — flips to the left side in RTL automatically
    insetInlineEnd: '20px',
    zIndex: 10,
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
    padding: '6px 14px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.2s ease, color 0.2s ease',
  },
  card: {
    borderRadius: '14px',
    padding: '40px',
    width: '100%',
    maxWidth: '380px',
  },
  title: {
    fontSize: '28px',
    textAlign: 'center',
    marginBottom: '5px',
  },
  subtitle: {
    fontSize: '14px',
    textAlign: 'center',
    marginBottom: '30px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
  },
  input: {
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '14px',
    outline: 'none',
  },
  passwordWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  eyeIcon: {
    position: 'absolute',
    // Logical property — moves to the left side in RTL
    insetInlineEnd: '12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  error: {
    fontSize: '13px',
    margin: 0,
  },
  submitButton: {
    color: 'white',
    border: 'none',
    padding: '12px',
    borderRadius: '8px',
    fontSize: '15px',
    cursor: 'pointer',
    marginTop: '8px',
  },
  forgotText: {
    textAlign: 'center',
    fontSize: '13px',
    marginTop: '14px',
  },
  switchText: {
    textAlign: 'center',
    fontSize: '13px',
    marginTop: '20px',
  },
  switchLink: {
    cursor: 'pointer',
    fontWeight: 'bold',
  },
};

export default Login;