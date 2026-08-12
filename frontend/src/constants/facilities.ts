import { Ionicons } from "@expo/vector-icons";

// Single source of truth for facility chips (form, detail view, feed filter).
// Nothing validates these keys server-side: `isValidCafe` in firestore.rules
// only checks that `facilities` is a list of at most 20 entries, so the
// vocabulary is whatever this file says it is.
//
// Keys are persisted verbatim in café documents, so renaming or removing one
// orphans the value in every café already saved with it. `facilityMeta` returns
// undefined for keys it doesn't recognise so those cafés render without the
// chip instead of crashing — but the stored data is not migrated. Prefer adding
// a new key over repurposing an existing one.
export const FACILITIES = [
  { key: "indoor", label: "Indoor", icon: "home-outline" },
  { key: "outdoor", label: "Outdoor", icon: "leaf-outline" },
  { key: "wifi", label: "Wi-Fi", icon: "wifi-outline" },
  { key: "smoking_allowed", label: "Smoking/vape OK", icon: "flame-outline" },
  { key: "power_outlets", label: "Power outlets", icon: "flash-outline" },
  { key: "parking", label: "Parking", icon: "car-outline" },
  { key: "restroom", label: "Restroom", icon: "water-outline" },
  { key: "air_conditioning", label: "Air conditioning", icon: "snow-outline" },
  { key: "pet_friendly", label: "Pet friendly", icon: "paw-outline" },
] as const satisfies readonly {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[];

export type Facility = (typeof FACILITIES)[number]["key"];

const BY_KEY = new Map(FACILITIES.map((f) => [f.key as string, f]));

/** Look up a facility's label/icon. Returns undefined for unknown keys (e.g. a
 *  value stored by a newer client), so callers can skip rather than crash. */
export function facilityMeta(key: string) {
  return BY_KEY.get(key);
}
