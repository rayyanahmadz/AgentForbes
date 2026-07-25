import { useState } from "react";
import { Link, Redirect, router } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

import { Button } from "@/components/button";
import { TextField } from "@/components/text-field";
import { useAuth } from "@/contexts/auth-context";
import { colors, spacing } from "@/lib/theme";

export default function LoginScreen() {
  const { session, isLoading: isAuthLoading, signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mirrors the web app's PublicOnlyRoute: already signed in, no reason to
  // see the login form.
  if (!isAuthLoading && session) {
    return <Redirect href="/" />;
  }

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    const { error: signInError } = await signIn(email.trim(), password);
    setIsSubmitting(false);

    if (signInError) {
      setError(signInError);
      return;
    }

    router.replace("/");
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>AgentForge</Text>
        <Text style={styles.subtitle}>Log in to chat with your AI Employees.</Text>

        <View style={styles.form}>
          <TextField
            label="Email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextField
            label="Password"
            secureTextEntry
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Button
            label={isSubmitting ? "Logging in…" : "Log in"}
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={!email.trim() || !password}
          />

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Link href="/(auth)/signup" style={styles.link}>
              Sign up
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.xl
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.foreground,
    textAlign: "center"
  },
  subtitle: {
    fontSize: 15,
    color: colors.mutedForeground,
    textAlign: "center"
  },
  form: {
    gap: spacing.lg
  },
  error: {
    color: colors.destructive,
    fontSize: 13
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: spacing.sm
  },
  footerText: {
    color: colors.mutedForeground,
    fontSize: 14
  },
  link: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "600"
  }
});
