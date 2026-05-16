import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme-preference') || 'system';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    
    const applyTheme = (themeValue) => {
      let activeTheme = themeValue;
      if (themeValue === 'system') {
        activeTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      
      root.setAttribute('data-theme', activeTheme);
      localStorage.setItem('theme-preference', themeValue);
    };

    applyTheme(theme);

    // Listen for system theme changes if in system mode
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('system');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
