import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { COLORS, FONTS } from "@/src/theme";

export default function Register() {
  const router = useRouter();
  const { register } = useAuth();
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
            placeholderTextColor={COLORS.textSecondary}
            value={name}
            onChangeText={setName}
            testID="register-name-input"
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={COLORS.textSecondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            testID="register-email-input"
          />
          <TextInput
            style={styles.input}
            placeholder="Password (6+ chars)"
            placeholderTextColor={COLORS.textSecondary}
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
              <ActivityIndicator color="#fff" />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 24, paddingTop: 60 },
  brand: {
    fontSize: 36,
    fontFamily: FONTS.serif,
    color: COLORS.textPrimary,
    fontWeight: "600",
    marginBottom: 8,
  },
  subtitle: { fontSize: 16, color: COLORS.textSecondary, marginBottom: 40 },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginBottom: 14,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  linkBtn: { marginTop: 20, alignItems: "center" },
  linkText: { color: COLORS.textSecondary, fontSize: 14 },
  linkAccent: { color: COLORS.primary, fontWeight: "600" },
  error: {
    color: COLORS.error,
    marginBottom: 12,
    backgroundColor: "#FBEAEA",
    padding: 10,
    borderRadius: 10,
  },
});
