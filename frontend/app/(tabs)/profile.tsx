import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { geocodeAddress } from "@/src/utils/geocode";
import { COLORS, FONTS } from "@/src/theme";

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
      <View style={{ padding: 20 }}>
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  eyebrow: {
    color: COLORS.textSecondary,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  title: {
    fontFamily: FONTS.serif,
    fontSize: 36,
    color: COLORS.textPrimary,
    fontWeight: "600",
    marginBottom: 24,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
    alignItems: "center",
    gap: 6,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: { fontSize: 30, color: "#fff", fontWeight: "600" },
  name: {
    fontFamily: FONTS.serif,
    fontSize: 22,
    color: COLORS.textPrimary,
    fontWeight: "600",
  },
  email: { color: COLORS.textSecondary, fontSize: 14 },
  toolCard: {
    marginTop: 24,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    gap: 12,
  },
  toolHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  toolTitle: {
    fontFamily: FONTS.serif,
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  toolDesc: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19 },
  toolBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingVertical: 14,
  },
  toolBtnDisabled: { opacity: 0.6 },
  toolBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  toolMsg: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19 },
  logoutBtn: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  logoutText: { color: COLORS.error, fontWeight: "600", fontSize: 15 },
});
