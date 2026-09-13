import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { lightColors, darkColors } from "../theme";

const THEME_KEY = "theme-preference";

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((stored) => {
      if (stored === "dark" || stored === "light") setTheme(stored);
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(THEME_KEY, theme).catch(() => {});
  }, [theme]);

  const value = useMemo(() => {
    const colors = theme === "dark" ? darkColors : lightColors;
    return {
      theme,
      isDark: theme === "dark",
      colors,
      setTheme,
      toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    };
  }, [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
