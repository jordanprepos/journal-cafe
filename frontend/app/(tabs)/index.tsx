import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  RefreshControl,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { api, Cafe } from "@/src/api/client";
import { COLORS, FONTS, RADII, SHADOWS } from "@/src/theme";
import { distanceKm, formatDistance } from "@/src/utils/distance";

type SortMode = "recent" | "nearby";
type CafeWithDistance = Cafe & { _distanceKm?: number };
// Padding entry for an odd-length grid — without it the trailing polaroid
// flexes to the full row width instead of staying a column wide.
type GridItem = CafeWithDistance | { id: string; _spacer: true };

const isSpacer = (item: GridItem): item is { id: string; _spacer: true } =>
  "_spacer" in item;

/**
 * Tags to show on a polaroid. Capped at two so a heavily-tagged café doesn't
 * grow its tile out of the grid; the active filter is sorted first so the
 * reason a card matched is always the one you can see.
 */
const CARD_TAG_LIMIT = 2;
function cardTags(tags: string[] | undefined, activeTag: string | null): string[] {
  const list = tags ?? [];
  if (!activeTag) return list.slice(0, CARD_TAG_LIMIT);
  const matched = list.filter((t) => t.toLowerCase() === activeTag.toLowerCase());
  const rest = list.filter((t) => t.toLowerCase() !== activeTag.toLowerCase());
  return [...matched, ...rest].slice(0, CARD_TAG_LIMIT);
}

// Scatter angles for the polaroid tiles, cycled by index so the grid reads as
// a hand-laid page rather than a uniform grid.
const TILT = ["-1.5deg", "1.5deg", "1deg", "-1deg"];

