import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { api, Cafe } from "@/src/api/client";
import { COLORS, FONTS } from "@/src/theme";
import { distanceKm, formatDistance } from "@/src/utils/distance";

type SortMode = "recent" | "nearby";
type CafeWithDistance = Cafe & { _distanceKm?: number };

function Stars({ value }: { value: number }) {
  return (
    <View style={{ flexDirection: "row" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= value ? "star" : "star-outline"}
          size={14}
          color={COLORS.star}
        />
      ))}
    </View>
  );
}

export default function Journal() {
  const router = useRouter();
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState("");

  const load = useCallback(async () => {
    try {
      const list = await api.listCafes();
      setCafes(list);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Opt-in: only prompt for GPS when the user taps "Nearby".
  async function enableNearby() {
    setLocError("");
    if (coords) {
      setSortMode("nearby");
      return;
    }
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocError("Location permission denied — showing most recent instead.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setSortMode("nearby");
    } catch {
      setLocError("Couldn't get your location — showing most recent instead.");
    } finally {
      setLocating(false);
    }
  }

  const visible: CafeWithDistance[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = cafes.filter((c) => {
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.favorite_drink.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q)
      );
    });

    if (sortMode !== "nearby" || !coords) return matched;

    // Attach distance where coordinates exist; cafés without coords sink last.
    const withDist: CafeWithDistance[] = matched.map((c) => ({
      ...c,
      _distanceKm:
        c.latitude != null && c.longitude != null
          ? distanceKm(coords.lat, coords.lng, c.latitude, c.longitude)
          : undefined,
    }));
    return withDist.sort((a, b) => {
      if (a._distanceKm == null && b._distanceKm == null) return 0;
      if (a._distanceKm == null) return 1;
      if (b._distanceKm == null) return -1;
      return a._distanceKm - b._distanceKm;
    });
  }, [cafes, query, sortMode, coords]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Your café diary</Text>
          <Text style={styles.title}>Journal</Text>
        </View>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push("/cafe/new")}
          testID="add-cafe-button"
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={COLORS.textSecondary} />
        <TextInput
          style={styles.search}
          placeholder="Search cafes, drinks, places…"
          placeholderTextColor={COLORS.textSecondary}
          value={query}
          onChangeText={setQuery}
          testID="search-input"
        />
      </View>

      <View style={styles.sortRow}>
        <TouchableOpacity
          style={[styles.sortPill, sortMode === "recent" && styles.sortPillActive]}
          onPress={() => setSortMode("recent")}
          testID="sort-recent"
        >
          <Ionicons
            name="time-outline"
            size={15}
            color={sortMode === "recent" ? "#fff" : COLORS.textSecondary}
          />
          <Text style={[styles.sortText, sortMode === "recent" && styles.sortTextActive]}>
            Recent
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortPill, sortMode === "nearby" && styles.sortPillActive]}
          onPress={enableNearby}
          disabled={locating}
          testID="sort-nearby"
        >
          {locating ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Ionicons
              name="navigate-outline"
              size={15}
              color={sortMode === "nearby" ? "#fff" : COLORS.textSecondary}
            />
          )}
          <Text style={[styles.sortText, sortMode === "nearby" && styles.sortTextActive]}>
            Nearby
          </Text>
        </TouchableOpacity>
      </View>

      {locError ? (
        <Text style={styles.locError} testID="location-error">
          {locError}
        </Text>
      ) : null}

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty} testID="empty-state">
              <Ionicons name="cafe-outline" size={56} color={COLORS.primaryMuted} />
              <Text style={styles.emptyTitle}>No cafés logged yet</Text>
              <Text style={styles.emptyText}>
                Tap + to add your first café visit.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/cafe/${item.id}`)}
              testID={`cafe-card-${item.id}`}
            >
              {item.photos.length > 0 ? (
                <Image source={{ uri: item.photos[0] }} style={styles.cardImage} />
              ) : (
                <View style={[styles.cardImage, styles.imgPlaceholder]}>
                  <Ionicons name="cafe" size={40} color={COLORS.primaryMuted} />
                </View>
              )}
              <View style={styles.cardBody}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Stars value={item.rating} />
                  <Text style={styles.cardMeta}>
                    {item.visited_date || item.created_at.slice(0, 10)}
                  </Text>
                  {item._distanceKm != null ? (
                    <View style={styles.distBadge} testID={`cafe-distance-${item.id}`}>
                      <Ionicons name="navigate" size={11} color={COLORS.primary} />
                      <Text style={styles.distText}>{formatDistance(item._distanceKm)}</Text>
                    </View>
                  ) : null}
                </View>
                {item.favorite_drink ? (
                  <Text style={styles.cardDrink} numberOfLines={1}>
                    ☕ {item.favorite_drink}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
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
  },
  fab: {
    backgroundColor: COLORS.primary,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  searchWrap: {
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  search: { flex: 1, color: COLORS.textPrimary, fontSize: 15 },
  sortRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, marginBottom: 8 },
  sortPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  sortPillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  sortText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: "600" },
  sortTextActive: { color: "#fff" },
  locError: {
    color: COLORS.textSecondary,
    fontSize: 12,
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  distBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: COLORS.surfaceSecondary,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  distText: { color: COLORS.primary, fontSize: 11, fontWeight: "700" },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 18,
    overflow: "hidden",
  },
  cardImage: { width: "100%", height: 200, backgroundColor: COLORS.surfaceSecondary },
  imgPlaceholder: { alignItems: "center", justifyContent: "center" },
  cardBody: { padding: 16, gap: 6 },
  cardName: {
    fontSize: 20,
    fontWeight: "600",
    fontFamily: FONTS.serif,
    color: COLORS.textPrimary,
  },
  cardMeta: { fontSize: 12, color: COLORS.textSecondary },
  cardDrink: { fontSize: 14, color: COLORS.textSecondary, marginTop: 2 },
  empty: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyTitle: {
    fontSize: 20,
    fontFamily: FONTS.serif,
    color: COLORS.textPrimary,
    marginTop: 12,
  },
  emptyText: { color: COLORS.textSecondary, textAlign: "center", paddingHorizontal: 40 },
});
