import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, Cafe } from "@/src/api/client";
import { cafeMapsUrl } from "@/src/utils/maps";
import { FONTS, RADII, themedStyles, useTheme, useThemedStyles, type Theme } from "@/src/theme";

export default function Places() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const list = await api.listCafes();
      setCafes(list);
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

  const withLocation = cafes.filter((c) => c.location_link || c.address);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Where you&apos;ve been</Text>
        <Text style={styles.title}>Places</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={withLocation}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="map-outline" size={56} color={colors.primaryMuted} />
              <Text style={styles.emptyTitle}>No locations yet</Text>
              <Text style={styles.emptyText}>
                Add a café with an address to pin it here.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push(`/cafe/${item.id}`)}
              testID={`place-row-${item.id}`}
            >
              <View style={styles.pin}>
                <Ionicons name="location" size={22} color={colors.onPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{item.name}</Text>
                {item.address ? (
                  <Text style={styles.rowAddr} numberOfLines={2}>
                    {item.address}
                  </Text>
                ) : null}
                <TouchableOpacity
                  onPress={() => Linking.openURL(cafeMapsUrl(item))}
                  style={styles.openBtn}
                  testID={`open-map-${item.id}`}
                >
                  <Ionicons name="arrow-forward-outline" size={13} color={colors.primary} />
                  <Text style={styles.openBtnText}>Open in Google Maps</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = themedStyles(({ colors, shadows, raisedOutline }: Theme) => ({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
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
  },
  row: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: RADII.card,
    padding: 16,
    marginBottom: 12,
    alignItems: "flex-start",
    ...shadows.card,
    ...raisedOutline,
  },
  pin: {
    backgroundColor: colors.primary,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  rowName: {
    fontFamily: FONTS.sansBold,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  rowAddr: { fontFamily: FONTS.sans, color: colors.textMuted, fontSize: 13, marginBottom: 6 },
  openBtn: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
  openBtnText: { fontFamily: FONTS.sansSemi, color: colors.primary, fontSize: 13 },
  empty: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyTitle: {
    fontSize: 20,
    fontFamily: FONTS.serif,
    color: colors.textPrimary,
    marginTop: 12,
  },
  emptyText: {
    fontFamily: FONTS.sans,
    color: colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 40,
  },
}));
