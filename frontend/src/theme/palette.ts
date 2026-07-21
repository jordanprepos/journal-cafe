export type ColorScheme = "light" | "dark";
export type ThemeMode = ColorScheme | "system";

export type Palette = {
  /** Page canvas. */
  background: string;
  /** Cards, inputs, the tab bar pill — anything raised off the canvas. */
  surface: string;
  /** Chip and track fills. Sits above `surface`. */
  surfaceSecondary: string;
  /** Recessed wells: photo placeholders, the detail cover fallback. */
  surfaceSunken: string;
  /** Form dropzones, which sit directly on `background`. */
  inputSurface: string;

  primary: string;
  /** Text/icon colour on a `primary` fill. Not always white — see DARK. */
  onPrimary: string;
  /** Decorative only (large empty-state glyphs); never carries text. */
  primaryMuted: string;

  /** Selected-chip fill; the inverse of the page. */
  inverseSurface: string;
  onInverseSurface: string;

  textPrimary: string;
  textSecondary: string;
  /** Eyebrows, field labels, captions — the app's smallest text. */
  textMuted: string;

  border: string;
  borderSubtle: string;
  borderDashed: string;

  error: string;
  errorSurface: string;
  star: string;

  /** Translucent backing for controls floating over a photo. */
  scrim: string;
  /** Backing for controls over *user* imagery — dark in both schemes. */
  overlay: string;
  /** Foreground on `overlay`. Invariant, because `overlay` is. */
  onOverlay: string;
};

export const LIGHT: Palette = {
  background: "#FBF6EC",
  surface: "#FFFFFF",
  surfaceSecondary: "#EFE6D8",
  surfaceSunken: "#F3EAD9",
  inputSurface: "#FFFDF9",

  primary: "#B85C38",
  onPrimary: "#FFFFFF",
  primaryMuted: "#E2C2B3",

  inverseSurface: "#3E2A1F",
  onInverseSurface: "#FBF6EC",

  textPrimary: "#3E2A1F",
  textSecondary: "#7A6B5C",
  textMuted: "#9C8F82",

  border: "#EFE6D8",
  borderSubtle: "#F3EAD9",
  borderDashed: "#D7C4B1",

  error: "#A94442",
  errorSurface: "#FBEAEA",
  star: "#D4A373",

  scrim: "rgba(255,255,255,0.9)",
  overlay: "rgba(0,0,0,0.6)",
  onOverlay: "#FFFFFF",
};

// Grounded in the design's "Year in Café" recap screen, with two corrections
// where the design's own values fail WCAG AA (noted inline). Contrast figures
// are against `background` unless stated.
export const DARK: Palette = {
  background: "#1F1A17",
  // Deliberately raised, not equal to `background`: the tab bar pill floats
  // over page content and would otherwise dissolve into it.
  surface: "#2A2320",
  surfaceSecondary: "#3A312B",
  // Note this one inverts direction — "sunken" must sit *below* the canvas in
  // dark, or photo placeholders read as raised.
  surfaceSunken: "#191412",
  inputSurface: "#241E1B",

  // Lifted from #B85C38, which is only 3.80:1 here and is used as *text*
  // (Save, link accents, distance badges). This is 5.29:1.
  primary: "#C97B54",
  // White on the lifted primary is 3.26:1 and fails; near-black is 5.14:1.
  // Dark-mode primary buttons therefore get dark labels.
  onPrimary: "#241C18",
  primaryMuted: "#7A5340",

  inverseSurface: "#F4EBDD",
  onInverseSurface: "#1F1A17",

  textPrimary: "#F4EBDD", // 14.59:1
  textSecondary: "#B9A892", // 6.68:1 on surface
  // The recap screen's #8C7A63 is 4.17:1 — under AA, and this token carries
  // the smallest text in the app. Warm-shifted to reach 5.16:1.
  textMuted: "#9C8A72",

  // Stronger than a naive inversion: in dark, borders do the separation work
  // that shadows cannot.
  border: "#4A4038",
  borderSubtle: "#383029",
  borderDashed: "#5C4E42",

  error: "#E8918D", // 7.28:1
  errorSurface: "#3A2220",
  star: "#D4A373", // 7.62:1 — genuinely scheme-invariant

  scrim: "rgba(31,26,23,0.85)",
  // Unchanged: this backs controls over user photos, not app chrome. Flipping
  // it would make them invisible on light images.
  overlay: "rgba(0,0,0,0.6)",
  onOverlay: "#FFFFFF",
};
