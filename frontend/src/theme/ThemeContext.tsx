import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";

import { storage } from "@/src/utils/storage";
import type { ColorScheme, ThemeMode } from "./palette";
import { readSyncPreference, writeSyncPreference, THEME_KEY } from "./preference-boot";
import { themeFor, type Theme } from "./theme";

type ThemeModeCtl = {
  /** What the user chose, including "system". */
  mode: ThemeMode;
  /** What that resolves to right now. */
  scheme: ColorScheme;
  setMode: (mode: ThemeMode) => void;
};

// Split deliberately. Nearly every screen reads the Theme; only Profile reads
// the controls. Keeping them apart means the controls object changing can't
// re-render the whole app.
const ThemeCtx = createContext<Theme | undefined>(undefined);
const ThemeModeCtx = createContext<ThemeModeCtl | undefined>(undefined);

const isMode = (v: unknown): v is ThemeMode =>
  v === "light" || v === "dark" || v === "system";

export function ThemeProvider({
  children,
}: {
  children: (state: { theme: Theme; ready: boolean }) => ReactNode;
}) {
  const system = useColorScheme();
  // Seeded from the synchronous mirror on web so the first paint is already
  // correct; null on native, where the splash covers the async read.
  const [mode, setModeState] = useState<ThemeMode>(() => readSyncPreference() ?? "system");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await storage.getItem<string>(THEME_KEY, "system");
        if (isMode(stored)) setModeState(stored);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    writeSyncPreference(next);
    void storage.setItem(THEME_KEY, next);
  }, []);

  const scheme: ColorScheme = mode === "system" ? (system ?? "light") : mode;
  // One of two frozen singletons, so this needs no memo of its own.
  const theme = themeFor(scheme);

  const ctl = useMemo<ThemeModeCtl>(
    () => ({ mode, scheme, setMode }),
    [mode, scheme, setMode],
  );

  return (
    <ThemeCtx.Provider value={theme}>
      <ThemeModeCtx.Provider value={ctl}>
        {children({ theme, ready })}
      </ThemeModeCtx.Provider>
    </ThemeCtx.Provider>
  );
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export function useThemeMode(): ThemeModeCtl {
  const ctx = useContext(ThemeModeCtx);
  if (!ctx) throw new Error("useThemeMode must be used within ThemeProvider");
  return ctx;
}
