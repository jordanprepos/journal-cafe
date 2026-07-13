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
