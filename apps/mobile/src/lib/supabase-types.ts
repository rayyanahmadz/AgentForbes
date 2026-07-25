// Deliberately NOT importing from @agentforge/types here: that package's
// types are camelCase domain models (organizationId, isActive, ...), but a
// raw Supabase .select() result is snake_case, matching the DB columns
// directly (organization_id, is_active, ...). apps/web never actually types
// its Supabase query results with @agentforge/types either — it keeps its
// own snake_case types for exactly this reason. This file is the mobile
// app's equivalent, trimmed to just the tables this app actually touches.

export interface AiEmployee {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  provider: string;
  model: string;
  temperature: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  organization_id: string;
  ai_employee_id: string;
  created_by: string | null;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}
