import { Platform, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Top safe-area inset, with an Android fallback.
 *
 * With edge-to-edge enabled (app.json `android.edgeToEdgeEnabled`), content
 * draws behind the status bar, so any control at the top of the screen must be
 * offset by the status-bar height. On some Android devices — observed on
 * Xiaomi/MIUI under Expo SDK 54 — `react-native-safe-area-context` reports
 * `insets.top === 0` even then, which leaves those controls overlapping the
 * status bar. `StatusBar.currentHeight` reads the real height from Android
 * system resources and rescues that case.
 *
 * `Math.max` means this never makes things worse: when the inset is already
 * correct it wins, and on iOS (where `currentHeight` is undefined) the inset is
 * used unchanged, since it's always reliable there.
 */
export function useSafeTop(): number {
  const insets = useSafeAreaInsets();
  const androidStatusBar = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;
  return Math.max(insets.top, androidStatusBar);
}
