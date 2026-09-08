/**
 * Date-range helpers for the Journal filter.
 *
 * Everything here works on `visited_date`, which is a plain user-typed string
 * with no validation behind it — a café can legitimately hold "banana", "2026",
 * or "2026-3-7". Lexical comparison only behaves on zero-padded YYYY-MM-DD
 * ("banana" > "2026-01-01" is true), so every value is shape-checked before it
 * is compared.
 */

export type DatePreset = "month" | "3months" | "year" | "custom";

/** Inclusive bounds. A null bound is open-ended. */
export type DateRange = { from: string | null; to: string | null };

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True only for a zero-padded YYYY-MM-DD naming a real calendar day. */
export function isIsoDay(s: string | undefined): boolean {
  const m = ISO_DAY.exec(s ?? "");
  if (!m) return false;
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  // Rejects 2026-02-31, which Date would silently roll into March.
  return (
    date.getFullYear() === Number(y) &&
    date.getMonth() === Number(mo) - 1 &&
    date.getDate() === Number(d)
  );
}

/**
 * Local calendar day as YYYY-MM-DD. Deliberately not `toISOString().slice(0,10)`
 * — that is UTC, and would name tomorrow for a user at UTC-7 in the evening,
 * while `visited_date` is what the local calendar said that day.
 */
export function localISODay(d: Date): string {
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mo}-${day}`;
}

/**
 * Bounds for a preset, ending today. Each start is built from components with
 * the day pinned to 1, which is overflow-safe — `setMonth(m - 3)` on the 31st
 * lands in the wrong month.
 */
export function presetRange(
  preset: Exclude<DatePreset, "custom">,
  now: Date = new Date()
): DateRange {
  const y = now.getFullYear();
  const m = now.getMonth();
  const start =
    preset === "month"
      ? new Date(y, m, 1)
      : preset === "3months"
        ? new Date(y, m - 2, 1) // this month plus the two before it
        : new Date(y, 0, 1);
  return { from: localISODay(start), to: localISODay(now) };
}

/**
 * Whether a café's `visited_date` falls inside the range. An unparseable or
 * missing date never matches a constrained range — the same call `computeStats`
 * makes when it drops those cafés from `by_month`.
 */
export function matchesDateRange(visited: string | undefined, r: DateRange): boolean {
  if (r.from === null && r.to === null) return true;
  if (!isIsoDay(visited)) return false;
  const v = visited as string;
  if (r.from !== null && v < r.from) return false;
  if (r.to !== null && v > r.to) return false;
  return true;
}

/**
 * "Recent" order for the Journal: the visit you made most recently comes first.
 *
 * Firestore hands the list back ordered by created_at, which is when the entry
 * was *logged* — backfilling last month's café would otherwise park it at the
 * top of the grid. visited_date is unvalidated free text, so anything that
 * isn't a real YYYY-MM-DD sinks to the bottom rather than sorting somewhere
 * arbitrary; created_at (a server ISO timestamp) breaks ties, including
 * between two undated cafés.
 */
export function byVisitedDesc(
  a: { visited_date?: string; created_at: string },
  b: { visited_date?: string; created_at: string }
): number {
  const av = isIsoDay(a.visited_date) ? a.visited_date : null;
  const bv = isIsoDay(b.visited_date) ? b.visited_date : null;
  if (av != null && bv != null && av !== bv) return av < bv ? 1 : -1;
  if (av == null && bv != null) return 1;
  if (bv == null && av != null) return -1;
  return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0;
}
