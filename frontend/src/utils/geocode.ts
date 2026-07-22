import { Platform } from "react-native";
import * as Location from "expo-location";

// Best-effort forward geocode via the device's native geocoder (no API key,
// no location permission needed). Returns null if it can't resolve the address
// or the native geocoder is unavailable (e.g. on web).
export async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  const addr = address.trim();
  if (Platform.OS === "web" || !addr) return null;
  try {
    const results = await Location.geocodeAsync(addr);
    if (results.length > 0) {
      return { lat: results[0].latitude, lng: results[0].longitude };
    }
  } catch {
    // Native geocoder unavailable, throttled, or address unresolvable.
  }
  return null;
}

/**
 * ISO 3166-1 alpha-2 country for an address, via forward-then-reverse geocode.
 * Null when it can't be resolved (including always on web).
 *
 * Attempted without a permission check on purpose: reverse geocoding works
 * without one on iOS, and on Android it simply fails here when permission is
 * absent — which lands on the caller's fallback rather than a prompt.
 */
export async function countryCodeForAddress(address: string): Promise<string | null> {
  const coords = await geocodeAddress(address);
  if (!coords) return null;
  return reverseCountryCode(coords.lat, coords.lng);
}

/**
 * ISO 3166-1 alpha-2 country for the device's current position.
 *
 * Uses the *non-prompting* permission check, so this never raises a location
 * dialog — it only does anything when permission was already granted elsewhere
 * (the journal's opt-in "Nearby"). Returns null otherwise.
 */
export async function countryCodeForDeviceLocation(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") return null;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low, // a country is all we need
    });
    return reverseCountryCode(pos.coords.latitude, pos.coords.longitude);
  } catch {
    return null;
  }
}

async function reverseCountryCode(lat: number, lng: number): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const places = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const iso = places[0]?.isoCountryCode;
    return iso ? iso.toUpperCase() : null;
  } catch {
    // Reverse geocoder unavailable, throttled, or missing Android permission.
    return null;
  }
}
