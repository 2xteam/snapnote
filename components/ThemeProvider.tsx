"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  buildCustomVars,
  loadTheme,
  saveTheme,
  type ThemeCustomColor,
  type ThemeId,
} from "@/lib/theme";

type ThemeContextValue = {
  themeId: ThemeId;
  custom: ThemeCustomColor;
  setTheme: (id: ThemeId, custom?: ThemeCustomColor) => void;
};

const DEFAULT_CUSTOM: ThemeCustomColor = { accent: "#3b82f6", bg: "#0a0a0f" };

const ThemeContext = createContext<ThemeContextValue>({
  themeId: "dark",
  custom: DEFAULT_CUSTOM,
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

const CUSTOM_VAR_KEYS = Object.keys(buildCustomVars(DEFAULT_CUSTOM));

function applyTheme(id: ThemeId, custom: ThemeCustomColor) {
  const root = document.documentElement;
  root.setAttribute("data-theme", id);

  if (id === "custom") {
    const vars = buildCustomVars(custom);
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
  } else {
    CUSTOM_VAR_KEYS.forEach((k) => root.style.removeProperty(k));
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>("dark");
  const [custom, setCustom] = useState<ThemeCustomColor>(DEFAULT_CUSTOM);

  const customRef = useRef(custom);
  useEffect(() => { customRef.current = custom; }, [custom]);

  useEffect(() => {
    const stored = loadTheme();
    const c = stored.custom ?? DEFAULT_CUSTOM;
    setThemeId(stored.id);
    setCustom(c);
    customRef.current = c;
    applyTheme(stored.id, c);
  }, []);

  const setTheme = useRef((id: ThemeId, newCustom?: ThemeCustomColor) => {
    const c = newCustom ?? customRef.current;
    setThemeId(id);
    if (newCustom) {
      setCustom(newCustom);
      customRef.current = newCustom;
    }
    saveTheme(id, id === "custom" ? c : undefined);
    applyTheme(id, c);
  }).current;

  return (
    <ThemeContext.Provider value={{ themeId, custom, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
