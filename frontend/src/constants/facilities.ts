import { Ionicons } from "@expo/vector-icons";

// Single source of truth for facility chips (form, detail view, feed filter).
// MUST stay in sync with the `Facility` enum in backend/server.py — a key that
// doesn't exist server-side will 422 on save.
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
