import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api/client";
import { COLORS, FONTS } from "@/src/theme";

interface Stats {
  total_cafes: number;
  average_rating: number;
  top_drink: string;
  five_star_count: number;
  by_month: { month: string; count: number }[];
}

export default function StatsScreen() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const s = await api.stats();
      setStats(s);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const maxMonth = stats ? Math.max(1, ...stats.by_month.map((m) => m.count)) : 1;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        <Text style={styles.eyebrow}>Your coffee year</Text>
        <Text style={styles.title}>Stats</Text>

        {loading || !stats ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.grid}>
              <StatCard
                icon="cafe"
                label="Cafés visited"
                value={String(stats.total_cafes)}
                testID="stat-total"
              />
              <StatCard
                icon="star"
                label="Avg rating"
                value={stats.average_rating.toFixed(1)}
                testID="stat-avg"
              />
              <StatCard
                icon="trophy"
                label="5★ favourites"
                value={String(stats.five_star_count)}
                testID="stat-five"
              />
              <StatCard
                icon="cafe-outline"
                label="Top drink"
                value={stats.top_drink || "—"}
                testID="stat-drink"
              />
            </View>

            <Text style={styles.sectionTitle}>Last 6 months</Text>
            <View style={styles.chartCard}>
              {stats.by_month.length === 0 ? (
                <Text style={styles.muted}>
                  No data yet — start adding visits to see your trends.
                </Text>
              ) : (
                stats.by_month.map((m) => (
                  <View key={m.month} style={styles.barRow}>
                    <Text style={styles.barLabel}>{m.month}</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { width: `${(m.count / maxMonth) * 100}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.barCount}>{m.count}</Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  icon,
  label,
  value,
  testID,
}: {
  icon: any;
  label: string;
  value: string;
  testID: string;
}) {
  return (
    <View style={styles.statCard} testID={testID}>
      <Ionicons name={icon} size={22} color={COLORS.primary} />
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard: {
    flexBasis: "48%",
    flexGrow: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 6,
  },
  statValue: {
    fontSize: 26,
    fontFamily: FONTS.serif,
    color: COLORS.textPrimary,
    fontWeight: "600",
  },
  statLabel: { color: COLORS.textSecondary, fontSize: 12 },
  sectionTitle: {
    marginTop: 32,
    marginBottom: 12,
    fontFamily: FONTS.serif,
    fontSize: 22,
    color: COLORS.textPrimary,
  },
  chartCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 12,
  },
  barRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  barLabel: { width: 64, color: COLORS.textSecondary, fontSize: 12 },
  barTrack: {
    flex: 1,
    backgroundColor: COLORS.surfaceSecondary,
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  barFill: { backgroundColor: COLORS.primary, height: "100%" },
  barCount: { width: 24, textAlign: "right", color: COLORS.textPrimary, fontWeight: "600" },
  muted: { color: COLORS.textSecondary },
});
