// Builds the URL that "Open in Google Maps" opens for a café.
//
// New cafés no longer store a pasted Maps link — the button runs a Maps search
// for the café's name + address instead. Cafés saved before this change may
// still carry a real pasted link, which we prefer when present.

const SEARCH_BASE = "https://www.google.com/maps/search/?api=1&query=";

/**
 * Google's documented cross-platform search URL: opens the Maps app on device
 * via universal link, and the web app in a browser. `name` alone is enough —
 * a blank address just narrows the query less.
 */
export function googleMapsSearchUrl(name: string, address?: string | null): string {
  const query = [name, address]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return SEARCH_BASE + encodeURIComponent(query);
}

// Only honour a saved link when it's an http(s) URL. This also keeps a stored
// `javascript:` / `file:` string from ever reaching Linking.openURL — the two
// call sites pass it there without their own scheme check.
function isSafeLink(link: string): boolean {
  return /^https?:\/\//i.test(link.trim());
}

/**
 * Prefer a café's saved link when it's a safe http(s) URL; otherwise search by
 * name + address. Since `name` is always present, this always returns a usable
 * URL, so the map button can render unconditionally.
 */
export function cafeMapsUrl(cafe: {
  name: string;
  address: string;
  location_link: string;
}): string {
  if (cafe.location_link && isSafeLink(cafe.location_link)) {
    return cafe.location_link.trim();
  }
  return googleMapsSearchUrl(cafe.name, cafe.address);
}
