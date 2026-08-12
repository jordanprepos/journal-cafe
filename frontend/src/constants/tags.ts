// Tag vocabulary shared by the café form (which offers these as one-tap chips)
// and the journal filter row (which renders whatever tags are actually in use).

export const PRESET_TAGS = [
  "Cozy",
  "Work-Friendly",
  "Free Wifi",
  "No Wifi",
  "Instagram-able",
  "Non Smokers Only",
  "Smokers Room",
  "Clean",
] as const;

/** Matches the `tags` list cap in `isValidCafe` (firestore.rules). Raising it
 *  here alone makes writes fail the rules, which surfaces as a *permission*
 *  error rather than a validation one — change both, then redeploy the rules. */
export const MAX_TAGS = 20;

const MAX_TAG_LENGTH = 24;

/** Trim, collapse inner whitespace, and cap length. */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, MAX_TAG_LENGTH);
}

/**
 * Append `raw` unless it's empty or already present. The comparison is
 * case-insensitive on purpose: "free wifi" and "Free Wifi" would otherwise
 * become two entries that render as two identical-looking filter chips
 * selecting disjoint sets of cafés.
 */
export function addTag(list: string[], raw: string): string[] {
  const tag = normalizeTag(raw);
  if (!tag) return list;
  if (list.some((t) => t.toLowerCase() === tag.toLowerCase())) return list;
  if (list.length >= MAX_TAGS) return list;
  return [...list, tag];
}

export function hasTag(list: string[], tag: string): boolean {
  return list.some((t) => t.toLowerCase() === tag.toLowerCase());
}

export function removeTag(list: string[], tag: string): string[] {
  return list.filter((t) => t.toLowerCase() !== tag.toLowerCase());
}
