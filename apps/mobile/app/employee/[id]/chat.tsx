import { useCallback, useEffect, useRef, useState } from "react";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import { useAuth } from "@/contexts/auth-context";
import { sendChatMessage } from "@/lib/chat-client";
import { supabase } from "@/lib/supabase";
import type { AiEmployee, Message } from "@/lib/supabase-types";
import { colors, radius, spacing } from "@/lib/theme";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function ChatScreen() {
  const { id: employeeId } = useLocalSearchParams<{ id: string }>();
  const { session, isLoading: isAuthLoading, user, profile } = useAuth();

  const [employee, setEmployee] = useState<AiEmployee | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<DisplayMessage>>(null);

  const loadEverything = useCallback(async () => {
    if (!employeeId || !profile?.default_organization_id || !user) return;

    setIsLoading(true);

    const { data: employeeData } = await supabase
      .from("ai_employees")
      .select("*")
      .eq("id", employeeId)
      .single();
    setEmployee(employeeData ?? null);

    // Simplest mobile UX: one continuous thread per employee rather than
    // the web app's conversation list — reuse the most recent conversation
    // if one exists, else it's created lazily on first send.
    const { data: existingConversations } = await supabase
      .from("conversations")
      .select("*")
      .eq("ai_employee_id", employeeId)
      .order("updated_at", { ascending: false })
      .limit(1);

    const conversation = existingConversations?.[0] ?? null;

    if (conversation) {
      setConversationId(conversation.id);
      const { data: messageRows } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true });

      setMessages(
        (messageRows ?? []).map((m: Message) => ({ id: m.id, role: m.role, content: m.content }))
      );
    }

    setIsLoading(false);
  }, [employeeId, profile?.default_organization_id, user]);

  useEffect(() => {
    void loadEverything();
  }, [loadEverything]);

  if (!isAuthLoading && !session) {
    return <Redirect href="/(auth)/login" />;
  }

  async function handleSend() {
    const trimmed = draft.trim();
    if (!trimmed || isSending || !profile?.default_organization_id || !user || !employeeId) {
      return;
    }

    let activeConversationId = conversationId;

    if (!activeConversationId) {
      const { data: newConversation, error: createError } = await supabase
        .from("conversations")
        .insert({
          organization_id: profile.default_organization_id,
          ai_employee_id: employeeId,
          created_by: user.id
        })
        .select("*")
        .single();

      if (createError || !newConversation) {
        setError(createError?.message ?? "Couldn't start a conversation.");
        return;
      }

      activeConversationId = newConversation.id;
      setConversationId(newConversation.id);
    }

    setError(null);
    setDraft("");
    setIsSending(true);

    const userMessage: DisplayMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: trimmed
    };
    setMessages((current) => [...current, userMessage]);

    const result = await sendChatMessage(activeConversationId, trimmed);

    if (result.error || !result.fullText) {
      setError(result.error ?? "Something went wrong.");
      setIsSending(false);
      return;
    }

    setMessages((current) => [
      ...current,
      { id: `local-${Date.now()}-assistant`, role: "assistant", content: result.fullText! }
    ]);
    setIsSending(false);
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backLink}>‹ Employees</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{employee?.name ?? "Chat"}</Text>
        <View style={{ width: 70 }} />
      </View>

      {messages.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>
            Say something to {employee?.name ?? "get started"}.
          </Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubbleRow,
                item.role === "user" ? styles.bubbleRowUser : styles.bubbleRowAssistant
              ]}
            >
              <View
                style={[
                  styles.bubble,
                  item.role === "user" ? styles.bubbleUser : styles.bubbleAssistant
                ]}
              >
                <Text
                  style={item.role === "user" ? styles.bubbleTextUser : styles.bubbleTextAssistant}
                >
                  {item.content}
                </Text>
              </View>
            </View>
          )}
        />
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder={`Message ${employee?.name ?? "employee"}…`}
          placeholderTextColor={colors.mutedForeground}
          value={draft}
          onChangeText={setDraft}
          editable={!isSending}
          multiline
        />
        <Pressable
          style={[styles.sendButton, (!draft.trim() || isSending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!draft.trim() || isSending}
        >
          {isSending ? (
            <ActivityIndicator color={colors.primaryForeground} size="small" />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  backLink: {
    color: colors.primary,
    fontSize: 15,
    width: 70
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.foreground
  },
  emptyText: {
    color: colors.mutedForeground,
    fontSize: 14
  },
  messageList: {
    padding: spacing.lg,
    gap: spacing.sm
  },
  bubbleRow: {
    flexDirection: "row",
    marginBottom: spacing.sm
  },
  bubbleRowUser: { justifyContent: "flex-end" },
  bubbleRowAssistant: { justifyContent: "flex-start" },
  bubble: {
    maxWidth: "80%",
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  bubbleUser: {
    backgroundColor: colors.primary
  },
  bubbleAssistant: {
    backgroundColor: colors.muted
  },
  bubbleTextUser: {
    color: colors.primaryForeground,
    fontSize: 15
  },
  bubbleTextAssistant: {
    color: colors.foreground,
    fontSize: 15
  },
  error: {
    color: colors.destructive,
    fontSize: 13,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.foreground,
    maxHeight: 120
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center"
  },
  sendButtonDisabled: {
    opacity: 0.5
  },
  sendButtonText: {
    color: colors.primaryForeground,
    fontWeight: "600",
    fontSize: 14
  }
});
