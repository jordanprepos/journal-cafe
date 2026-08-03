import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

import { useAuth } from "@/src/context/AuthContext";
import {
  FONTS,
  RADII,
  themedStyles,
  useTheme,
  useThemedStyles,
  type Theme,
} from "@/src/theme";

type Props = {
  /** Surfaced by the parent screen's error banner. */
  onError: (message: string) => void;
};

/** "or" divider + Google button, shared by the login and register screens. */
export function GoogleSignInButton({ onError }: Props) {
  const router = useRouter();
  const { loginWithGoogle, googleReady } = useAuth();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [busy, setBusy] = useState(false);

  async function press() {
    onError("");
    setBusy(true);
    try {
      // Resolves false when the user dismisses the sheet — stay put, no error.
      if (await loginWithGoogle()) router.replace("/(tabs)");
    } catch (e: any) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity
        style={[styles.googleBtn, !googleReady && styles.disabled]}
        onPress={press}
        disabled={busy || !googleReady}
        testID="google-signin-button"
      >
        {busy ? (
          <ActivityIndicator color={colors.textPrimary} />
        ) : (
          <>
            <Ionicons name="logo-google" size={18} color={colors.textPrimary} />
            <Text style={styles.googleBtnText}>Continue with Google</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = themedStyles(({ colors }: Theme) => ({
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 24,
    marginBottom: 16,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: colors.textMuted,
    marginHorizontal: 12,
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: RADII.pill,
    paddingVertical: 15,
  },
  googleBtnText: {
    fontFamily: FONTS.sansSemi,
    color: colors.textPrimary,
    fontSize: 15,
  },
  disabled: { opacity: 0.5 },
}));
