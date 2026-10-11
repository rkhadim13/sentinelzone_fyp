import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import {
  evidenceApi,
  platformsApi,
  accountsApi,
  downloadBlob,
  getToken,
  setToken,
} from './services/api';

const AppContext = createContext();

// ------------------------------------------------------------
// localStorage keys (centralized to avoid typos)
// ------------------------------------------------------------
const LS_KEYS = {
  liveAlerts: 'sentinelzone-live-alerts',
  emailAlerts: 'sentinelzone-email-alerts',
};

export function AppProvider({ children }) {
  const [platforms, setPlatforms] = useState({
    WhatsApp: false,
    Instagram: false,
    Facebook: false,
  });

  const [isLoggedIn, setIsLoggedIn] = useState(!!getToken());
  const [currentUser, setCurrentUser] = useState(null);
  const [evidenceList, setEvidenceList] = useState([]);

  // ---- Notification preferences (persisted to localStorage) ----
  const [liveAlerts, setLiveAlertsState] = useState(() => {
    const stored = localStorage.getItem(LS_KEYS.liveAlerts);
    return stored === null ? true : stored === 'true';
  });

  const [emailAlerts, setEmailAlertsState] = useState(() => {
    const stored = localStorage.getItem(LS_KEYS.emailAlerts);
    return stored === null ? false : stored === 'true';
  });

  const setLiveAlerts = (value) => {
    setLiveAlertsState(value);
    localStorage.setItem(LS_KEYS.liveAlerts, String(value));
  };

  const setEmailAlerts = (value) => {
    setEmailAlertsState(value);
    localStorage.setItem(LS_KEYS.emailAlerts, String(value));
  };

  // ---- Load real data from the backend on first mount -----------------
  const refreshPlatforms = useCallback(async () => {
    try {
      const data = await platformsApi.list();
      setPlatforms(data);
    } catch (err) {
      console.error('Failed to load platforms:', err);
    }
  }, []);

  const refreshEvidence = useCallback(async () => {
    try {
      const data = await evidenceApi.list();
      setEvidenceList(data);
    } catch (err) {
      console.error('Failed to load evidence:', err);
    }
  }, []);

  // Re-hydrates the profile after a page refresh: login()/signup() fill
  // currentUser in memory, but that's lost on reload even though the auth
  // token (and isLoggedIn) survives in localStorage. Without this, the
  // Profile page would have a token but no name/email to show.
  const refreshProfile = useCallback(async () => {
    if (!getToken()) return;
    try {
      const data = await accountsApi.me();
      setCurrentUser(data);
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  }, []);

  useEffect(() => {
    refreshPlatforms();
    refreshEvidence();
    if (isLoggedIn && !currentUser) {
      refreshProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshPlatforms, refreshEvidence, refreshProfile]);

  // ---- Platforms --------------------------------------------------------

  const togglePlatform = async (name) => {
    // optimistic update, then reconcile with the server response
    setPlatforms((prev) => ({ ...prev, [name]: !prev[name] }));
    try {
      const updated = await platformsApi.toggle(name);
      setPlatforms((prev) => ({ ...prev, [updated.name]: updated.connected }));
    } catch (err) {
      console.error('Failed to toggle platform:', err);
      // revert on failure
      setPlatforms((prev) => ({ ...prev, [name]: !prev[name] }));
    }
  };

  // ---- Evidence Vault -----------------------------------------------------

  const addEvidence = async ({ title, type, file, text, reason, caseId }) => {
    if (!file && !text) return null;
    const item = await evidenceApi.upload({ title, type, file, text, reason, caseId });
    setEvidenceList((prev) => [item, ...prev]);
    return item;
  };

  const verifyEvidence = async (id) => {
    try {
      const { evidence } = await evidenceApi.verify(id);
      setEvidenceList((prev) => prev.map((e) => (e.id === id ? evidence : e)));
    } catch (err) {
      console.error('Failed to verify evidence:', err);
    }
  };

  const downloadEvidence = async (id) => {
    try {
      const { blob, filename } = await evidenceApi.export(id);
      downloadBlob(blob, filename);
    } catch (err) {
      console.error('Failed to export evidence:', err);
    }
  };

  // ---- Accounts -----------------------------------------------------------

  const login = async ({ email, password }) => {
    const data = await accountsApi.login({ email, password });
    setToken(data.token);
    setIsLoggedIn(true);
    // Keep every field the backend sends (name, email, phone, join date,
    // stats, ...), not just the two we knew about originally — so
    // ProfilePage.js picks up new fields automatically as the backend
    // adds them, with no frontend change required.
    setCurrentUser(data);
    return data;
  };

  const signup = async ({ name, email, password, gender, dob, phone }) => {
    const data = await accountsApi.signup({
      name,
      email,
      password,
      gender: gender ? gender.toLowerCase() : gender,
      dob,
      phone,
    });
    setToken(data.token);
    setIsLoggedIn(true);
    setCurrentUser(data);
    return data;
  };

  const logout = () => {
    setToken(null);
    setIsLoggedIn(false);
    setCurrentUser(null);
  };

  // name/phone edits from the Profile page (#13). Merges the response into
  // currentUser rather than replacing it, in case the backend only echoes
  // back the changed fields.
  const updateProfile = async (payload) => {
    const data = await accountsApi.updateProfile(payload);
    setCurrentUser((prev) => ({ ...prev, ...data }));
    return data;
  };

  // { currentPassword, newPassword }. No local state to update — the
  // caller shows its own success/error message and clears the form.
  const changePassword = (payload) => accountsApi.changePassword(payload);

  return (
    <AppContext.Provider
      value={{
        platforms,
        togglePlatform,
        refreshPlatforms,
        isLoggedIn,
        setIsLoggedIn,
        currentUser,
        login,
        signup,
        logout,
        refreshProfile,
        updateProfile,
        changePassword,
        evidenceList,
        setEvidenceList,
        refreshEvidence,
        addEvidence,
        verifyEvidence,
        downloadEvidence,
        liveAlerts,
        setLiveAlerts,
        emailAlerts,
        setEmailAlerts,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}