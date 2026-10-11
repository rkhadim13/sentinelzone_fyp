import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../ThemeContext';
import { FiEye, FiEyeOff, FiArrowLeft } from 'react-icons/fi';

const ForgotPassword = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSendOtp = () => {
    if (!/^03\d{9}$/.test(phone)) {
      setError('Enter a valid registered phone number.');
      return;
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(otp);
    setError('');
    setStep(2);
  };

  const handleVerifyOtp = () => {
    if (enteredOtp === generatedOtp) {
      setError('');
      setStep(3);
    } else {
      setError('Incorrect OTP. Please try again.');
    }
  };

  const handleResetPassword = () => {
    const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!strongPassword.test(newPassword)) {
      setError('Password must be 8+ characters with uppercase, lowercase, number, and special character.');
      return;
    }
    setError('');
    alert('Password reset successful! Please log in with your new password.');
    navigate('/login');
  };

  const handleBack = () => {
    setError('');
    if (step === 1) {
      navigate('/login');
    } else {
      setStep(step - 1);
    }
  };

  return (
    <div style={{ ...styles.container, backgroundColor: theme.background, color: theme.text }}>
      <div style={{ ...styles.card, backgroundColor: theme.cardBackground }}>
        <div style={styles.backRow} onClick={handleBack}>
          <FiArrowLeft size={18} color={theme.textMuted} />
          <span style={{ ...styles.backText, color: theme.textMuted }}>Back</span>
        </div>

        <h2 style={{ textAlign: 'center', color: theme.text }}>Reset Password</h2>

        {step === 1 && (
          <>
            <p style={{ ...styles.subtitle, color: theme.textMuted }}>
              Enter your registered phone number to receive an OTP.
            </p>
            <label style={{ color: theme.text }}>Phone Number</label>
            <input
              type="tel"
              placeholder="03XXXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{ ...styles.input, backgroundColor: theme.background, border: `1px solid ${theme.border}`, color: theme.text }}
            />
            {error && <p style={{ ...styles.error, color: theme.danger }}>{error}</p>}
            <button style={{ ...styles.button, backgroundColor: theme.accent }} onClick={handleSendOtp}>
              Send OTP
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <p style={{ ...styles.subtitle, color: theme.textMuted }}>
              Enter the 6-digit OTP sent to your phone.
            </p>
            <div style={styles.demoOtpBox}>
              🔐 Demo Mode — Your OTP is: <b>{generatedOtp}</b>
            </div>
            <label style={{ color: theme.text }}>Enter OTP</label>
            <input
              type="text"
              maxLength={6}
              value={enteredOtp}
              onChange={(e) => setEnteredOtp(e.target.value)}
              style={{ ...styles.input, backgroundColor: theme.background, border: `1px solid ${theme.border}`, color: theme.text }}
            />
            {error && <p style={{ ...styles.error, color: theme.danger }}>{error}</p>}
            <button style={{ ...styles.button, backgroundColor: theme.accent }} onClick={handleVerifyOtp}>
              Verify OTP
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <p style={{ ...styles.subtitle, color: theme.textMuted }}>
              Identity verified. Set your new password.
            </p>
            <label style={{ color: theme.text }}>New Password</label>
            <div style={styles.passwordWrapper}>
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{ ...styles.input, backgroundColor: theme.background, border: `1px solid ${theme.border}`, color: theme.text, paddingRight: '40px' }}
              />
              <span
                onClick={() => setShowNewPassword(!showNewPassword)}
                style={{ ...styles.eyeIcon, color: theme.textMuted }}
              >
                {showNewPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </span>
            </div>

            <label style={{ color: theme.text }}>Confirm Password</label>
            <div style={styles.passwordWrapper}>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{ ...styles.input, backgroundColor: theme.background, border: `1px solid ${theme.border}`, color: theme.text, paddingRight: '40px' }}
              />
              <span
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{ ...styles.eyeIcon, color: theme.textMuted }}
              >
                {showConfirmPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </span>
            </div>

            {error && <p style={{ ...styles.error, color: theme.danger }}>{error}</p>}
            <button style={{ ...styles.button, backgroundColor: theme.accent }} onClick={handleResetPassword}>
              Reset Password
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Arial',
    padding: '20px',
  },
  card: {
    padding: '30px',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '400px',
    boxSizing: 'border-box',
  },
  backRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
    marginBottom: '16px',
    width: 'fit-content',
  },
  backText: {
    fontSize: '14px',
  },
  subtitle: {
    textAlign: 'center',
    fontSize: '14px',
    marginBottom: '16px',
  },
  input: {
    width: '100%',
    padding: '10px',
    marginBottom: '16px',
    borderRadius: '6px',
    boxSizing: 'border-box',
  },
  passwordWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  eyeIcon: {
    position: 'absolute',
    right: '12px',
    top: '10px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  button: {
    width: '100%',
    padding: '12px',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  demoOtpBox: {
    backgroundColor: '#2d3a24',
    border: '1px solid #4ade80',
    color: '#4ade80',
    padding: '10px',
    borderRadius: '6px',
    marginBottom: '16px',
    textAlign: 'center',
  },
  error: {
    fontSize: '13px',
    marginBottom: '10px',
  },
};

export default ForgotPassword;