function Stars({ value, size = 11 }: { value: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= value ? "star" : "star-outline"}
          size={size}
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
  const [activeTag, setActiveTag] = useState<string | null>(null);

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

  // Only offer filters for tags that are actually in use — a chip for a tag
  // nobody has applied is dead UI. Keeps first-seen casing.
  const availableTags = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of cafes) {
      for (const t of c.tags ?? []) {
        if (!seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t);
      }
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  }, [cafes]);

  // Deleting the last café carrying the active tag would otherwise leave the
  // grid permanently empty with no chip left to tap to undo it.
  useEffect(() => {
    if (activeTag && !availableTags.some((t) => t.toLowerCase() === activeTag.toLowerCase())) {
      setActiveTag(null);
    }
  }, [activeTag, availableTags]);

  const visible: CafeWithDistance[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = cafes.filter((c) => {
      const tags = c.tags ?? [];
      if (activeTag && !tags.some((t) => t.toLowerCase() === activeTag.toLowerCase())) {
        return false;
      }
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.favorite_drink.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        tags.some((t) => t.toLowerCase().includes(q))
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
  }, [cafes, query, activeTag, sortMode, coords]);

  const gridData: GridItem[] = useMemo(
    () =>
      visible.length % 2 === 1
        ? [...visible, { id: "__spacer__", _spacer: true as const }]
        : visible,
    [visible]
  );

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
        <Ionicons name="search" size={18} color={COLORS.textMuted} />
        <TextInput
          style={styles.search}
          placeholder="Search cafes, drinks, places…"
          placeholderTextColor={COLORS.textMuted}
          value={query}
          onChangeText={setQuery}
          testID="search-input"
        />
      </View>

      <View style={styles.sortRow}>
        <TouchableOpacity
          style={[styles.chip, sortMode === "recent" && styles.chipActive]}
          onPress={() => setSortMode("recent")}
          testID="sort-recent"
        >
          <Ionicons
            name="time-outline"
            size={13}
            color={sortMode === "recent" ? COLORS.background : COLORS.textSecondary}
          />
          <Text style={[styles.chipText, sortMode === "recent" && styles.chipTextActive]}>
            Recent
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chip, sortMode === "nearby" && styles.chipActive]}
          onPress={enableNearby}
          disabled={locating}
          testID="sort-nearby"
        >
          {locating ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Ionicons
              name="navigate-outline"
              size={13}
              color={sortMode === "nearby" ? COLORS.background : COLORS.textSecondary}
            />
          )}
          <Text style={[styles.chipText, sortMode === "nearby" && styles.chipTextActive]}>
            Nearby
          </Text>
        </TouchableOpacity>
      </View>

      {availableTags.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tagRow}
          contentContainerStyle={styles.tagRowContent}
        >
          <TouchableOpacity
            style={[styles.chip, activeTag === null && styles.chipActive]}
            onPress={() => setActiveTag(null)}
            testID="tag-filter-all"
          >
            <Text style={[styles.chipText, activeTag === null && styles.chipTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          {availableTags.map((t) => {
            const on = activeTag?.toLowerCase() === t.toLowerCase();
            return (
              <TouchableOpacity
                key={t}
                style={[styles.chip, on && styles.chipActive]}
                onPress={() => setActiveTag(on ? null : t)}
                testID={`tag-filter-${t.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <Text style={[styles.chipText, on && styles.chipTextActive]}>{t}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}

      {locError ? (
        <Text style={styles.locError} testID="location-error">
          {locError}
        </Text>
      ) : null}

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={gridData}
          key="polaroid-grid"
          numColumns={2}
          keyExtractor={(item) => item.id}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.grid}
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
          renderItem={({ item, index }) =>
            isSpacer(item) ? (
              <View style={{ flex: 1 }} />
            ) : (
            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.polaroid,
                { transform: [{ rotate: TILT[index % TILT.length] }] },
                // Offset the right-hand column so the two columns interleave.
                index % 2 === 1 && styles.polaroidOffset,
              ]}
              onPress={() => router.push(`/cafe/${item.id}`)}
              testID={`cafe-card-${item.id}`}
            >
              {item.photos.length > 0 ? (
                <Image source={{ uri: item.photos[0] }} style={styles.photo} />
              ) : (
                <View style={[styles.photo, styles.photoPlaceholder]}>
                  <Ionicons name="cafe" size={32} color={COLORS.primaryMuted} />
                </View>
              )}
              <Text style={styles.cardName} numberOfLines={1}>
                {item.name}
              </Text>
              <Stars value={item.rating} />
              <View style={styles.cardMetaRow}>
                {item.favorite_drink ? (
                  <View style={styles.tag}>
                    <Text style={styles.tagText} numberOfLines={1}>
                      {item.favorite_drink}
                    </Text>
                  </View>
                ) : null}
                {cardTags(item.tags, activeTag).map((t) => (
                  <View key={t} style={styles.tagOutline}>
                    <Text style={styles.tagOutlineText} numberOfLines={1}>
                      {t}
                    </Text>
                  </View>
                ))}
                {item._distanceKm != null ? (
                  <View style={styles.distBadge} testID={`cafe-distance-${item.id}`}>
                    <Ionicons name="navigate" size={9} color={COLORS.primary} />
                    <Text style={styles.distText}>{formatDistance(item._distanceKm)}</Text>
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
            )
          }
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
    paddingBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
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
    fontSize: 34,
    color: COLORS.textPrimary,
  },
  fab: {
    backgroundColor: COLORS.primary,
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.accent,
  },
  searchWrap: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: COLORS.surface,
    borderRadius: RADII.pill,
    paddingHorizontal: 16,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    ...SHADOWS.card,
  },
  search: { flex: 1, fontFamily: FONTS.sans, color: COLORS.textPrimary, fontSize: 14 },
  sortRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, marginBottom: 8 },
  tagRow: { flexGrow: 0, marginBottom: 8 },
  tagRowContent: { paddingHorizontal: 20, gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.surfaceSecondary,
  },
  chipActive: { backgroundColor: COLORS.textPrimary },
  chipText: { fontFamily: FONTS.sansSemi, color: COLORS.textSecondary, fontSize: 11 },
  chipTextActive: { color: COLORS.background },
  locError: {
    fontFamily: FONTS.sans,
    color: COLORS.textMuted,
    fontSize: 12,
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  grid: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 120 },
  gridRow: { gap: 16 },
  polaroid: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADII.polaroid,
    paddingHorizontal: 9,
    paddingTop: 9,
    paddingBottom: 12,
    marginBottom: 16,
    ...SHADOWS.polaroid,
  },
  polaroidOffset: { marginTop: 20 },
  photo: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: COLORS.surfaceSunken,
  },
  photoPlaceholder: { alignItems: "center", justifyContent: "center" },
  cardName: {
    fontFamily: FONTS.serif,
    fontSize: 14,
    color: COLORS.textPrimary,
    marginTop: 8,
    marginBottom: 2,
  },
  cardMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 },
  tag: {
    backgroundColor: COLORS.surfaceSecondary,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADII.pill,
    flexShrink: 1,
  },
  tagText: { fontFamily: FONTS.sansMedium, color: COLORS.textSecondary, fontSize: 9 },
  // Outlined rather than filled so tags stay distinguishable from the drink
  // chip at 9px, where the two would otherwise read as one run of pills.
  tagOutline: {
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: RADII.pill,
    flexShrink: 1,
  },
  tagOutlineText: { fontFamily: FONTS.sansMedium, color: COLORS.textMuted, fontSize: 9 },
  distBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: COLORS.surfaceSecondary,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADII.pill,
  },
  distText: { fontFamily: FONTS.sansBold, color: COLORS.primary, fontSize: 9 },
  empty: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyTitle: {
    fontFamily: FONTS.serif,
    fontSize: 20,
    color: COLORS.textPrimary,
    marginTop: 12,
  },
  emptyText: {
    fontFamily: FONTS.sans,
    color: COLORS.textSecondary,
    textAlign: "center",
    paddingHorizontal: 40,
  },
});
