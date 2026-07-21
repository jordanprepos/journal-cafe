import type { ViewStyle } from "react-native";
import type { ColorScheme, Palette } from "./palette";

export type Shadows = {
  card: ViewStyle;
  polaroid: ViewStyle;
  floating: ViewStyle;
  accent: ViewStyle;
};

/**
 * Elevation presets. RN wants shadow* on iOS/web and elevation on Android, so
 * these get spread into styles rather than repeated at every call site.
 *
 * Shadows are scheme-dependent, which is easy to miss: a warm-brown shadow on
 * a near-black canvas is invisible. Dark switches to black and leans harder on
 * opacity — but only so far, because past a point you get mud rather than
 * depth. In dark, most of the separation actually comes from `surface` being
 * genuinely lighter than `background`, plus Theme.raisedOutline.
 */
export const makeShadows = (p: Palette, scheme: ColorScheme): Shadows => {
  const base = scheme === "dark" ? "#000000" : "#3E2A1F";
  const k = scheme === "dark" ? 2.8 : 1;
  return {
    card: {
      shadowColor: base,
      shadowOpacity: 0.05 * k,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    polaroid: {
      shadowColor: base,
      shadowOpacity: 0.16 * k,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    floating: {
      shadowColor: base,
      shadowOpacity: 0.14 * k,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 6 },
      elevation: 10,
    },
    // Tracks the palette's primary so it follows the lifted dark terracotta.
    accent: {
      shadowColor: p.primary,
      shadowOpacity: scheme === "dark" ? 0.3 : 0.35,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
  };
};
