export type OrgRole = "owner" | "admin" | "member";

export type AiProvider = "anthropic" | "openai" | "gemini" | "openrouter" | "ollama" | "lmstudio";

export type NotificationType =
  | "low_credits"
  | "workflow_run_completed"
  | "workflow_run_failed"
  | "marketplace_install"
  | "bank_transfer_submitted"
  | "added_to_organization"
  | "bank_transfer_verified"
  | "bank_transfer_rejected";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          default_organization_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          default_organization_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          default_organization_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          owner_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          owner_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          owner_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      organization_members: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: OrgRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role?: OrgRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          role?: OrgRole;
          created_at?: string;
        };
      };
      ai_employees: {
        Row: {
          id: string;
          organization_id: string;
          created_by: string | null;
          name: string;
          description: string | null;
          instructions: string | null;
          provider: AiProvider;
          model: string;
          temperature: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          created_by: string;
          name: string;
          description?: string | null;
          instructions?: string | null;
          provider?: AiProvider;
          model?: string;
          temperature?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          created_by?: string | null;
          name?: string;
          description?: string | null;
          instructions?: string | null;
          provider?: AiProvider;
          model?: string;
          temperature?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      conversations: {
        Row: {
          id: string;
          organization_id: string;
          ai_employee_id: string;
          created_by: string;
          title: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          ai_employee_id: string;
          created_by: string;
          title?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          ai_employee_id?: string;
          created_by?: string;
          title?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          organization_id: string;
          conversation_id: string;
          role: "user" | "assistant";
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          conversation_id: string;
          role: "user" | "assistant";
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          conversation_id?: string;
          role?: "user" | "assistant";
          content?: string;
          created_at?: string;
        };
      };
      organization_api_keys: {
        Row: {
          id: string;
          organization_id: string;
          provider: AiProvider;
          api_key: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          provider: AiProvider;
          api_key: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          provider?: AiProvider;
          api_key?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      knowledge_sources: {
        Row: {
          id: string;
          organization_id: string;
          created_by: string | null;
          name: string;
          description: string | null;
          source_type: "text" | "file";
          file_path: string | null;
          file_name: string | null;
          mime_type: string | null;
          content: string;
          char_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          created_by: string;
          name: string;
          description?: string | null;
          source_type: "text" | "file";
          file_path?: string | null;
          file_name?: string | null;
          mime_type?: string | null;
          content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          created_by?: string | null;
          name?: string;
          description?: string | null;
          source_type?: "text" | "file";
          file_path?: string | null;
          file_name?: string | null;
          mime_type?: string | null;
          content?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      ai_employee_knowledge_sources: {
        Row: {
          id: string;
          organization_id: string;
          ai_employee_id: string;
          knowledge_source_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          ai_employee_id: string;
          knowledge_source_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          ai_employee_id?: string;
          knowledge_source_id?: string;
          created_at?: string;
        };
      };
      employee_memories: {
        Row: {
          id: string;
          organization_id: string;
          ai_employee_id: string;
          created_by: string | null;
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          ai_employee_id: string;
          created_by?: string | null;
          content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          ai_employee_id?: string;
          created_by?: string | null;
          content?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      workflows: {
        Row: {
          id: string;
          organization_id: string;
          created_by: string | null;
          name: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          created_by?: string | null;
          name: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          created_by?: string | null;
          name?: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      workflow_steps: {
        Row: {
          id: string;
          organization_id: string;
          workflow_id: string;
          step_order: number;
          name: string;
          ai_employee_id: string;
          prompt_template: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          workflow_id: string;
          step_order: number;
          name: string;
          ai_employee_id: string;
          prompt_template: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          workflow_id?: string;
          step_order?: number;
          name?: string;
          ai_employee_id?: string;
          prompt_template?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      workflow_runs: {
        Row: {
          id: string;
          organization_id: string;
          workflow_id: string;
          triggered_by: string | null;
          input: string;
          status: "running" | "completed" | "failed";
          final_output: string | null;
          error: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          workflow_id: string;
          triggered_by?: string | null;
          input?: string;
          status?: "running" | "completed" | "failed";
          final_output?: string | null;
          error?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          workflow_id?: string;
          triggered_by?: string | null;
          input?: string;
          status?: "running" | "completed" | "failed";
          final_output?: string | null;
          error?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
      };
      workflow_step_runs: {
        Row: {
          id: string;
          organization_id: string;
          workflow_run_id: string;
          workflow_step_id: string;
          step_order: number;
          status: "pending" | "running" | "completed" | "failed";
          prompt: string | null;
          output: string | null;
          error: string | null;
          started_at: string | null;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          workflow_run_id: string;
          workflow_step_id: string;
          step_order: number;
          status?: "pending" | "running" | "completed" | "failed";
          prompt?: string | null;
          output?: string | null;
          error?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          workflow_run_id?: string;
          workflow_step_id?: string;
          step_order?: number;
          status?: "pending" | "running" | "completed" | "failed";
          prompt?: string | null;
          output?: string | null;
          error?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
        };
      };
      teams: {
        Row: {
          id: string;
          organization_id: string;
          created_by: string | null;
          name: string;
          description: string | null;
          lead_ai_employee_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          created_by?: string | null;
          name: string;
          description?: string | null;
          lead_ai_employee_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          created_by?: string | null;
          name?: string;
          description?: string | null;
          lead_ai_employee_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      team_members: {
        Row: {
          id: string;
          organization_id: string;
          team_id: string;
          ai_employee_id: string;
          role_note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          team_id: string;
          ai_employee_id: string;
          role_note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          team_id?: string;
          ai_employee_id?: string;
          role_note?: string | null;
          created_at?: string;
        };
      };
      team_conversations: {
        Row: {
          id: string;
          organization_id: string;
          team_id: string;
          created_by: string | null;
          title: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          team_id: string;
          created_by?: string | null;
          title?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          team_id?: string;
          created_by?: string | null;
          title?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      team_messages: {
        Row: {
          id: string;
          organization_id: string;
          team_conversation_id: string;
          role: "user" | "assistant";
          content: string;
          responded_by_employee_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          team_conversation_id: string;
          role: "user" | "assistant";
          content: string;
          responded_by_employee_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          team_conversation_id?: string;
          role?: "user" | "assistant";
          content?: string;
          responded_by_employee_id?: string | null;
          created_at?: string;
        };
      };
      marketplace_listings: {
        Row: {
          id: string;
          organization_id: string;
          created_by: string | null;
          publisher_name: string;
          name: string;
          description: string | null;
          instructions: string | null;
          provider: AiProvider;
          model: string;
          temperature: number;
          install_count: number;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          created_by?: string | null;
          publisher_name: string;
          name: string;
          description?: string | null;
          instructions?: string | null;
          provider: AiProvider;
          model: string;
          temperature: number;
          install_count?: number;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          created_by?: string | null;
          publisher_name?: string;
          name?: string;
          description?: string | null;
          instructions?: string | null;
          provider?: AiProvider;
          model?: string;
          temperature?: number;
          install_count?: number;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      organization_wallets: {
        Row: {
          organization_id: string;
          balance_credits: number;
          updated_at: string;
        };
        Insert: {
          organization_id: string;
          balance_credits?: number;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          balance_credits?: number;
          updated_at?: string;
        };
      };
      payment_orders: {
        Row: {
          id: string;
          organization_id: string;
          created_by: string | null;
          gateway: "stripe" | "manual_bank_transfer";
          credits_purchased: number;
          amount_cents: number;
          currency: string;
          status: "pending" | "paid" | "failed" | "awaiting_verification" | "verified" | "rejected";
          stripe_checkout_session_id: string | null;
          bank_transfer_reference: string | null;
          admin_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          created_by?: string | null;
          gateway: "stripe" | "manual_bank_transfer";
          credits_purchased: number;
          amount_cents: number;
          currency?: string;
          status?: "pending" | "paid" | "failed" | "awaiting_verification" | "verified" | "rejected";
          stripe_checkout_session_id?: string | null;
          bank_transfer_reference?: string | null;
          admin_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          created_by?: string | null;
          gateway?: "stripe" | "manual_bank_transfer";
          credits_purchased?: number;
          amount_cents?: number;
          currency?: string;
          status?: "pending" | "paid" | "failed" | "awaiting_verification" | "verified" | "rejected";
          stripe_checkout_session_id?: string | null;
          bank_transfer_reference?: string | null;
          admin_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      credit_ledger: {
        Row: {
          id: string;
          organization_id: string;
          amount: number;
          reason: "chat" | "workflow_step" | "team_chat";
          reference_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          amount: number;
          reason: "chat" | "workflow_step" | "team_chat";
          reference_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          amount?: number;
          reason?: "chat" | "workflow_step" | "team_chat";
          reference_id?: string | null;
          created_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          organization_id: string | null;
          type: NotificationType;
          title: string;
          body: string | null;
          link: string | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          organization_id?: string | null;
          type: NotificationType;
          title: string;
          body?: string | null;
          link?: string | null;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          organization_id?: string | null;
          type?: NotificationType;
          title?: string;
          body?: string | null;
          link?: string | null;
          is_read?: boolean;
          created_at?: string;
        };
      };
      api_keys: {
        Row: {
          id: string;
          organization_id: string;
          created_by: string | null;
          name: string;
          key_prefix: string;
          key_hash: string;
          is_active: boolean;
          last_used_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          created_by?: string | null;
          name: string;
          key_prefix: string;
          key_hash: string;
          is_active?: boolean;
          last_used_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          created_by?: string | null;
          name?: string;
          key_prefix?: string;
          key_hash?: string;
          is_active?: boolean;
          last_used_at?: string | null;
          created_at?: string;
        };
      };
      organization_invitations: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          role: OrgRole;
          invited_by: string | null;
          status: "pending" | "accepted" | "revoked";
          created_at: string;
          accepted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          email: string;
          role?: OrgRole;
          invited_by?: string | null;
          status?: "pending" | "accepted" | "revoked";
          created_at?: string;
          accepted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          email?: string;
          role?: OrgRole;
          invited_by?: string | null;
          status?: "pending" | "accepted" | "revoked";
          created_at?: string;
          accepted_at?: string | null;
        };
      };
      platform_admins: {
        Row: {
          user_id: string;
          granted_by: string | null;
          granted_at: string;
        };
        Insert: {
          user_id: string;
          granted_by?: string | null;
          granted_at?: string;
        };
        Update: {
          user_id?: string;
          granted_by?: string | null;
          granted_at?: string;
        };
      };
    };
    Functions: {
      has_org_api_key: {
        Args: { target_org_id: string; target_provider: string };
        Returns: boolean;
      };
      increment_marketplace_install_count: {
        Args: { target_listing_id: string };
        Returns: undefined;
      };
      create_api_key: {
        Args: { target_org_id: string; key_name: string };
        Returns: { id: string; plaintext_key: string }[];
      };
      create_organization: {
        Args: { org_name: string };
        Returns: string;
      };
      is_platform_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      list_pending_bank_transfers: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          organization_id: string;
          organization_name: string;
          credits_purchased: number;
          amount_cents: number;
          currency: string;
          bank_transfer_reference: string | null;
          created_at: string;
        }[];
      };
      verify_bank_transfer: {
        Args: { target_order_id: string; approve: boolean; note?: string | null };
        Returns: undefined;
      };
      get_platform_stats: {
        Args: Record<PropertyKey, never>;
        Returns: {
          total_organizations: number;
          total_users: number;
          total_ai_employees: number;
          total_marketplace_listings: number;
          total_credits_purchased: number;
          total_credits_spent: number;
          total_revenue_cents: number;
        }[];
      };
      admin_unpublish_listing: {
        Args: { target_listing_id: string };
        Returns: undefined;
      };
    };
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export type OrganizationMember = Database["public"]["Tables"]["organization_members"]["Row"];
export type AiEmployee = Database["public"]["Tables"]["ai_employees"]["Row"];
export type Conversation = Database["public"]["Tables"]["conversations"]["Row"];
export type Message = Database["public"]["Tables"]["messages"]["Row"];
export type KnowledgeSource = Database["public"]["Tables"]["knowledge_sources"]["Row"];
export type AiEmployeeKnowledgeSource =
  Database["public"]["Tables"]["ai_employee_knowledge_sources"]["Row"];
export type EmployeeMemory = Database["public"]["Tables"]["employee_memories"]["Row"];
export type Workflow = Database["public"]["Tables"]["workflows"]["Row"];
export type WorkflowStep = Database["public"]["Tables"]["workflow_steps"]["Row"];
export type WorkflowRun = Database["public"]["Tables"]["workflow_runs"]["Row"];
export type WorkflowStepRun = Database["public"]["Tables"]["workflow_step_runs"]["Row"];
export type Team = Database["public"]["Tables"]["teams"]["Row"];
export type TeamMember = Database["public"]["Tables"]["team_members"]["Row"];
export type TeamConversation = Database["public"]["Tables"]["team_conversations"]["Row"];
export type TeamMessage = Database["public"]["Tables"]["team_messages"]["Row"];
export type MarketplaceListing = Database["public"]["Tables"]["marketplace_listings"]["Row"];
export type OrganizationWallet = Database["public"]["Tables"]["organization_wallets"]["Row"];
export type PaymentOrder = Database["public"]["Tables"]["payment_orders"]["Row"];
export type CreditLedgerEntry = Database["public"]["Tables"]["credit_ledger"]["Row"];
export type Notification = Database["public"]["Tables"]["notifications"]["Row"];
export type ApiKey = Database["public"]["Tables"]["api_keys"]["Row"];
export type OrganizationInvitation =
  Database["public"]["Tables"]["organization_invitations"]["Row"];
export type PlatformAdmin = Database["public"]["Tables"]["platform_admins"]["Row"];
