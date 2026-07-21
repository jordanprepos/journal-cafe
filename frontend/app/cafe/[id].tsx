import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
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
import { COLORS, FONTS, RADII } from "@/src/theme";

const { width } = Dimensions.get("window");

function Stars({ value }: { value: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= value ? "star" : "star-outline"}
          size={20}
          color={COLORS.star}
        />
      ))}
    </View>
  );
}

export default function CafeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
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
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 80 }} />
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
            <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              onPress={() => router.push(`/cafe/edit/${cafe.id}`)}
              style={styles.iconBtn}
              testID="detail-edit-button"
            >
              <Ionicons name="create-outline" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={confirmDelete}
              style={styles.iconBtn}
              disabled={deleting}
              testID="detail-delete-button"
            >
              <Ionicons name="trash-outline" size={22} color={COLORS.error} />
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
            <Ionicons name="cafe" size={70} color={COLORS.primaryMuted} />
          </View>
        )}

        <View style={styles.body}>
          <Text style={styles.name}>{cafe.name}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 8 }}>
            <Stars value={cafe.rating} />
            <Text style={styles.metaDate}>{cafe.visited_date}</Text>
          </View>

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
              <Ionicons name="map" size={18} color="#fff" />
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
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={COLORS.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
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
    backgroundColor: "rgba(255,255,255,0.9)",
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  coverFallback: {
    backgroundColor: COLORS.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { padding: 22 },
  name: {
    fontSize: 28,
    fontFamily: FONTS.serif,
    color: COLORS.textPrimary,
  },
  metaDate: { fontFamily: FONTS.sans, color: COLORS.textMuted, fontSize: 13 },
  row: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: "center",
  },
  rowLabel: {
    fontFamily: FONTS.sans,
    color: COLORS.textMuted,
    fontSize: 10.5,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  rowValue: { fontFamily: FONTS.sans, color: COLORS.textPrimary, fontSize: 15, marginTop: 2 },
  mapBtn: {
    marginTop: 16,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: RADII.pill,
  },
  mapBtnText: { fontFamily: FONTS.sansSemi, color: "#fff", fontSize: 14 },
  sectionLabel: {
    fontFamily: FONTS.sans,
    color: COLORS.textMuted,
    fontSize: 10.5,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  notes: { fontFamily: FONTS.sans, color: COLORS.textPrimary, fontSize: 15, lineHeight: 24 },
  muted: { fontFamily: FONTS.sans, color: COLORS.textSecondary, textAlign: "center", marginTop: 40 },
});
