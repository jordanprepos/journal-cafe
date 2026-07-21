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
import { addTag, hasTag, removeTag, MAX_TAGS, PRESET_TAGS } from "@/src/constants/tags";
import { COLORS, FONTS, RADII, SHADOWS } from "@/src/theme";

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
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [customTag, setCustomTag] = useState("");
  const [error, setError] = useState("");

  function toggleTag(tag: string) {
    setTags((t) => (hasTag(t, tag) ? removeTag(t, tag) : addTag(t, tag)));
  }

  function commitCustomTag() {
    setTags((t) => addTag(t, customTag));
    setCustomTag("");
  }

  // Tags the user typed themselves, i.e. everything not on the preset list.
  // Rendered after the presets, always in the selected state.
  const customTags = tags.filter((t) => !PRESET_TAGS.some((p) => p.toLowerCase() === t.toLowerCase()));

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
      // Keep coordinates in sync with the address so a café never carries a
      // location that doesn't match its address.
      let latitude: number | null = initial?.latitude ?? null;
      let longitude: number | null = initial?.longitude ?? null;
      const addressChanged = addr !== (initial?.address ?? "").trim();
      if (!addr) {
        // No address → no coordinates.
        latitude = null;
        longitude = null;
      } else if (addressChanged || latitude == null || longitude == null) {
        // Address is new/changed, or we don't have coords yet → (re)geocode.
        const geo = await geocodeAddress(addr);
        if (geo) {
          latitude = geo.lat;
          longitude = geo.lng;
        } else if (addressChanged) {
          // Changed address we couldn't resolve → drop the now-stale coords
          // rather than keep a location that no longer matches.
          latitude = null;
          longitude = null;
        }
        // Unchanged address still missing coords + geocode failed → stays null.
      }
      // Otherwise: address unchanged and coords already present → keep them.
      await onSave({
        name: name.trim(),
        photos,
        location_link: locationLink.trim(),
        address: addr,
        notes: notes.trim(),
        rating,
        favorite_drink: favoriteDrink.trim(),
        visited_date: visitedDate.trim() || todayISO(),
        // Fold in anything still sitting in the custom-tag box so a half-typed
        // tag isn't silently dropped when the user taps Save directly.
        tags: addTag(tags, customTag),
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
          <TouchableOpacity onPress={() => router.back()} testID="form-back-button">
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <TouchableOpacity onPress={submit} disabled={saving} testID="form-save-button">
            {saving ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Text style={styles.save}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
        >
          {error ? (
            <Text style={styles.error} testID="form-error">
              {error}
            </Text>
          ) : null}

          {photos.length === 0 ? (
            <TouchableOpacity
              style={styles.dropzone}
              onPress={pickPhoto}
              testID="add-photo-button"
            >
              <Ionicons name="camera-outline" size={26} color={COLORS.primary} />
              <Text style={styles.dropzoneTitle}>Add photos</Text>
              <Text style={styles.dropzoneHint}>or paste from camera roll</Text>
            </TouchableOpacity>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.thumbStrip}
            >
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
                  <Ionicons name="camera-outline" size={24} color={COLORS.primary} />
                  <Text style={styles.thumbAddText}>Add</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          <View style={styles.card}>
            <Field label="Café name">
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Blue Bottle Coffee"
                placeholderTextColor={COLORS.textMuted}
                testID="form-name-input"
              />
            </Field>
            <Field label="Location">
              <TextInput
                style={styles.input}
                value={locationLink}
                onChangeText={setLocationLink}
                placeholder="Paste Maps link"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                testID="form-location-input"
              />
            </Field>
            <Field label="Address / area" hint="Places your café on the map for “Nearby”.">
              <TextInput
                style={styles.input}
                value={address}
                onChangeText={setAddress}
                placeholder="e.g. Brooklyn, NY"
                placeholderTextColor={COLORS.textMuted}
                testID="form-address-input"
              />
            </Field>
            <View style={styles.splitRow}>
              <Field label="Visited" style={styles.splitCellLeft} last>
                <TextInput
                  style={styles.input}
                  value={visitedDate}
                  onChangeText={setVisitedDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={COLORS.textMuted}
                  testID="form-date-input"
                />
              </Field>
              <Field label="Drink" style={styles.splitCell} last>
                <TextInput
                  style={styles.input}
                  value={favoriteDrink}
                  onChangeText={setFavoriteDrink}
                  placeholder="Oat latte"
                  placeholderTextColor={COLORS.textMuted}
                  testID="form-drink-input"
                />
              </Field>
            </View>
          </View>

          <View style={styles.card}>
            <Field label="Rating" last>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => setRating(i === rating ? 0 : i)}
                    testID={`form-rating-${i}`}
                  >
                    <Ionicons
                      name={i <= rating ? "star" : "star-outline"}
                      size={30}
                      color={COLORS.star}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </Field>
          </View>

          <View style={styles.card}>
            <Field label="Tags" last>
              <View style={styles.tagWrap}>
                {PRESET_TAGS.map((t) => {
                  const on = hasTag(tags, t);
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[styles.tagChip, on && styles.tagChipOn]}
                      onPress={() => toggleTag(t)}
                      testID={`form-tag-${t.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <Text style={[styles.tagChipText, on && styles.tagChipTextOn]}>{t}</Text>
                      {on ? <Ionicons name="checkmark" size={11} color="#fff" /> : null}
                    </TouchableOpacity>
                  );
                })}

                {customTags.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.tagChip, styles.tagChipOn]}
                    onPress={() => toggleTag(t)}
                    testID={`form-tag-custom-${t.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <Text style={[styles.tagChipText, styles.tagChipTextOn]}>{t}</Text>
                    <Ionicons name="close" size={11} color="#fff" />
                  </TouchableOpacity>
                ))}

                {tags.length < MAX_TAGS ? (
                  <View style={styles.tagInputChip}>
                    <Ionicons name="add" size={13} color={COLORS.primary} />
                    <TextInput
                      style={styles.tagInput}
                      value={customTag}
                      onChangeText={setCustomTag}
                      placeholder="new tag"
                      placeholderTextColor={COLORS.textMuted}
                      // Keeps focus so tapping a preset chip straight after
                      // typing registers as a tap rather than a dismiss.
                      blurOnSubmit={false}
                      returnKeyType="done"
                      onSubmitEditing={commitCustomTag}
                      onBlur={commitCustomTag}
                      testID="form-custom-tag-input"
                    />
                  </View>
                ) : null}
              </View>
            </Field>
          </View>

          <View style={styles.card}>
            <Field label="Notes" last>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Vibe, music, who you were with…"
                placeholderTextColor={COLORS.textMuted}
                multiline
                textAlignVertical="top"
                testID="form-notes-input"
              />
            </Field>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  hint,
  children,
  style,
  last,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  style?: object;
  last?: boolean;
}) {
  return (
    <View style={[styles.field, !last && styles.fieldDivider, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 4,
  },
  cancel: { fontFamily: FONTS.sans, fontSize: 14, color: COLORS.textMuted },
  headerTitle: {
    fontFamily: FONTS.serif,
    fontSize: 19,
    color: COLORS.textPrimary,
  },
  save: { fontFamily: FONTS.sansBold, fontSize: 14, color: COLORS.primary },
  dropzone: {
    height: 150,
    borderRadius: RADII.card,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: COLORS.borderDashed,
    backgroundColor: COLORS.inputSurface,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 16,
  },
  dropzoneTitle: { fontFamily: FONTS.sansSemi, fontSize: 13, color: COLORS.primary },
  dropzoneHint: { fontFamily: FONTS.sans, fontSize: 11, color: COLORS.textMuted },
  thumbStrip: { marginBottom: 16 },
  thumb: {
    width: 96,
    height: 96,
    borderRadius: RADII.card,
    backgroundColor: COLORS.surfaceSunken,
    overflow: "hidden",
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
    borderStyle: "dashed",
    borderColor: COLORS.borderDashed,
    backgroundColor: COLORS.inputSurface,
    gap: 4,
  },
  thumbAddText: { fontFamily: FONTS.sansSemi, color: COLORS.primary, fontSize: 12 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADII.card,
    overflow: "hidden",
    marginBottom: 14,
    ...SHADOWS.card,
  },
  field: { paddingHorizontal: 16, paddingVertical: 12 },
  fieldDivider: { borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle },
  fieldLabel: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: COLORS.textMuted,
  },
  fieldHint: { fontFamily: FONTS.sans, fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  // Inputs sit flush inside their row — the card supplies the chrome.
  input: {
    fontFamily: FONTS.sans,
    fontSize: 15,
    color: COLORS.textPrimary,
    paddingTop: 3,
    paddingBottom: 0,
  },
  multiline: { minHeight: 96, paddingTop: 6 },
  splitRow: { flexDirection: "row" },
  splitCell: { flex: 1 },
  splitCellLeft: { flex: 1, borderRightWidth: 1, borderRightColor: COLORS.borderSubtle },
  starsRow: { flexDirection: "row", gap: 6, marginTop: 6 },
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.surfaceSecondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADII.pill,
  },
  tagChipOn: { backgroundColor: COLORS.textPrimary },
  tagChipText: { fontFamily: FONTS.sansMedium, fontSize: 11, color: COLORS.textSecondary },
  tagChipTextOn: { color: "#fff" },
  tagInputChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: COLORS.borderDashed,
  },
  tagInput: {
    fontFamily: FONTS.sansMedium,
    fontSize: 11,
    color: COLORS.textPrimary,
    minWidth: 62,
    padding: 0,
  },
  error: {
    fontFamily: FONTS.sans,
    color: COLORS.error,
    backgroundColor: "#FBEAEA",
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
});
