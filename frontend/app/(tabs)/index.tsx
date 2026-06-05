import { useCallback, useState } from "react";
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
import { api, Cafe } from "@/src/api/client";
import { COLORS, FONTS } from "@/src/theme";

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

  const filtered = cafes.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.favorite_drink.toLowerCase().includes(q) ||
      c.address.toLowerCase().includes(q)
    );
  });

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

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
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
