import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
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
import { COLORS, FONTS, RADII, SHADOWS } from "@/src/theme";

export default function Profile() {
  const { user, logout } = useAuth();
  const router = useRouter();
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
            <Ionicons name="navigate-circle-outline" size={22} color={COLORS.primary} />
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
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="sync-outline" size={18} color="#fff" />
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
          <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  eyebrow: {
    fontFamily: FONTS.sans,
    color: COLORS.textMuted,
    fontSize: 11,
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: 5,
  },
  title: {
    fontFamily: FONTS.serif,
    fontSize: 32,
    color: COLORS.textPrimary,
    marginBottom: 18,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADII.cardLarge,
    padding: 24,
    alignItems: "center",
    gap: 6,
    ...SHADOWS.card,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  avatarText: { fontFamily: FONTS.sansBold, fontSize: 30, color: "#fff" },
  name: {
    fontFamily: FONTS.serif,
    fontSize: 22,
    color: COLORS.textPrimary,
  },
  email: { fontFamily: FONTS.sans, color: COLORS.textMuted, fontSize: 14 },
  toolCard: {
    marginTop: 16,
    backgroundColor: COLORS.surface,
    borderRadius: RADII.card,
    padding: 20,
    gap: 12,
    ...SHADOWS.card,
  },
  toolHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  toolTitle: {
    fontFamily: FONTS.serif,
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  toolDesc: { fontFamily: FONTS.sans, color: COLORS.textSecondary, fontSize: 13, lineHeight: 19 },
  toolBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: RADII.pill,
    paddingVertical: 14,
  },
  toolBtnDisabled: { opacity: 0.6 },
  toolBtnText: { fontFamily: FONTS.sansSemi, color: "#fff", fontSize: 14 },
  toolMsg: { fontFamily: FONTS.sans, color: COLORS.textMuted, fontSize: 13, lineHeight: 19 },
  logoutBtn: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  logoutText: { fontFamily: FONTS.sansSemi, color: COLORS.error, fontSize: 15 },
});
