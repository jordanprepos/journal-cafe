import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
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
import { StarPicker } from "@/src/components/StarPicker";
import {
  countryCodeForAddress,
  countryCodeForDeviceLocation,
  geocodeAddress,
} from "@/src/utils/geocode";
import { deviceCurrency } from "@/src/utils/price";
import { currencyForCountry } from "@/src/constants/currencies";
import { addTag, hasTag, removeTag, MAX_TAGS, PRESET_TAGS } from "@/src/constants/tags";
import { FACILITIES, Facility } from "@/src/constants/facilities";
import { FONTS, RADII, themedStyles, useTheme, useThemedStyles, type Theme } from "@/src/theme";

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
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [name, setName] = useState(initial?.name ?? "");
  const [photos, setPhotos] = useState<string[]>(initial?.photos ?? []);
  const [address, setAddress] = useState(initial?.address ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [favoriteDrink, setFavoriteDrink] = useState(initial?.favorite_drink ?? "");
  const [visitedDate, setVisitedDate] = useState(initial?.visited_date || todayISO());
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [customTag, setCustomTag] = useState("");
  const [priceMin, setPriceMin] = useState(
    initial?.price_min != null ? String(initial.price_min) : "",
  );
  const [priceMax, setPriceMax] = useState(
    initial?.price_max != null ? String(initial.price_max) : "",
  );
  // Seeded from the device locale so the field is never empty, then refined
  // from the café's actual location by the effect below.
  const [currency, setCurrency] = useState(initial?.price_currency || deviceCurrency());
  // Once the user edits the currency themselves, detection stops touching it.
  const currencyTouched = useRef(false);
  const [menu, setMenu] = useState<string[]>(initial?.recommended_menu ?? []);
  const [menuDraft, setMenuDraft] = useState("");
  const [facilities, setFacilities] = useState<Facility[]>(initial?.facilities ?? []);
  const [hospitality, setHospitality] = useState(initial?.hospitality ?? 0);
  const [error, setError] = useState("");

  // Pre-fill the currency from where the café actually is, rather than from the
  // phone's region setting — a device set to en-US would otherwise stamp USD on
  // a café in Jakarta. Prefers the typed address (right even when logging a trip
  // after you're home), falling back to GPS only if location was already granted
  // elsewhere, so this never raises a permission prompt. Native-only; on web both
  // lookups return null and the locale seed stands.
  useEffect(() => {
    // Never overwrite a currency the user typed, or one already saved on a café.
    if (currencyTouched.current || initial?.price_currency) return;
    const addr = address.trim();
    let cancelled = false;
    // Geocoding is rate-limited, so wait for typing to settle rather than
    // firing per keystroke.
    const timer = setTimeout(async () => {
      const iso = addr
        ? await countryCodeForAddress(addr)
        : await countryCodeForDeviceLocation();
      const detected = currencyForCountry(iso);
      // Re-check the guard: the user may have typed a currency while we waited.
      if (cancelled || !detected || currencyTouched.current) return;
      setCurrency(detected);
    }, 800);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [address, initial?.price_currency]);

  function toggleFacility(key: Facility) {
    setFacilities((f) => (f.includes(key) ? f.filter((x) => x !== key) : [...f, key]));
  }

  function addMenuItem() {
    const item = menuDraft.trim();
    if (!item) return;
    // Ignore case-insensitive duplicates.
    if (!menu.some((m) => m.toLowerCase() === item.toLowerCase())) {
      setMenu((m) => [...m, item]);
    }
    setMenuDraft("");
  }

  // "" → null; otherwise the parsed number. `undefined` signals an invalid entry.
  function parsePrice(raw: string): number | null | undefined {
    const t = raw.trim();
    if (!t) return null;
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0) return undefined;
    return n;
  }

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
    // Mirror the server's price rules so the user gets an inline error, not a 422.
    const pMin = parsePrice(priceMin);
    const pMax = parsePrice(priceMax);
    if (pMin === undefined || pMax === undefined) {
      setError("Price must be a number of 0 or more.");
      return;
    }
    if (pMin != null && pMax != null && pMax < pMin) {
      setError("Maximum price can't be lower than the minimum.");
      return;
    }
    const cur = currency.trim().toUpperCase();
    if ((pMin != null || pMax != null) && !/^[A-Z]{3}$/.test(cur)) {
      setError("Enter a 3-letter currency code (e.g. EUR) for the price.");
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
        // The pasted-link field is gone; the map button now searches by
        // name + address. Carry an existing café's saved link through an edit
        // (it's still preferred when present), and send "" for new cafés.
        location_link: initial?.location_link ?? "",
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
        price_min: pMin,
        price_max: pMax,
        // Only meaningful alongside a price; drop it otherwise.
        price_currency: pMin != null || pMax != null ? cur : null,
        // Fold in a half-typed menu item for the same reason as the tag box.
        recommended_menu: menuDraft.trim() &&
          !menu.some((m) => m.toLowerCase() === menuDraft.trim().toLowerCase())
          ? [...menu, menuDraft.trim()]
          : menu,
        facilities,
        hospitality,
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
              <ActivityIndicator size="small" color={colors.primary} />
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
              <Ionicons name="camera-outline" size={26} color={colors.primary} />
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
                      {/* onOverlay, not onPrimary: this sits on the scheme-
                          invariant overlay above a user photo, where dark
                          mode's near-black onPrimary would vanish. */}
                      <Ionicons name="close" size={14} color={colors.onOverlay} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  onPress={pickPhoto}
                  style={[styles.thumb, styles.thumbAdd]}
                  testID="add-photo-button"
                >
                  <Ionicons name="camera-outline" size={24} color={colors.primary} />
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
                placeholderTextColor={colors.textMuted}
                testID="form-name-input"
              />
            </Field>
            <Field
              label="Address / area"
              hint="Used for the map button and “Nearby” sorting."
            >
              <TextInput
                style={styles.input}
                value={address}
                onChangeText={setAddress}
                placeholder="e.g. Brooklyn, NY"
                placeholderTextColor={colors.textMuted}
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
                  placeholderTextColor={colors.textMuted}
                  testID="form-date-input"
                />
              </Field>
              <Field label="Drink" style={styles.splitCell} last>
                <TextInput
                  style={styles.input}
                  value={favoriteDrink}
                  onChangeText={setFavoriteDrink}
                  placeholder="Oat latte"
                  placeholderTextColor={colors.textMuted}
                  testID="form-drink-input"
                />
              </Field>
            </View>
          </View>

          <View style={styles.card}>
            <Field label="Rating">
              <StarPicker
                value={rating}
                onChange={setRating}
                testIDPrefix="form-rating"
                size={30}
              />
            </Field>
            <Field label="Hospitality" hint="How were the staff and service?" last>
              <StarPicker
                value={hospitality}
                onChange={setHospitality}
                testIDPrefix="form-hospitality"
                size={30}
              />
            </Field>
          </View>

          <View style={styles.card}>
            <Field label="Price range" hint="Typical spend per visit." last>
              <View style={styles.priceRow}>
                <TextInput
                  style={[styles.input, styles.priceInput]}
                  value={priceMin}
                  onChangeText={setPriceMin}
                  placeholder="Min"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  testID="form-price-min-input"
                />
                <TextInput
                  style={[styles.input, styles.priceInput]}
                  value={priceMax}
                  onChangeText={setPriceMax}
                  placeholder="Max"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  testID="form-price-max-input"
                />
                <TextInput
                  style={[styles.input, styles.currencyInput]}
                  value={currency}
                  onChangeText={(t) => {
                    currencyTouched.current = true;
                    setCurrency(t.toUpperCase());
                  }}
                  placeholder="CUR"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                  maxLength={3}
                  testID="form-currency-input"
                />
              </View>
            </Field>
          </View>

          <View style={styles.card}>
            <Field label="Recommended menu" last>
              <View style={styles.menuRow}>
                <TextInput
                  style={[styles.input, styles.menuInput]}
                  value={menuDraft}
                  onChangeText={setMenuDraft}
                  placeholder="e.g. Almond croissant"
                  placeholderTextColor={colors.textMuted}
                  onSubmitEditing={addMenuItem}
                  blurOnSubmit={false}
                  returnKeyType="done"
                  testID="form-menu-input"
                />
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={addMenuItem}
                  testID="form-menu-add"
                >
                  <Ionicons name="add" size={20} color={colors.onPrimary} />
                </TouchableOpacity>
              </View>
              {menu.length > 0 ? (
                <View style={styles.tagWrap}>
                  {menu.map((item, idx) => (
                    <TouchableOpacity
                      key={`${item}-${idx}`}
                      style={styles.menuChip}
                      onPress={() => setMenu((m) => m.filter((_, i) => i !== idx))}
                      testID={`form-menu-chip-${idx}`}
                    >
                      <Text style={styles.menuChipText}>{item}</Text>
                      <Ionicons name="close" size={11} color={colors.textSecondary} />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </Field>
          </View>

          <View style={styles.card}>
            <Field label="Facilities" last>
              <View style={styles.tagWrap}>
                {FACILITIES.map((f) => {
                  const on = facilities.includes(f.key);
                  return (
                    <TouchableOpacity
                      key={f.key}
                      style={[styles.tagChip, on && styles.tagChipOn]}
                      onPress={() => toggleFacility(f.key)}
                      testID={`form-facility-${f.key}`}
                    >
                      <Ionicons
                        name={f.icon}
                        size={12}
                        color={on ? colors.onInverseSurface : colors.textSecondary}
                      />
                      <Text style={[styles.tagChipText, on && styles.tagChipTextOn]}>
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
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
                      {on ? <Ionicons name="checkmark" size={11} color={colors.onInverseSurface} /> : null}
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
                    <Ionicons name="close" size={11} color={colors.onInverseSurface} />
                  </TouchableOpacity>
                ))}

                {tags.length < MAX_TAGS ? (
                  <View style={styles.tagInputChip}>
                    <Ionicons name="add" size={13} color={colors.primary} />
                    <TextInput
                      style={styles.tagInput}
                      value={customTag}
                      onChangeText={setCustomTag}
                      placeholder="new tag"
                      placeholderTextColor={colors.textMuted}
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
                placeholderTextColor={colors.textMuted}
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
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.field, !last && styles.fieldDivider, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

const makeStyles = themedStyles(({ colors, shadows, raisedOutline }: Theme) => ({
  container: { flex: 1, backgroundColor: colors.background },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 4,
  },
  cancel: { fontFamily: FONTS.sans, fontSize: 14, color: colors.textMuted },
  headerTitle: {
    fontFamily: FONTS.serif,
    fontSize: 19,
    color: colors.textPrimary,
  },
  save: { fontFamily: FONTS.sansBold, fontSize: 14, color: colors.primary },
  dropzone: {
    height: 150,
    borderRadius: RADII.card,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.borderDashed,
    backgroundColor: colors.inputSurface,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 16,
  },
  dropzoneTitle: { fontFamily: FONTS.sansSemi, fontSize: 13, color: colors.primary },
  dropzoneHint: { fontFamily: FONTS.sans, fontSize: 11, color: colors.textMuted },
  thumbStrip: { marginBottom: 16 },
  thumb: {
    width: 96,
    height: 96,
    borderRadius: RADII.card,
    backgroundColor: colors.surfaceSunken,
    overflow: "hidden",
  },
  thumbImg: { width: "100%", height: "100%" },
  thumbX: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: colors.overlay,
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
    borderColor: colors.borderDashed,
    backgroundColor: colors.inputSurface,
    gap: 4,
  },
  thumbAddText: { fontFamily: FONTS.sansSemi, color: colors.primary, fontSize: 12 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: RADII.card,
    overflow: "hidden",
    marginBottom: 14,
    ...shadows.card,
    ...raisedOutline,
  },
  field: { paddingHorizontal: 16, paddingVertical: 12 },
  fieldDivider: { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  fieldLabel: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  fieldHint: { fontFamily: FONTS.sans, fontSize: 11, color: colors.textMuted, marginTop: 4 },
  // Inputs sit flush inside their row — the card supplies the chrome.
  input: {
    fontFamily: FONTS.sans,
    fontSize: 15,
    color: colors.textPrimary,
    paddingTop: 3,
    paddingBottom: 0,
  },
  multiline: { minHeight: 96, paddingTop: 6 },
  splitRow: { flexDirection: "row" },
  splitCell: { flex: 1 },
  splitCellLeft: { flex: 1, borderRightWidth: 1, borderRightColor: colors.borderSubtle },
  starsRow: { flexDirection: "row", gap: 6, marginTop: 6 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 },
  // minWidth 0 is load-bearing: a TextInput's intrinsic width is ~171px, and a
  // flex child won't shrink below its content width without it — the currency
  // field ends up pushed off the edge of the card.
  priceInput: { flex: 1, minWidth: 0 },
  // Fits a 3-letter ISO code without stealing width from the amounts.
  currencyInput: { width: 56, flexShrink: 0 },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 },
  menuInput: { flex: 1, minWidth: 0 },
  addBtn: {
    backgroundColor: colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  menuChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADII.pill,
  },
  menuChipText: { fontFamily: FONTS.sansMedium, fontSize: 11, color: colors.textPrimary },
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADII.pill,
  },
  tagChipOn: { backgroundColor: colors.inverseSurface },
  tagChipText: { fontFamily: FONTS.sansMedium, fontSize: 11, color: colors.textSecondary },
  tagChipTextOn: { color: colors.onInverseSurface },
  tagInputChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderDashed,
  },
  tagInput: {
    fontFamily: FONTS.sansMedium,
    fontSize: 11,
    color: colors.textPrimary,
    minWidth: 62,
    padding: 0,
  },
  error: {
    fontFamily: FONTS.sans,
    color: colors.error,
    backgroundColor: colors.errorSurface,
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
}));
