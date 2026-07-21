// Scheme-invariant design tokens. Kept as plain module constants rather than
// hung off the Theme so the diff stays honest about what actually varies.

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
