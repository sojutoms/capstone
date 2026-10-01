import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SystemUI from "expo-system-ui";
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

  // Keep the native root background in step with the JS theme. Without this
  // the native layer stays whatever app.json's `userInterfaceStyle` declared
  // (light), so a dark-mode user gets a white flash on resume and at
  // navigation seams. This context is the only source of truth for theme —
  // the app never reads the system colour scheme.
  useEffect(() => {
    const bg = theme === "dark" ? darkColors.bgPrimary : lightColors.bgPrimary;
    SystemUI.setBackgroundColorAsync(bg).catch(() => {});
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
