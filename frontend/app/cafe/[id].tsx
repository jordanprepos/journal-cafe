import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Dimensions,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, Cafe } from "@/src/api/client";
import { FONTS, RADII, themedStyles, useTheme, useThemedStyles, type Theme } from "@/src/theme";

const { width } = Dimensions.get("window");

function Stars({ value }: { value: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= value ? "star" : "star-outline"}
          size={20}
          color={colors.star}
        />
      ))}
    </View>
  );
}

export default function CafeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [cafe, setCafe] = useState<Cafe | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const c = await api.getCafe(id!);
        setCafe(c);
      } catch (e) {
        console.warn(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function handleDelete() {
    if (!cafe) return;
    setDeleting(true);
    try {
      await api.deleteCafe(cafe.id);
      router.back();
    } catch (e) {
      console.warn(e);
    } finally {
      setDeleting(false);
    }
  }

  function confirmDelete() {
    if (!cafe) return;
    // Alert.alert buttons are a no-op on web — fall back to window.confirm.
    if (Platform.OS === "web") {
      if (window.confirm(`Delete "${cafe.name}"? This can't be undone.`)) {
        handleDelete();
      }
      return;
    }
    Alert.alert("Delete café", `Remove "${cafe.name}" from your journal? This can't be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: handleDelete },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  if (!cafe) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.muted}>Cafe not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.headerBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.iconBtn}
            testID="detail-back-button"
          >
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              onPress={() => router.push(`/cafe/edit/${cafe.id}`)}
              style={styles.iconBtn}
              testID="detail-edit-button"
            >
              <Ionicons name="create-outline" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={confirmDelete}
              style={styles.iconBtn}
              disabled={deleting}
              testID="detail-delete-button"
            >
              <Ionicons name="trash-outline" size={22} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>

        {cafe.photos.length > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={{ height: 280 }}
          >
            {cafe.photos.map((uri, idx) => (
              <Image key={idx} source={{ uri }} style={{ width, height: 280 }} />
            ))}
          </ScrollView>
        ) : (
          <View style={[styles.coverFallback, { width, height: 280 }]}>
            <Ionicons name="cafe" size={70} color={colors.primaryMuted} />
          </View>
        )}

        <View style={styles.body}>
          <Text style={styles.name}>{cafe.name}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 8 }}>
            <Stars value={cafe.rating} />
            <Text style={styles.metaDate}>{cafe.visited_date}</Text>
          </View>

          {(cafe.tags ?? []).length > 0 ? (
            <View style={styles.tagRow} testID="detail-tags">
              {(cafe.tags ?? []).map((t) => (
                <View key={t} style={styles.tagPill}>
                  <Text style={styles.tagPillText}>{t}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {cafe.favorite_drink ? (
            <Row icon="cafe-outline" label="Favourite drink" value={cafe.favorite_drink} />
          ) : null}
          {cafe.address ? (
            <Row icon="location-outline" label="Address" value={cafe.address} />
          ) : null}

          {cafe.location_link ? (
            <TouchableOpacity
              style={styles.mapBtn}
              onPress={() => Linking.openURL(cafe.location_link)}
              testID="detail-open-map"
            >
              <Ionicons name="map" size={18} color={colors.onPrimary} />
              <Text style={styles.mapBtnText}>Open in Google Maps</Text>
            </TouchableOpacity>
          ) : null}

          {cafe.notes ? (
            <View style={{ marginTop: 20 }}>
              <Text style={styles.sectionLabel}>NOTES</Text>
              <Text style={styles.notes}>{cafe.notes}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ icon, label, value }: { icon: any; label: string; value: string }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={colors.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

const makeStyles = themedStyles(({ colors }: Theme) => ({
  container: { flex: 1, backgroundColor: colors.background },
  headerBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  iconBtn: {
    backgroundColor: colors.scrim,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  coverFallback: {
    backgroundColor: colors.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { padding: 22 },
  name: {
    fontSize: 28,
    fontFamily: FONTS.serif,
    color: colors.textPrimary,
  },
  metaDate: { fontFamily: FONTS.sans, color: colors.textMuted, fontSize: 13 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 },
  tagPill: {
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: RADII.pill,
  },
  tagPillText: { fontFamily: FONTS.sans, fontSize: 11, color: colors.textSecondary },
  row: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: "center",
  },
  rowLabel: {
    fontFamily: FONTS.sans,
    color: colors.textMuted,
    fontSize: 10.5,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  rowValue: { fontFamily: FONTS.sans, color: colors.textPrimary, fontSize: 15, marginTop: 2 },
  mapBtn: {
    marginTop: 16,
    backgroundColor: colors.primary,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: RADII.pill,
  },
  mapBtnText: { fontFamily: FONTS.sansSemi, color: colors.onPrimary, fontSize: 14 },
  sectionLabel: {
    fontFamily: FONTS.sans,
    color: colors.textMuted,
    fontSize: 10.5,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  notes: { fontFamily: FONTS.sans, color: colors.textPrimary, fontSize: 15, lineHeight: 24 },
  muted: { fontFamily: FONTS.sans, color: colors.textSecondary, textAlign: "center", marginTop: 40 },
}));
