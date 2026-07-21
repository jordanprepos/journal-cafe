import type { ThemeMode } from "./palette";

/** Key shared with the inline boot script in app/+html.tsx. */
export const THEME_KEY = "cafe_journal_theme_mode";

// Native has no pre-bundle paint to guard against — the splash screen covers
// the whole gap — so the synchronous mirror is a no-op here. See the .web
// variant for the browser implementation.
export function readSyncPreference(): ThemeMode | null {
  return null;
}

export function writeSyncPreference(_mode: ThemeMode): void {}
