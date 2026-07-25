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

export default function SignupScreen() {
  const { session, isLoading: isAuthLoading, signUp } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  if (!isAuthLoading && session) {
    return <Redirect href="/" />;
  }

  async function handleSubmit() {
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setIsSubmitting(true);
    const { error: signUpError } = await signUp(email.trim(), password, fullName.trim());
    setIsSubmitting(false);

    if (signUpError) {
      setError(signUpError);
      return;
    }

    // Same as the web app: if email confirmation is on (the Supabase
    // default), there's no session yet.
    setConfirmationSent(true);
  }

  if (confirmationSent) {
    return (
      <View style={styles.confirmContainer}>
        <Text style={styles.title}>Check your inbox</Text>
        <Text style={styles.subtitle}>
          We sent a confirmation link to {email}. Confirm it, then log in below.
        </Text>
        <Button label="Go to login" onPress={() => router.replace("/(auth)/login")} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Chat with your AI Employees from anywhere.</Text>

        <View style={styles.form}>
          <TextField label="Full name" autoComplete="name" value={fullName} onChangeText={setFullName} />
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
            autoComplete="password-new"
            value={password}
            onChangeText={setPassword}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Button
            label={isSubmitting ? "Creating account…" : "Create account"}
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={!fullName.trim() || !email.trim() || !password}
          />

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/login" style={styles.link}>
              Log in
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
  confirmContainer: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.lg,
    backgroundColor: colors.background
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
