import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { geocodeAddress } from "@/src/utils/geocode";
import {
  FONTS,
  RADII,
  themedStyles,
  useTheme,
  useThemedStyles,
  useThemeMode,
  type Theme,
  type ThemeMode,
} from "@/src/theme";

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: any }[] = [
  { mode: "light", label: "Light", icon: "sunny-outline" },
  { mode: "dark", label: "Dark", icon: "moon-outline" },
  { mode: "system", label: "System", icon: "phone-portrait-outline" },
];

export default function Profile() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { mode, setMode } = useThemeMode();
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState("");

  async function handleLogout() {
    await logout();
    router.replace("/(auth)/login");
  }

  // Geocode every café that has an address but no coordinates yet (i.e. logged
  // before location support), and save the results. Sequential + throttled so
  // the native geocoder doesn't rate-limit us.
  async function backfillLocations() {
    setBackfillMsg("");
    if (Platform.OS === "web") {
      setBackfillMsg("Location lookup isn't available on web — use the mobile app.");
      return;
    }
    setBackfilling(true);
    try {
      const cafes = await api.listCafes();
      const targets = cafes.filter(
        (c) => (c.latitude == null || c.longitude == null) && c.address.trim(),
      );
      if (targets.length === 0) {
        setBackfillMsg("Nothing to backfill — every café with an address already has a location.");
        return;
      }
      let updated = 0;
      for (const c of targets) {
        const geo = await geocodeAddress(c.address);
        if (geo) {
          await api.updateCafe(c.id, { latitude: geo.lat, longitude: geo.lng });
          updated += 1;
        }
        await new Promise((r) => setTimeout(r, 250)); // be gentle on the geocoder
      }
      const missed = targets.length - updated;
      setBackfillMsg(
        `Added a location to ${updated} of ${targets.length} café${targets.length === 1 ? "" : "s"}.` +
          (missed > 0 ? ` ${missed} couldn't be resolved — try a more specific address.` : ""),
      );
    } catch {
      setBackfillMsg("Something went wrong. Please try again.");
    } finally {
      setBackfilling(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        <Text style={styles.eyebrow}>Account</Text>
        <Text style={styles.title}>Profile</Text>

        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name?.[0]?.toUpperCase() || "?"}
            </Text>
          </View>
          <Text style={styles.name} testID="profile-name">
            {user?.name}
          </Text>
          <Text style={styles.email} testID="profile-email">
            {user?.email}
          </Text>
        </View>

        <View style={styles.toolCard}>
          <View style={styles.toolHeader}>
            <Ionicons name="contrast-outline" size={22} color={colors.primary} />
            <Text style={styles.toolTitle}>Appearance</Text>
          </View>
          <View style={styles.segmented}>
            {THEME_OPTIONS.map((opt) => {
              const on = mode === opt.mode;
              return (
                <TouchableOpacity
                  key={opt.mode}
                  style={[styles.segment, on && styles.segmentOn]}
                  onPress={() => setMode(opt.mode)}
                  testID={`theme-mode-${opt.mode}`}
                >
                  <Ionicons
                    name={opt.icon}
                    size={15}
                    color={on ? colors.onInverseSurface : colors.textSecondary}
                  />
                  <Text style={[styles.segmentText, on && styles.segmentTextOn]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.toolCard}>
          <View style={styles.toolHeader}>
            <Ionicons name="navigate-circle-outline" size={22} color={colors.primary} />
            <Text style={styles.toolTitle}>Café locations</Text>
          </View>
          <Text style={styles.toolDesc}>
            Fill in map coordinates for cafés you logged before location support, using
            their address. Powers “Nearby” sorting.
          </Text>
          <TouchableOpacity
            style={[styles.toolBtn, backfilling && styles.toolBtnDisabled]}
            onPress={backfillLocations}
            disabled={backfilling}
            testID="backfill-locations-button"
          >
            {backfilling ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Ionicons name="sync-outline" size={18} color={colors.onPrimary} />
            )}
            <Text style={styles.toolBtnText}>
              {backfilling ? "Finding locations…" : "Backfill locations"}
            </Text>
          </TouchableOpacity>
          {backfillMsg ? (
            <Text style={styles.toolMsg} testID="backfill-result">
              {backfillMsg}
            </Text>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          testID="logout-button"
        >
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = themedStyles(({ colors, shadows, raisedOutline }: Theme) => ({
  container: { flex: 1, backgroundColor: colors.background },
  eyebrow: {
    fontFamily: FONTS.sans,
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: 5,
  },
  title: {
    fontFamily: FONTS.serif,
    fontSize: 32,
    color: colors.textPrimary,
    marginBottom: 18,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: RADII.cardLarge,
    padding: 24,
    alignItems: "center",
    gap: 6,
    ...shadows.card,
    ...raisedOutline,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  avatarText: { fontFamily: FONTS.sansBold, fontSize: 30, color: colors.onPrimary },
  name: {
    fontFamily: FONTS.serif,
    fontSize: 22,
    color: colors.textPrimary,
  },
  email: { fontFamily: FONTS.sans, color: colors.textMuted, fontSize: 14 },
  toolCard: {
    marginTop: 16,
    backgroundColor: colors.surface,
    borderRadius: RADII.card,
    padding: 20,
    gap: 12,
    ...shadows.card,
    ...raisedOutline,
  },
  toolHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  toolTitle: {
    fontFamily: FONTS.serif,
    fontSize: 18,
    color: colors.textPrimary,
  },
  toolDesc: { fontFamily: FONTS.sans, color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  toolBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: RADII.pill,
    paddingVertical: 14,
  },
  toolBtnDisabled: { opacity: 0.6 },
  toolBtnText: { fontFamily: FONTS.sansSemi, color: colors.onPrimary, fontSize: 14 },
  toolMsg: { fontFamily: FONTS.sans, color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  // Reuses the journal's chip language so all three chip systems in the app
  // (sort, tag filter, this) read as one family.
  segmented: { flexDirection: "row", gap: 8 },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    borderRadius: RADII.pill,
    backgroundColor: colors.surfaceSecondary,
  },
  segmentOn: { backgroundColor: colors.inverseSurface },
  segmentText: { fontFamily: FONTS.sansSemi, fontSize: 11, color: colors.textSecondary },
  segmentTextOn: { color: colors.onInverseSurface },
  logoutBtn: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: colors.error,
  },
  logoutText: { fontFamily: FONTS.sansSemi, color: colors.error, fontSize: 15 },
}));
