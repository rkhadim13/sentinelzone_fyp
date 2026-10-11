import './App.css';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AppProvider } from './AppContext';
import { ThemeProvider } from './ThemeContext';
import { LanguageProvider } from './LanguageContext';
import Navbar from './components/Navbar';
import Onboarding from './components/Onboarding';
import ConnectSources from './components/ConnectSources';
import Dashboard from './components/Dashboard';
import EvidenceVault from './components/EvidenceVault';
import AIContentChecker from './components/AIContentChecker';
import ConversationTimeline from './components/ConversationTimeline';
import ReportGenerator from './components/ReportGenerator';
import Settings from './components/Settings';
import ProfilePage from './components/ProfilePage';
import Login from './components/Login';
import ForgotPassword from './components/ForgotPassword';
import PrivateRoute from './components/PrivateRoute';
import useIsMobile from './useIsMobile';

function AppContent() {
  const location = useLocation();
  const isMobile = useIsMobile();
  const hideNavbar = location.pathname === '/login' || location.pathname === '/forgot-password';

  return (
    <div className="App" style={{ display: 'flex' }}>
      {!hideNavbar && <Navbar />}
      <div
        style={{
          // Logical property instead of marginLeft: automatically becomes
          // a right-side margin when the page direction is RTL (Urdu),
          // matching the sidebar's own insetInlineStart in Navbar.js.
          marginInlineStart: hideNavbar ? 0 : isMobile ? '64px' : '220px',
          width: '100%',
          minHeight: '100vh',
          boxSizing: 'border-box',
        }}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Protected routes — require valid auth token */}
          <Route path="/onboarding" element={<PrivateRoute><Onboarding /></PrivateRoute>} />
          <Route path="/connect" element={<PrivateRoute><ConnectSources /></PrivateRoute>} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/vault" element={<PrivateRoute><EvidenceVault /></PrivateRoute>} />
          <Route path="/checker" element={<PrivateRoute><AIContentChecker /></PrivateRoute>} />
          <Route path="/timeline" element={<PrivateRoute><ConversationTimeline /></PrivateRoute>} />
          <Route path="/reports" element={<PrivateRoute><ReportGenerator /></PrivateRoute>} />
          <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AppProvider>
          <Router>
            <AppContent />
          </Router>
        </AppProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;