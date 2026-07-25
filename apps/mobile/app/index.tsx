import { useCallback, useEffect, useState } from "react";
import { Redirect, router } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from "react-native";
import { truncate } from "@agentforge/utils";

import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabase";
import type { AiEmployee } from "@/lib/supabase-types";
import { colors, radius, spacing } from "@/lib/theme";

export default function EmployeeListScreen() {
  const { session, isLoading: isAuthLoading, profile, signOut } = useAuth();

  const [employees, setEmployees] = useState<AiEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEmployees = useCallback(async () => {
    if (!profile?.default_organization_id) return;

    setError(null);
    const { data, error: fetchError } = await supabase
      .from("ai_employees")
      .select("*")
      .eq("organization_id", profile.default_organization_id)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setEmployees(data ?? []);
    }
    setIsLoading(false);
  }, [profile?.default_organization_id]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  if (!isAuthLoading && !session) {
    return <Redirect href="/(auth)/login" />;
  }

  if (isAuthLoading || isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>AI Employees</Text>
          {profile?.full_name && <Text style={styles.subtitle}>Hi, {profile.full_name}</Text>}
        </View>
        <Pressable onPress={() => void signOut()}>
          <Text style={styles.signOut}>Log out</Text>
        </Pressable>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {employees.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No active employees yet</Text>
          <Text style={styles.emptySubtitle}>
            Create one in the AgentForge web app, then come back here to chat with it.
          </Text>
        </View>
      ) : (
        <FlatList
          data={employees}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={() => void loadEmployees()} />
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => router.push(`/employee/${item.id}/chat`)}
            >
              <Text style={styles.cardTitle}>{item.name}</Text>
              {item.description && (
                <Text style={styles.cardDescription}>{truncate(item.description, 90)}</Text>
              )}
              <Text style={styles.cardMeta}>
                {item.provider} · {item.model}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.foreground
  },
  subtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 2
  },
  signOut: {
    fontSize: 14,
    color: colors.mutedForeground
  },
  error: {
    color: colors.destructive,
    fontSize: 13,
    paddingHorizontal: spacing.xl
  },
  list: {
    padding: spacing.xl,
    gap: spacing.md
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs
  },
  cardPressed: {
    opacity: 0.7
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.foreground
  },
  cardDescription: {
    fontSize: 14,
    color: colors.mutedForeground
  },
  cardMeta: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: spacing.xs
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.foreground
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: "center"
  }
});
