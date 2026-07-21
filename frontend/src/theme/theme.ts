import { StyleSheet, type ViewStyle } from "react-native";
import { DARK, LIGHT, type ColorScheme, type Palette } from "./palette";
import { makeShadows, type Shadows } from "./shadows";

export type Theme = {
  scheme: ColorScheme;
  colors: Palette;
  shadows: Shadows;
  /**
   * Spread into raised surfaces alongside a shadow. Empty in light; a hairline
   * border in dark, where shadows can't carry elevation on their own.
   */
  raisedOutline: ViewStyle;
};

// Exactly two Theme identities exist for the app's lifetime. useThemedStyles
// leans on that: it caches per (factory, theme), so each StyleSheet is built at
// most twice in total and shared across every component instance.
export const LIGHT_THEME: Theme = Object.freeze({
  scheme: "light",
  colors: LIGHT,
  shadows: makeShadows(LIGHT, "light"),
  raisedOutline: {},
});

export const DARK_THEME: Theme = Object.freeze({
  scheme: "dark",
  colors: DARK,
  shadows: makeShadows(DARK, "dark"),
  raisedOutline: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DARK.border,
  },
});

export const themeFor = (scheme: ColorScheme): Theme =>
  scheme === "dark" ? DARK_THEME : LIGHT_THEME;
