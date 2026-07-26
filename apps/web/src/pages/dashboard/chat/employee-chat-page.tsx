import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Bot, BrainCircuit, Check, History, Send, User } from "lucide-react";import { Button, Input } from "@agentforge/ui";

import { ConversationList } from "@/components/chat/conversation-list";
import { useAuth } from "@/contexts/auth-context";
import { useOrganization } from "@/contexts/organization-context";
import { streamChatMessage } from "@/lib/chat-client";
import { supabase } from "@/lib/supabase/client";
import type { AiEmployee, Conversation, Message } from "@/lib/supabase/types";

const MAX_MEMORY_CHARS = 1000;

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

export function EmployeeChatPage() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const { user } = useAuth();
  const { organization } = useOrganization();

  const [employee, setEmployee] = useState<AiEmployee | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMemoryIds, setSavedMemoryIds] = useState<Set<string>>(new Set());
  const [savingMemoryId, setSavingMemoryId] = useState<string | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  // Load the employee + its conversation list.
  useEffect(() => {
    if (!employeeId) return;

    let isMounted = true;

    async function load() {
    const [{ data: employeeData }, { data: conversationData }] = await Promise.all([
  supabase
    .from("ai_employees")
    .select("*")
.eq("id", employeeId!)    .single(),

  supabase
    .from("conversations")
    .select("*")
.eq("ai_employee_id", employeeId!)    .order("updated_at", { ascending: false })
]);

      if (!isMounted) return;

      setEmployee(employeeData ?? null);
      setConversations(conversationData ?? []);
      if (conversationData && conversationData.length > 0) {
        setActiveConversationId(conversationData[0]!.id);
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [employeeId]);

  // Load messages whenever the active conversation changes.
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    let isMounted = true;

    supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", activeConversationId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (!isMounted) return;
       setMessages(
  (data ?? []).map((m: Message) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content
  }))
);
      });

    return () => {
      isMounted = false;
    };
  }, [activeConversationId]);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleCreateConversation = useCallback(async () => {
    if (!organization || !employeeId || !user) return;

    setIsCreatingConversation(true);
    const { data, error: createError } = await supabase
      .from("conversations")
      .insert({
        organization_id: organization.id,
        ai_employee_id: employeeId,
        created_by: user.id
      })
      .select("*")
      .single();
    setIsCreatingConversation(false);

    if (createError || !data) {
      setError(createError?.message ?? "Couldn't start a new conversation.");
      return;
    }

    setConversations((current) => [data, ...current]);
    setActiveConversationId(data.id);
  }, [organization, employeeId, user]);

  async function handleDeleteConversation(conversationId: string) {
    const confirmed = window.confirm("Delete this conversation? This can't be undone.");
    if (!confirmed) return;

    const { error: deleteError } = await supabase
      .from("conversations")
      .delete()
      .eq("id", conversationId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setConversations((current) => current.filter((c) => c.id !== conversationId));
    if (activeConversationId === conversationId) {
      setActiveConversationId(null);
    }
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || isSending) return;

    let conversationId = activeConversationId;

    // First message with no conversation yet: create one implicitly.
    if (!conversationId) {
      if (!organization || !employeeId || !user) return;
      const { data, error: createError } = await supabase
        .from("conversations")
        .insert({
          organization_id: organization.id,
          ai_employee_id: employeeId,
          created_by: user.id
        })
        .select("*")
        .single();

      if (createError || !data) {
        setError(createError?.message ?? "Couldn't start a new conversation.");
        return;
      }

      conversationId = data.id;
      setConversations((current) => [data, ...current]);
      setActiveConversationId(data.id);
    }

    setError(null);
    setDraft("");
    setIsSending(true);

    const userMessageId = `local-user-${Date.now()}`;
    const assistantMessageId = `local-assistant-${Date.now()}`;

    setMessages((current) => [
      ...current,
      { id: userMessageId, role: "user", content: trimmed },
      { id: assistantMessageId, role: "assistant", content: "", isStreaming: true }
    ]);

    await streamChatMessage(conversationId, trimmed, {
      onDelta: (text) => {
        setMessages((current) =>
          current.map((m) =>
            m.id === assistantMessageId ? { ...m, content: m.content + text } : m
          )
        );
      },
      onError: (message) => {
        setError(message);
        setMessages((current) => current.filter((m) => m.id !== assistantMessageId));
      },
      onDone: () => {
        setMessages((current) =>
          current.map((m) =>
            m.id === assistantMessageId ? { ...m, isStreaming: false } : m
          )
        );
        setIsSending(false);
      }
    });

    setIsSending(false);
  }

  async function handleSaveMemory(message: DisplayMessage) {
    if (!organization || !employeeId || savedMemoryIds.has(message.id)) return;

    setSavingMemoryId(message.id);
    const { error: insertError } = await supabase.from("employee_memories").insert({
      organization_id: organization.id,
      ai_employee_id: employeeId,
      created_by: user?.id,
      content: message.content.slice(0, MAX_MEMORY_CHARS)
    });
    setSavingMemoryId(null);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setSavedMemoryIds((current) => new Set(current).add(message.id));
  }

  if (!employee) {
    return <p className="p-6 text-sm text-muted-foreground">Loading employee…</p>;
  }

  return (
<div className="flex h-full min-h-0 flex-col">      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/dashboard/employees">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </Button>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground md:hidden"
          aria-label="Show conversation history"
        >
          <History className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary">
          <Bot className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <div>
          <p className="font-medium leading-tight">{employee.name}</p>
          <p className="text-xs text-muted-foreground">
            {employee.provider} · {employee.model}
          </p>
        </div>
      </div>

<div className="flex min-h-0 flex-1 overflow-hidden">        <ConversationList
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelect={setActiveConversationId}
          onCreate={() => void handleCreateConversation()}
          onDelete={(id) => void handleDeleteConversation(id)}
          isCreating={isCreatingConversation}
        />

<div className="flex min-h-0 flex-1 flex-col">          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                <Bot className="h-8 w-8" strokeWidth={1.5} />
                <p>Say something to {employee.name} to get started.</p>
              </div>
            ) : (
              <div className="mx-auto flex max-w-2xl flex-col gap-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary">
                      {message.role === "user" ? (
                        <User className="h-3.5 w-3.5" strokeWidth={1.75} />
                      ) : (
                        <Bot className="h-3.5 w-3.5" strokeWidth={1.75} />
                      )}
                    </span>
                    <div
                      className={`flex max-w-[80%] flex-col gap-1 ${
                        message.role === "user" ? "items-end" : "items-start"
                      }`}
                    >
                      <div
                        className={`whitespace-pre-wrap rounded-lg px-3.5 py-2.5 text-sm ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        {message.content}
                        {message.isStreaming && (
                          <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-current align-middle" />
                        )}
                      </div>
                      {message.role === "assistant" &&
                        !message.isStreaming &&
                        message.content && (
                          <button
                            type="button"
                            onClick={() => void handleSaveMemory(message)}
                            disabled={savingMemoryId === message.id}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                          >
                            {savedMemoryIds.has(message.id) ? (
                              <>
                                <Check className="h-3 w-3" strokeWidth={2} />
                                Saved to memory
                              </>
                            ) : (
                              <>
                                <BrainCircuit className="h-3 w-3" strokeWidth={1.75} />
                                {savingMemoryId === message.id ? "Saving…" : "Save to memory"}
                              </>
                            )}
                          </button>
                        )}
                    </div>
                  </div>
                ))}
                <div ref={scrollAnchorRef} />
              </div>
            )}
          </div>

          {error && (
            <div className="mx-6 mb-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={handleSend} className="flex gap-2 border-t p-4">
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={`Message ${employee.name}…`}
              disabled={isSending}
              autoFocus
            />
            <Button type="submit" size="icon" disabled={isSending || !draft.trim()}>
              <Send className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
