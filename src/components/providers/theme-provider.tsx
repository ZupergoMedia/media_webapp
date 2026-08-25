"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "zupergo-theme";

interface ThemeContextValue {
  /** What the user has chosen — "system" means "follow the OS". */
  preference: ThemePreference;
  setPreference: (value: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Applies a preference to the DOM.
 *
 * "system" removes the attribute entirely rather than setting it to a third
 * value: globals.css only defines light-mode tokens on bare `:root` plus a
 * `prefers-color-scheme` override, so no attribute IS the system-following
 * state. `light`/`dark` set the attribute explicitly, which globals.css gives
 * priority over the media query.
 */
function applyPreference(preference: ThemePreference) {
  const root = document.documentElement;
  if (preference === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", preference);
  }
}

/**
 * Theme context: light / dark / system, persisted and applied without a
 * flash on load.
 *
 * The no-flash part happens in layout.tsx via a blocking inline script that
 * runs before paint — by the time this component mounts, `data-theme` is
 * already correct, so this only needs to keep state in sync afterwards
 * (reacting to the toggle, and to the OS preference changing while "system"
 * is selected).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Lazy-init from what the blocking script already applied, so React's
  // first render agrees with the DOM instead of guessing "system" and
  // re-rendering.
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    if (typeof window === "undefined") return "system";
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  });

  const setPreference = useCallback((value: ThemePreference) => {
    setPreferenceState(value);
    if (value === "system") {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, value);
    }
    applyPreference(value);
  }, []);

  // Keeps the page live-updated if the OS theme changes while "system" is
  // selected, rather than only picking up the new preference on next load.
  useEffect(() => {
    if (preference !== "system") return;

    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyPreference("system");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [preference]);

  return (
    <ThemeContext.Provider value={{ preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
