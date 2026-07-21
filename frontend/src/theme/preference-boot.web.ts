import type { ThemeMode } from "./palette";

/** AsyncStorage key — the source of truth. */
export const THEME_KEY = "cafe_journal_theme_mode";

/**
 * Separate key for the boot mirror, read by the inline script in +html.tsx.
 * It must NOT be THEME_KEY: AsyncStorage on web is localStorage under the
 * hood and writes to that key JSON-encoded, so a raw value written here would
 * be clobbered with a quoted one (`"light"`), which the boot script's plain
 * string comparison would then reject — silently reintroducing the flash.
 */
const BOOT_KEY = "cafe_journal_theme_boot";

const isMode = (v: unknown): v is ThemeMode =>
  v === "light" || v === "dark" || v === "system";

/**
 * AsyncStorage on web is IndexedDB, which is asynchronous and therefore
 * useless for the first paint. This localStorage copy is a boot-time cache
 * only — AsyncStorage remains the source of truth. It lets both the inline
 * script in +html.tsx (which runs before the bundle) and the provider's
 * initial state land on the right scheme with no light-to-dark flash.
 */
export function readSyncPreference(): ThemeMode | null {
  try {
    const v = window.localStorage.getItem(BOOT_KEY);
    return isMode(v) ? v : null;
  } catch {
    return null; // private mode / storage disabled
  }
}

export function writeSyncPreference(mode: ThemeMode): void {
  try {
    window.localStorage.setItem(BOOT_KEY, mode);
    // Keep the <html> attribute in step so the CSS in +html.tsx paints the
    // right body colour on the next reload.
    const root = document.documentElement;
    if (mode === "system") delete root.dataset.theme;
    else root.dataset.theme = mode;
  } catch {
    // Non-fatal: we just lose the no-flash optimisation.
  }
}
