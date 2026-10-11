import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useIsMobile from '../useIsMobile';
import { useTheme } from '../ThemeContext';
import { useLanguage } from '../LanguageContext';
import { useAppContext } from '../AppContext';
import LiveIndicator from './LiveIndicator';
import {
  FiCompass,
  FiLink,
  FiBarChart2,
  FiDatabase,
  FiCpu,
  FiClock,
  FiFileText,
  FiSettings,
  FiUser,
  FiLogOut,
  FiShield,
  FiSearch,
  FiX,
} from 'react-icons/fi';

const MAX_RESULTS_PER_GROUP = 5;

function Navbar() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { t, isRTL } = useLanguage();
  const { logout, evidenceList, platforms } = useAppContext();

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchInputRef = useRef(null);

  const navItems = [
    { path: '/dashboard', label: t('nav.dashboard'), Icon: FiBarChart2 },
    { path: '/onboarding', label: t('nav.onboarding'), Icon: FiCompass },
    { path: '/connect', label: t('nav.connect'), Icon: FiLink },
    { path: '/checker', label: t('nav.checker'), Icon: FiCpu },
    { path: '/vault', label: t('nav.vault'), Icon: FiDatabase },
    { path: '/timeline', label: t('nav.timeline'), Icon: FiClock },
    { path: '/reports', label: t('nav.reports'), Icon: FiFileText },
    { path: '/settings', label: t('nav.settings'), Icon: FiSettings },
    { path: '/profile', label: t('nav.profile'), Icon: FiUser },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setQuery('');
  };

  const openSearch = () => setSearchOpen(true);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === '/' && !searchOpen) {
        const tag = document.activeElement?.tagName;
        const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable;
        if (!isTyping) {
          e.preventDefault();
          openSearch();
        }
      } else if (e.key === 'Escape' && searchOpen) {
        closeSearch();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchOpen]);

  useEffect(() => {
    if (searchOpen) {
      const id = setTimeout(() => searchInputRef.current?.focus(), 0);
      return () => clearTimeout(id);
    }
  }, [searchOpen]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { pages: [], evidence: [], platforms: [] };

    const pages = navItems.filter((item) => item.label.toLowerCase().includes(q));

    const evidence = (evidenceList || [])
      .filter((e) => (e.title || '').toLowerCase().includes(q))
      .slice(0, MAX_RESULTS_PER_GROUP);

    const platformNames = Object.keys(platforms || {}).filter((name) =>
      name.toLowerCase().includes(q)
    );

    return { pages, evidence, platforms: platformNames };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, evidenceList, platforms]);

  const hasResults =
    results.pages.length > 0 || results.evidence.length > 0 || results.platforms.length > 0;

  const goTo = (path) => {
    navigate(path);
    closeSearch();
  };

  const urduFont = "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', Arial, sans-serif";

  return (
    <div
      style={{
        ...styles.sidebar,
        width: isMobile ? '64px' : '220px',
        backgroundColor: theme.sidebarBackground,
        insetInlineStart: 0,
        borderInlineEnd: `1px solid ${theme.border}`,
      }}
    >
      <div style={styles.logoRow}>
        <div style={styles.logoLeft}>
          <FiShield size={22} color={theme.accent} />
          {!isMobile && (
            <span
              style={{
                ...styles.logoText,
                color: theme.text,
                fontFamily: isRTL ? urduFont : 'Arial',
              }}
            >
              {t('nav.brand')}
            </span>
          )}
        </div>
        <LiveIndicator showLabel={!isMobile} />
      </div>

      <button
        type="button"
        onClick={openSearch}
        aria-label={t('nav.search')}
        style={{
          ...styles.searchButton,
          backgroundColor: theme.background,
          color: theme.textMuted,
          justifyContent: isMobile ? 'center' : 'flex-start',
          border: `1px solid ${theme.border}`,
        }}
      >
        <FiSearch size={16} style={{ minWidth: '16px' }} />
        {!isMobile && <span style={styles.searchButtonText}>{t('nav.search')}</span>}
        {!isMobile && (
          <span style={{ ...styles.searchKbd, borderColor: theme.border, color: theme.textMuted }}>
            /
          </span>
        )}
      </button>

      <div style={styles.links}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const IconComponent = item.Icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              style={{
                ...styles.link,
                backgroundColor: isActive ? theme.accent : 'transparent',
                color: isActive ? '#ffffff' : theme.textMuted,
                justifyContent: isMobile ? 'center' : 'flex-start',
                fontFamily: isRTL ? urduFont : 'Arial',
              }}
            >
              <IconComponent size={18} style={{ minWidth: '18px' }} />
              {!isMobile && <span>{item.label}</span>}
            </Link>
          );
        })}
      </div>

      <div style={{ ...styles.logoutWrapper, borderTop: `1px solid ${theme.border}` }}>
        <button
          onClick={handleLogout}
          style={{
            ...styles.logoutButton,
            justifyContent: isMobile ? 'center' : 'flex-start',
            fontFamily: isRTL ? urduFont : 'Arial',
          }}
        >
          <FiLogOut size={18} style={{ transform: 'scaleX(-1)' }} />
          {!isMobile && <span>{t('nav.logout')}</span>}
        </button>
      </div>

      {searchOpen && (
        <div style={styles.searchOverlay} onClick={closeSearch}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('nav.search')}
            style={{ ...styles.searchPanel, backgroundColor: theme.cardBackground, color: theme.text }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ ...styles.searchInputRow, borderBottom: `1px solid ${theme.border}` }}>
              <FiSearch size={18} color={theme.textMuted} />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('search.placeholder')}
                style={{ ...styles.searchInput, color: theme.text }}
              />
              <button
                type="button"
                onClick={closeSearch}
                aria-label={t('settings.confirm.cancel')}
                style={{ ...styles.searchCloseBtn, color: theme.textMuted }}
              >
                <FiX size={18} />
              </button>
            </div>

            <div style={styles.searchResults}>
              {query.trim() === '' ? (
                <p style={{ ...styles.searchHint, color: theme.textMuted }}>{t('search.hint')}</p>
              ) : !hasResults ? (
                <p style={{ ...styles.searchHint, color: theme.textMuted }}>{t('search.noResults')}</p>
              ) : (
                <>
                  {results.pages.length > 0 && (
                    <div style={styles.searchGroup}>
                      <p style={{ ...styles.searchGroupLabel, color: theme.textMuted }}>
                        {t('search.pages')}
                      </p>
                      {results.pages.map((item) => (
                        <button
                          key={item.path}
                          type="button"
                          onClick={() => goTo(item.path)}
                          style={{ ...styles.searchResultRow, color: theme.text }}
                        >
                          <item.Icon size={16} style={{ minWidth: '16px', color: theme.textMuted }} />
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {results.evidence.length > 0 && (
                    <div style={styles.searchGroup}>
                      <p style={{ ...styles.searchGroupLabel, color: theme.textMuted }}>
                        {t('search.evidence')}
                      </p>
                      {results.evidence.map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => goTo('/vault')}
                          style={{ ...styles.searchResultRow, color: theme.text }}
                        >
                          <FiDatabase size={16} style={{ minWidth: '16px', color: theme.textMuted }} />
                          <span>{e.title}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {results.platforms.length > 0 && (
                    <div style={styles.searchGroup}>
                      <p style={{ ...styles.searchGroupLabel, color: theme.textMuted }}>
                        {t('search.platforms')}
                      </p>
                      {results.platforms.map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => goTo('/connect')}
                          style={{ ...styles.searchResultRow, color: theme.text }}
                        >
                          <FiLink size={16} style={{ minWidth: '16px', color: theme.textMuted }} />
                          <span>{name}</span>
                          <span
                            style={{
                              ...styles.searchPlatformChip,
                              backgroundColor: platforms[name] ? '#0df48033' : '#e0828233',
                              color: platforms[name] ? '#1e7b34' : '#ec5555',
                            }}
                          >
                            {platforms[name] ? t('settings.connected') : t('settings.notConnected')}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  sidebar: {
    height: '100vh',
    position: 'fixed',
    top: 0,
    display: 'flex',
    flexDirection: 'column',
    padding: '20px 12px',
    boxSizing: 'border-box',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    marginBottom: '18px',
    // Logical: padding on the "start" edge (left in LTR, right in RTL)
    paddingInlineStart: '8px',
  },
  logoLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minWidth: 0,
  },
  logoText: {
    fontWeight: 'bold',
    fontSize: '16px',
    whiteSpace: 'nowrap',
  },
  searchButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '9px 10px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '18px',
    cursor: 'pointer',
    background: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  searchButtonText: {
    flex: 1,
    // Logical: aligns to the "start" edge
    textAlign: 'start',
  },
  searchKbd: {
    fontSize: '11px',
    padding: '1px 6px',
    borderRadius: '4px',
    border: '1px solid',
    fontFamily: 'monospace',
  },
  links: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    flex: 1,
  },
  link: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: '8px',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'background-color 0.2s',
  },
  logoutWrapper: {
    paddingTop: '12px',
  },
  logoutButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#f83a3a',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  searchOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '80px 16px 16px',
    zIndex: 3000,
  },
  searchPanel: {
    width: '100%',
    maxWidth: '520px',
    borderRadius: '12px',
    boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
    overflow: 'hidden',
  },
  searchInputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '14px 16px',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: '15px',
  },
  searchCloseBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
  },
  searchResults: {
    maxHeight: '360px',
    overflowY: 'auto',
    padding: '8px',
  },
  searchHint: {
    padding: '20px 12px',
    fontSize: '13px',
    textAlign: 'center',
    margin: 0,
  },
  searchGroup: {
    marginBottom: '8px',
  },
  searchGroupLabel: {
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    padding: '8px 10px 4px',
    margin: 0,
  },
  searchResultRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    padding: '9px 10px',
    background: 'none',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    textAlign: 'start',
    cursor: 'pointer',
  },
  searchPlatformChip: {
    // Logical: pushes to the "end" edge (right in LTR, left in RTL)
    marginInlineStart: 'auto',
    fontSize: '11px',
    padding: '2px 8px',
    borderRadius: '999px',
    fontWeight: 600,
  },
};

export default Navbar;