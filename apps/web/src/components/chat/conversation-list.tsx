import { MessageSquarePlus, Trash2 } from "lucide-react";
import { Button } from "@agentforge/ui";
import type {
  Conversation,
  TeamConversation,
} from "@/lib/supabase/types";

interface ConversationListProps {
  conversations: (Conversation | TeamConversation)[];
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  isCreating: boolean;

}

export function ConversationList({
  conversations,
  activeConversationId,
  onSelect,
  onCreate,
  onDelete,
  isCreating,

}: ConversationListProps) {
  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r">
      <div className="border-b p-3">
        <Button
          size="sm"
          className="w-full gap-2"
          onClick={onCreate}
          disabled={isCreating}
        >
          <MessageSquarePlus className="h-4 w-4" strokeWidth={1.75} />
          {isCreating ? "Starting…" : "New chat"}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {conversations.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">
            No conversations yet. Start one above.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {conversations.map((conversation) => (
              <li key={conversation.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onSelect(conversation.id)}
                  className={`w-full truncate rounded-md px-3 py-2 pr-8 text-left text-sm transition-colors ${
                    conversation.id === activeConversationId
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  {conversation.title}
                </button>
                <button
                  type="button"
                  aria-label="Delete conversation"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(conversation.id);
                  }}
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 opacity-0 transition-opacity hover:bg-black/10 group-hover:opacity-100 ${
                    conversation.id === activeConversationId
                      ? "text-primary-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
