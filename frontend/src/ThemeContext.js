import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

const themes = {
  dark: {
    mode: 'dark',
    background: '#1c2230',
    cardBackground: '#252c3d',
    sidebarBackground: '#141924',
    text: '#ffffff',
    textMuted: '#9fb3c8',
    border: '#3a4a5c',
    accent: '#2a9df4',
    danger: '#e05252',
  },
  light: {
    mode: 'light',
    background: '#f4f6f9',
    cardBackground: '#ffffff',
    sidebarBackground: '#ffffff',
    text: '#1c2230',
    textMuted: '#5a6b7d',
    border: '#d8dee5',
    accent: '#2a9df4',
    danger: '#e05252',
  },
};

export const ThemeProvider = ({ children }) => {
  const [themeName, setThemeName] = useState(() => {
    return localStorage.getItem('sentinelzone-theme') || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('sentinelzone-theme', themeName);
    document.body.style.backgroundColor = themes[themeName].background;
    document.body.style.margin = '0';
  }, [themeName]);

  const toggleTheme = () => {
    setThemeName((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const theme = themes[themeName];

  return (
    <ThemeContext.Provider value={{ theme, themeName, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);