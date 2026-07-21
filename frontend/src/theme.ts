export const COLORS = {
  // Warm paper canvas the whole app sits on.
  background: "#FBF6EC",
  surface: "#FFFFFF",
  // Chip / track / photo-placeholder fills, lightest to warmest.
  surfaceSecondary: "#EFE6D8",
  surfaceSunken: "#F3EAD9",
  inputSurface: "#FFFDF9",

  primary: "#B85C38",
  primaryDark: "#9C4A2E",
  primaryMuted: "#E2C2B3",

  textPrimary: "#3E2A1F",
  textSecondary: "#7A6B5C",
  // Eyebrows, field labels, captions — the quietest tier.
  textMuted: "#9C8F82",

  border: "#EFE6D8",
  borderSubtle: "#F3EAD9",
  borderDashed: "#D7C4B1",

  success: "#5C7C59",
  error: "#A94442",
  star: "#D4A373",
};

export const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const RADII = {
  polaroid: 4,
  card: 20,
  cardLarge: 24,
  pill: 999,
};

export const FONTS = {
  serif: "SourceSerif4_700Bold",
  serifSemi: "SourceSerif4_600SemiBold",
  sans: "Inter_400Regular",
  sansMedium: "Inter_500Medium",
  sansSemi: "Inter_600SemiBold",
  sansBold: "Inter_700Bold",
};

// Elevation presets. RN needs shadow* on iOS/web and elevation on Android, so
// these are spread into styles rather than repeated at every call site.
export const SHADOWS = {
  // Resting cards — barely-there lift off the paper.
  card: {
    shadowColor: "#3E2A1F",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  // Polaroid journal tiles — the pronounced drop that sells the print look.
  polaroid: {
    shadowColor: "#3E2A1F",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  // Floating pill tab bar.
  floating: {
    shadowColor: "#3E2A1F",
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  // Primary-tinted glow under the add button.
  accent: {
    shadowColor: "#B85C38",
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
};
