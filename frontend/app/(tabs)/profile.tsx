import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import { COLORS, FONTS } from "@/src/theme";

export default function Profile() {
  const { user, logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.replace("/(auth)/login");
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
