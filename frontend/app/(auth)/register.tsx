import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { FONTS, RADII, themedStyles, useTheme, useThemedStyles, type Theme } from "@/src/theme";

export default function Register() {
  const router = useRouter();
  const { register } = useAuth();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError("");
    if (!name.trim() || !email.trim() || !password) {
      setError("Please fill out every field.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      await register(email.trim(), password, name.trim());
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.brand}>Start your journal</Text>
          <Text style={styles.subtitle}>Every cafe tells a story.</Text>

          {error ? (
            <Text style={styles.error} testID="register-error">
              {error}
            </Text>
          ) : null}

          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
            testID="register-name-input"
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            testID="register-email-input"
          />
          <TextInput
            style={styles.input}
            placeholder="Password (6+ chars)"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            testID="register-password-input"
          />

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={submit}
            disabled={loading}
            testID="register-submit-button"
          >
            {loading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.primaryBtnText}>Create account</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.linkBtn}
            testID="register-go-login"
          >
            <Text style={styles.linkText}>
              Already have an account? <Text style={styles.linkAccent}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = themedStyles(({ colors }: Theme) => ({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 24, paddingTop: 60 },
  brand: {
    fontSize: 34,
    fontFamily: FONTS.serif,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: FONTS.sans,
    fontSize: 15,
    color: colors.textMuted,
    marginBottom: 40,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: RADII.pill,
    paddingHorizontal: 18,
    paddingVertical: 15,
    fontFamily: FONTS.sans,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: RADII.pill,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
  },
  primaryBtnText: { fontFamily: FONTS.sansSemi, color: colors.onPrimary, fontSize: 15 },
  linkBtn: { marginTop: 20, alignItems: "center" },
  linkText: { fontFamily: FONTS.sans, color: colors.textSecondary, fontSize: 14 },
  linkAccent: { fontFamily: FONTS.sansSemi, color: colors.primary },
  error: {
    fontFamily: FONTS.sans,
    color: colors.error,
    marginBottom: 12,
    backgroundColor: colors.errorSurface,
    padding: 12,
    borderRadius: 12,
  },
}));
