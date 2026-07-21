import { useMemo } from "react";
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from "react-native";

import { useTheme } from "./ThemeContext";
import type { Theme } from "./theme";

type NamedStyles<T> = { [K in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * Identity function that exists purely to give the factory's returned object
 * literal a contextual type. Without it, a bare `(t: Theme) => ({ flexDirection:
 * "row" })` widens "row" to string and fails the NamedStyles constraint at the
 * call site. Every style factory must be wrapped in this.
 */
export function themedStyles<T extends NamedStyles<T>>(
  factory: (theme: Theme) => T & NamedStyles<T>,
): (theme: Theme) => T {
  return factory;
}

// Keyed by factory, then by theme. Factories are stable module-level functions
// and there are exactly two Theme identities, so each StyleSheet is created at
// most twice for the whole app and shared by every instance. That's what makes
// it safe for small helper components (Field, Row, StatCard, Stars) to call
// this hook individually — without the cache, seven <Field>s in one form would
// allocate seven stylesheets per render.
const cache = new WeakMap<object, WeakMap<Theme, unknown>>();

export function useThemedStyles<T extends NamedStyles<T>>(
  factory: (theme: Theme) => T,
): T {
  const theme = useTheme();
  return useMemo(() => {
    let perFactory = cache.get(factory);
    if (!perFactory) {
      perFactory = new WeakMap<Theme, unknown>();
      cache.set(factory, perFactory);
    }
    let styles = perFactory.get(theme) as T | undefined;
    if (!styles) {
      styles = StyleSheet.create(factory(theme));
      perFactory.set(theme, styles);
    }
    return styles;
  }, [factory, theme]);
}
