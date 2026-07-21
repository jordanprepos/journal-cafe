import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { useAppFonts } from "@/src/hooks/use-app-fonts";
import { AuthProvider } from "@/src/context/AuthContext";
import { ThemeProvider, type Theme } from "@/src/theme";

SplashScreen.preventAutoHideAsync();

// ThemeProvider sits above the font gate on purpose. Nested inside it, its
// async preference read wouldn't start until fonts had already resolved,
// serialising two waits that should overlap.
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          {({ theme, ready }) => <RootContent theme={theme} themeReady={ready} />}
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootContent({ theme, themeReady }: { theme: Theme; themeReady: boolean }) {
  const [iconsLoaded, iconsError] = useIconFonts();
  const [appFontsLoaded, appFontsError] = useAppFonts();

  // Either family failing shouldn't strand the user on the splash screen —
  // treat "settled" as loaded-or-errored and render with whatever we got.
  const loaded = iconsLoaded && appFontsLoaded;
  const error = iconsError ?? appFontsError;
  const fontsSettled = loaded || error;

  useEffect(() => {
    if (fontsSettled && themeReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsSettled, themeReady]);

  // Colours the native root view — what shows through during screen
  // transitions and behind the translucent status bar on edge-to-edge Android.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.colors.background);
  }, [theme]);

  if (!fontsSettled || !themeReady) return null;

  return (
    <AuthProvider>
      {/* Derived from the resolved scheme, not "auto", so an in-app Light
          override on a dark OS still gets dark status-bar glyphs. */}
      <StatusBar style={theme.scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      />
    </AuthProvider>
  );
}
