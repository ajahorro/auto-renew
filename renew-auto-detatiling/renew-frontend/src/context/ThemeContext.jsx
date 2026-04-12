import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

const DEFAULT_THEME = {
  bgPrimary: "#020617",
  bgSecondary: "#0f172a",
  bgTertiary: "#1e293b",
  textPrimary: "#e2e8f0",
  textSecondary: "#94a3b8",
  borderColor: "#334155",
  cardBg: "#0f172a",
  sidebarBg: "#020617",
  accentBlue: "#3b82f6",
  accentGreen: "#22c55e",
  accentYellow: "#f59e0b",
  accentRed: "#ef4444"
};

const LIGHT_THEME = {
  bgPrimary: "#f1f5f9",
  bgSecondary: "#ffffff",
  bgTertiary: "#e2e8f0",
  textPrimary: "#0f172a",
  textSecondary: "#64748b",
  borderColor: "#cbd5e1",
  cardBg: "#ffffff",
  sidebarBg: "#ffffff",
  accentBlue: "#2563eb",
  accentGreen: "#16a34a",
  accentYellow: "#d97706",
  accentRed: "#dc2626"
};

const DARK_THEME = {
  bgPrimary: "#000000",
  bgSecondary: "#0a0a0a",
  bgTertiary: "#1a1a1a",
  textPrimary: "#f5f5f5",
  textSecondary: "#a3a3a3",
  borderColor: "#2a2a2a",
  cardBg: "#0a0a0a",
  sidebarBg: "#000000",
  accentBlue: "#60a5fa",
  accentGreen: "#4ade80",
  accentYellow: "#fbbf24",
  accentRed: "#f87171"
};

const applyThemeToDOM = (themeVars) => {
  const root = document.documentElement;
  root.style.setProperty("--bg-primary", themeVars.bgPrimary);
  root.style.setProperty("--bg-secondary", themeVars.bgSecondary);
  root.style.setProperty("--bg-tertiary", themeVars.bgTertiary);
  root.style.setProperty("--text-primary", themeVars.textPrimary);
  root.style.setProperty("--text-secondary", themeVars.textSecondary);
  root.style.setProperty("--border-color", themeVars.borderColor);
  root.style.setProperty("--card-bg", themeVars.cardBg);
  root.style.setProperty("--sidebar-bg", themeVars.sidebarBg);
  root.style.setProperty("--accent-blue", themeVars.accentBlue);
  root.style.setProperty("--accent-green", themeVars.accentGreen);
  root.style.setProperty("--accent-yellow", themeVars.accentYellow);
  root.style.setProperty("--accent-red", themeVars.accentRed);
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState("system");

  useEffect(() => {
    // Load saved theme or detect system preference
    const savedTheme = localStorage.getItem("theme");
    const initialTheme = savedTheme || "system";
    
    let themeVars;
    if (initialTheme === "light") {
      themeVars = LIGHT_THEME;
    } else if (initialTheme === "dark") {
      themeVars = DARK_THEME;
    } else {
      // System preference
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      themeVars = prefersDark ? DEFAULT_THEME : LIGHT_THEME;
    }
    
    applyThemeToDOM(themeVars);
    setTheme(initialTheme);
    
    // Listen for system preference changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e) => {
      if (localStorage.getItem("theme") === "system" || !localStorage.getItem("theme")) {
        const newThemeVars = e.matches ? DEFAULT_THEME : LIGHT_THEME;
        applyThemeToDOM(newThemeVars);
      }
    };
    
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const setThemeMode = (mode) => {
    localStorage.setItem("theme", mode);
    let themeVars;
    if (mode === "light") {
      themeVars = LIGHT_THEME;
    } else if (mode === "dark") {
      themeVars = DARK_THEME;
    } else {
      // System
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      themeVars = prefersDark ? DEFAULT_THEME : LIGHT_THEME;
    }
    applyThemeToDOM(themeVars);
    setTheme(mode);
  };

  const toggleTheme = () => {
    const nextTheme = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    setThemeMode(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};
