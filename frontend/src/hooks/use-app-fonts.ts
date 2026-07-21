// Brand typefaces: Source Serif 4 for display headings, Inter for everything
// else. Bundled locally by the @expo-google-fonts packages, so unlike the icon
// fonts in use-icon-fonts.ts these need no CDN fetch and work offline.
// Usage: const [loaded, error] = useAppFonts();

import { useFonts } from "expo-font";
import {
  SourceSerif4_600SemiBold,
  SourceSerif4_700Bold,
} from "@expo-google-fonts/source-serif-4";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";

export const useAppFonts = (): readonly [boolean, Error | null] =>
  useFonts({
    SourceSerif4_600SemiBold,
    SourceSerif4_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
