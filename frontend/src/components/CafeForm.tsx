import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { CafeInput, Cafe } from "@/src/api/client";
import { geocodeAddress } from "@/src/utils/geocode";
import { COLORS, FONTS } from "@/src/theme";

interface Props {
  title: string;
  initial?: Cafe;
  onSave: (data: CafeInput) => Promise<void>;
  saving: boolean;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function CafeForm({ title, initial, onSave, saving }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [photos, setPhotos] = useState<string[]>(initial?.photos ?? []);
  const [locationLink, setLocationLink] = useState(initial?.location_link ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [favoriteDrink, setFavoriteDrink] = useState(initial?.favorite_drink ?? "");
  const [visitedDate, setVisitedDate] = useState(initial?.visited_date || todayISO());
  const [error, setError] = useState("");

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Photo access permission denied.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      base64: true,
      allowsMultipleSelection: false,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      const uri = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setPhotos((p) => [...p, uri]);
    }
  }

  function removePhoto(idx: number) {
    setPhotos((p) => p.filter((_, i) => i !== idx));
  }

  async function submit() {
    setError("");
    if (!name.trim()) {
      setError("Please give your café a name.");
      return;
    }
    try {
      const addr = address.trim();
      // Keep any coords from a previous save; only overwrite on a successful lookup.
      let latitude: number | null = initial?.latitude ?? null;
      let longitude: number | null = initial?.longitude ?? null;
      if (addr) {
        const geo = await geocodeAddress(addr);
        if (geo) {
          latitude = geo.lat;
          longitude = geo.lng;
        }
      }
      await onSave({
        name: name.trim(),
        photos,
        location_link: locationLink.trim(),
        address: addr,
        notes: notes.trim(),
        rating,
        favorite_drink: favoriteDrink.trim(),
        visited_date: visitedDate.trim() || todayISO(),
        latitude,
        longitude,
      });
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.iconBtn}
            testID="form-back-button"
          >
            <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >
          {error ? (
            <Text style={styles.error} testID="form-error">
              {error}
            </Text>
          ) : null}

          <Label>Photos</Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {photos.map((uri, idx) => (
                <View key={idx} style={styles.thumb}>
                  <Image source={{ uri }} style={styles.thumbImg} />
                  <TouchableOpacity
                    style={styles.thumbX}
                    onPress={() => removePhoto(idx)}
                    testID={`remove-photo-${idx}`}
                  >
                    <Ionicons name="close" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                onPress={pickPhoto}
                style={[styles.thumb, styles.thumbAdd]}
                testID="add-photo-button"
              >
                <Ionicons name="camera" size={26} color={COLORS.primary} />
                <Text style={styles.thumbAddText}>Add</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <Label>Café name</Label>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Blue Bottle Coffee"
            placeholderTextColor={COLORS.textSecondary}
            testID="form-name-input"
          />

          <Label>Google Maps share link</Label>
          <TextInput
            style={styles.input}
            value={locationLink}
            onChangeText={setLocationLink}
            placeholder="Paste link from Google Maps app"
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="none"
            testID="form-location-input"
          />

          <Label>Address / area (optional)</Label>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="e.g. Brooklyn, NY"
            placeholderTextColor={COLORS.textSecondary}
            testID="form-address-input"
          />
          <Text style={styles.caption}>
            Used to place your café on the map for “Nearby” sorting.
          </Text>

          <Label>Favourite drink</Label>
          <TextInput
            style={styles.input}
            value={favoriteDrink}
            onChangeText={setFavoriteDrink}
            placeholder="e.g. Iced oat latte"
            placeholderTextColor={COLORS.textSecondary}
            testID="form-drink-input"
          />

          <Label>Visited date</Label>
          <TextInput
            style={styles.input}
            value={visitedDate}
            onChangeText={setVisitedDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={COLORS.textSecondary}
            testID="form-date-input"
          />

          <Label>Rating</Label>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((i) => (
              <TouchableOpacity
                key={i}
                onPress={() => setRating(i === rating ? 0 : i)}
                testID={`form-rating-${i}`}
              >
                <Ionicons
                  name={i <= rating ? "star" : "star-outline"}
                  size={36}
                  color={COLORS.star}
                />
              </TouchableOpacity>
            ))}
          </View>

          <Label>Notes</Label>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Vibe, music, who you were with…"
            placeholderTextColor={COLORS.textSecondary}
            multiline
            textAlignVertical="top"
            testID="form-notes-input"
          />

          <TouchableOpacity
            style={styles.saveBtn}
            onPress={submit}
            disabled={saving}
            testID="form-save-button"
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerTitle: {
    fontFamily: FONTS.serif,
    fontSize: 22,
    color: COLORS.textPrimary,
    fontWeight: "600",
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  label: {
    color: COLORS.textSecondary,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  multiline: { minHeight: 110, paddingTop: 12 },
  caption: { color: COLORS.textSecondary, fontSize: 12, marginTop: 6 },
  starsRow: { flexDirection: "row", gap: 6, marginVertical: 4 },
  thumb: {
    width: 96,
    height: 96,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceSecondary,
    overflow: "hidden",
    position: "relative",
  },
  thumbImg: { width: "100%", height: "100%" },
  thumbX: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbAdd: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: COLORS.primaryMuted,
    borderStyle: "dashed",
    backgroundColor: COLORS.surface,
    gap: 4,
  },
  thumbAddText: { color: COLORS.primary, fontWeight: "600", fontSize: 12 },
  saveBtn: {
    marginTop: 28,
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  error: {
    color: COLORS.error,
    backgroundColor: "#FBEAEA",
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
});
