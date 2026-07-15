import { getLocales } from "expo-localization";

/** The device's currency (ISO 4217), used to pre-fill the form. Falls back to
 *  USD when the platform doesn't report one (e.g. some web/emulator setups). */
export function deviceCurrency(): string {
  const code = getLocales()[0]?.currencyCode;
  return code && /^[A-Z]{3}$/.test(code) ? code : "USD";
}

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    // Unknown currency code — fall back to a plain "1234 XYZ".
    return `${amount} ${currency}`;
  }
}

/** Human price label, e.g. "€3 – €6", "from €3", "up to €6".
 *  Returns "" when there's nothing to show. */
export function formatPriceRange(
  min?: number | null,
  max?: number | null,
  currency?: string | null,
): string {
  if (!currency || (min == null && max == null)) return "";
  if (min != null && max != null) {
    return min === max
      ? money(min, currency)
      : `${money(min, currency)} – ${money(max, currency)}`;
  }
  if (min != null) return `from ${money(min, currency)}`;
  return `up to ${money(max as number, currency)}`;
}
