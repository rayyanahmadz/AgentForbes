import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, History, Send, User, Users } from "lucide-react";import { Button, Input } from "@agentforge/ui";

import { ConversationList } from "@/components/chat/conversation-list";
import { useAuth } from "@/contexts/auth-context";
import { useOrganization } from "@/contexts/organization-context";
import { streamTeamChatMessage } from "@/lib/team-chat-client";
import { supabase } from "@/lib/supabase/client";
import type { Team, TeamConversation, TeamMessage } from "@/lib/supabase/types";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  respondedByName?: string;
  isStreaming?: boolean;
}

export function TeamChatPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { user } = useAuth();
  const { organization } = useOrganization();

  const [team, setTeam] = useState<Team | null>(null);
  const [conversations, setConversations] = useState<TeamConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [isSending, setIsSending] = useState(false);
const [error, setError] = useState<string | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
  if (!teamId) return;

  const id = teamId;

  let isMounted = true;

  async function load() {
      const [{ data: teamData }, { data: conversationData }] = await Promise.all([
        supabase.from("teams").select("*").eq("id", id).single(),
        supabase
          .from("team_conversations")
          .select("*")
          .eq("team_id", id)
          .order("updated_at", { ascending: false })
      ]);

      if (!isMounted) return;

      setTeam(teamData ?? null);
      setConversations(conversationData ?? []);
      if (conversationData && conversationData.length > 0) {
        setActiveConversationId(conversationData[0]!.id);
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [teamId]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }
    const conversationId = activeConversationId;

    let isMounted = true;

    async function load() {
      const { data } = await supabase
        .from("team_messages")
        .select("*, ai_employees (name)")
        
.eq("team_conversation_id", conversationId)        .order("created_at", { ascending: true });

      if (!isMounted) return;

      setMessages(
        (data ?? []).map((m) => {
          const cast = m as unknown as TeamMessage & { ai_employees: { name: string } | null };
          return {
            id: cast.id,
role: cast.role as "user" | "assistant",            content: cast.content,
            respondedByName: cast.ai_employees?.name
          };
        })
      );
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [activeConversationId]);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleCreateConversation = useCallback(async () => {
   if (!organization || !teamId || !user) return;

const id = teamId;

setIsCreatingConversation(true);
    const { data, error: createError } = await supabase
      .from("team_conversations")
      .insert({ organization_id: organization.id, team_id: id, created_by: user.id })
      .select("*")
      .single();
    setIsCreatingConversation(false);

    if (createError || !data) {
      setError(createError?.message ?? "Couldn't start a new conversation.");
      return;
    }

    setConversations((current) => [data, ...current]);
    setActiveConversationId(data.id);
  }, [organization, teamId, user]);

  async function handleDeleteConversation(conversationId: string) {
    const confirmed = window.confirm("Delete this conversation? This can't be undone.");
    if (!confirmed) return;

    const { error: deleteError } = await supabase
      .from("team_conversations")
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

    if (!conversationId) {
  if (!organization || !teamId || !user) return;

  const id = teamId;
      const { data, error: createError } = await supabase
        .from("team_conversations")
        .insert({ organization_id: organization.id, team_id: id, created_by: user.id })
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

    await streamTeamChatMessage(conversationId, trimmed, {
      onPicked: (employeeName) => {
        setMessages((current) =>
          current.map((m) =>
            m.id === assistantMessageId ? { ...m, respondedByName: employeeName } : m
          )
        );
      },
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
          current.map((m) => (m.id === assistantMessageId ? { ...m, isStreaming: false } : m))
        );
        setIsSending(false);
      }
    });

    setIsSending(false);
  }

  if (!team) {
    return <p className="p-6 text-sm text-muted-foreground">Loading team…</p>;
  }

  return (
    <div className="flex h-full flex-col">
     <div className="flex items-center gap-3 border-b px-4 py-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/dashboard/teams">
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
          <Users className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <div>
          <p className="font-medium leading-tight">{team.name}</p>
          <p className="text-xs text-muted-foreground">
            The lead routes each message to the best-suited teammate
          </p>
        </div>
      </div>

<div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">        <ConversationList
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelect={setActiveConversationId}
          onCreate={() => void handleCreateConversation()}
          onDelete={(id) => void handleDeleteConversation(id)}
          isCreating={isCreatingConversation}
        />

<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">          <div className="flex-1 overflow-y-auto px-6 py-6">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                <Users className="h-8 w-8" strokeWidth={1.5} />
                <p>Say something to get started — the lead will decide who answers.</p>
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
                        <Users className="h-3.5 w-3.5" strokeWidth={1.75} />
                      )}
                    </span>
                    <div
                      className={`flex max-w-[80%] flex-col gap-1 ${
                        message.role === "user" ? "items-end" : "items-start"
                      }`}
                    >
                      {message.role === "assistant" && message.respondedByName && (
                        <p className="text-xs font-medium text-muted-foreground">
                          {message.respondedByName}
                        </p>
                      )}
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
              placeholder={`Message ${team.name}…`}
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
