/**
 * ErrorBoundary — catches React rendering errors in its child tree.
 *
 * When a child component throws an error, React unmounts the entire tree
 * and renders this fallback UI instead. Logs the error for debugging.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <YourApp />
 *   </ErrorBoundary>
 */

import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render shows the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console for debugging
    console.error('[ErrorBoundary] Caught an error:', error, errorInfo);
    this.setState({ errorInfo });

    // In production, you'd send this to an error-tracking service
    // (Sentry, Rollbar, etc.). For now, log it.
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/login';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.container}>
          <div style={styles.card}>
            <div style={styles.icon}>⚠️</div>
            <h1 style={styles.title}>Something went wrong</h1>
            <p style={styles.message}>
              An unexpected error occurred while rendering this page.
              This has been logged for review.
            </p>

            {this.state.error && (
              <details style={styles.details}>
                <summary style={styles.summary}>Technical details</summary>
                <pre style={styles.pre}>
                  {this.state.error.toString()}
                </pre>
              </details>
            )}

            <div style={styles.buttons}>
              <button style={styles.primaryButton} onClick={this.handleReload}>
                Reload Page
              </button>
              <button style={styles.secondaryButton} onClick={this.handleGoHome}>
                Go to Login
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1c2230',
    color: '#ffffff',
    fontFamily: 'Arial, sans-serif',
    padding: '20px',
  },
  card: {
    backgroundColor: '#252c3d',
    borderRadius: '14px',
    padding: '40px',
    maxWidth: '500px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  icon: {
    fontSize: '52px',
    marginBottom: '16px',
  },
  title: {
    fontSize: '22px',
    marginBottom: '12px',
    color: '#ffffff',
  },
  message: {
    fontSize: '14px',
    color: '#9fb3c8',
    lineHeight: '1.6',
    marginBottom: '24px',
  },
  details: {
    textAlign: 'left',
    marginBottom: '24px',
    backgroundColor: '#1c2230',
    padding: '12px',
    borderRadius: '8px',
  },
  summary: {
    cursor: 'pointer',
    fontSize: '13px',
    color: '#9fb3c8',
    marginBottom: '8px',
  },
  pre: {
    fontSize: '11px',
    color: '#e05252',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    margin: 0,
    fontFamily: 'monospace',
  },
  buttons: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  primaryButton: {
    backgroundColor: '#2a9df4',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    color: '#9fb3c8',
    border: '1px solid #3a4a5c',
    padding: '10px 20px',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
  },
};

export default ErrorBoundary;