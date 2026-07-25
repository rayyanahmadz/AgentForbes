/**
 * @agentforge/types
 *
 * Shared TypeScript types used across apps/web, apps/admin, and apps/mobile.
 * This package only holds cross-cutting primitives for now. Domain types
 * (AI Employees, Organizations, Billing, etc.) are added in their own
 * phases so this package grows alongside the features that need it.
 */

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export type Nullable<T> = T | null;

export interface ApiResult<T> {
  data: T | null;
  error: string | null;
}

export type OrgRole = "owner" | "admin" | "member";

export interface Organization extends BaseEntity {
  name: string;
  slug: string;
  ownerId: string;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: OrgRole;
  createdAt: string;
}

export type AiProvider = "anthropic" | "openai" | "gemini" | "openrouter" | "ollama" | "lmstudio";

export interface AiEmployee extends BaseEntity {
  organizationId: string;
  createdBy: string | null;
  name: string;
  description: string | null;
  instructions: string | null;
  provider: AiProvider;
  model: string;
  temperature: number;
  isActive: boolean;
}

export interface Conversation extends BaseEntity {
  organizationId: string;
  aiEmployeeId: string;
  createdBy: string;
  title: string;
}

export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  organizationId: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

export type KnowledgeSourceType = "text" | "file";

export interface KnowledgeSource extends BaseEntity {
  organizationId: string;
  createdBy: string | null;
  name: string;
  description: string | null;
  sourceType: KnowledgeSourceType;
  filePath: string | null;
  fileName: string | null;
  mimeType: string | null;
  content: string;
  charCount: number;
}

export interface EmployeeMemory extends BaseEntity {
  organizationId: string;
  aiEmployeeId: string;
  createdBy: string | null;
  content: string;
}

export interface Workflow extends BaseEntity {
  organizationId: string;
  createdBy: string | null;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface WorkflowStep {
  id: string;
  organizationId: string;
  workflowId: string;
  stepOrder: number;
  name: string;
  aiEmployeeId: string;
  promptTemplate: string;
  createdAt: string;
  updatedAt: string;
}

export type WorkflowRunStatus = "running" | "completed" | "failed";

export interface WorkflowRun {
  id: string;
  organizationId: string;
  workflowId: string;
  triggeredBy: string | null;
  input: string;
  status: WorkflowRunStatus;
  finalOutput: string | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

export type WorkflowStepRunStatus = "pending" | "running" | "completed" | "failed";

export interface WorkflowStepRun {
  id: string;
  organizationId: string;
  workflowRunId: string;
  workflowStepId: string;
  stepOrder: number;
  status: WorkflowStepRunStatus;
  prompt: string | null;
  output: string | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface Team extends BaseEntity {
  organizationId: string;
  createdBy: string | null;
  name: string;
  description: string | null;
  leadAiEmployeeId: string;
}

export interface TeamMember {
  id: string;
  organizationId: string;
  teamId: string;
  aiEmployeeId: string;
  roleNote: string | null;
  createdAt: string;
}

export interface TeamConversation {
  id: string;
  organizationId: string;
  teamId: string;
  createdBy: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export type TeamMessageRole = "user" | "assistant";

export interface TeamMessage {
  id: string;
  organizationId: string;
  teamConversationId: string;
  role: TeamMessageRole;
  content: string;
  respondedByEmployeeId: string | null;
  createdAt: string;
}

export interface MarketplaceListing extends BaseEntity {
  organizationId: string;
  createdBy: string | null;
  publisherName: string;
  name: string;
  description: string | null;
  instructions: string | null;
  provider: AiProvider;
  model: string;
  temperature: number;
  installCount: number;
  isPublished: boolean;
}

export interface OrganizationWallet {
  organizationId: string;
  balanceCredits: number;
  updatedAt: string;
}

export type PaymentGateway = "stripe" | "manual_bank_transfer";
export type PaymentOrderStatus =
  | "pending"
  | "paid"
  | "failed"
  | "awaiting_verification"
  | "verified"
  | "rejected";

export interface PaymentOrder {
  id: string;
  organizationId: string;
  createdBy: string | null;
  gateway: PaymentGateway;
  creditsPurchased: number;
  amountCents: number;
  currency: string;
  status: PaymentOrderStatus;
  stripeCheckoutSessionId: string | null;
  bankTransferReference: string | null;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CreditChargeReason = "chat" | "workflow_step" | "team_chat";

export interface CreditLedgerEntry {
  id: string;
  organizationId: string;
  amount: number;
  reason: CreditChargeReason;
  referenceId: string | null;
  createdAt: string;
}

export type NotificationType =
  | "low_credits"
  | "workflow_run_completed"
  | "workflow_run_failed"
  | "marketplace_install"
  | "bank_transfer_submitted"
  | "added_to_organization"
  | "bank_transfer_verified"
  | "bank_transfer_rejected";

export interface Notification {
  id: string;
  userId: string;
  organizationId: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface ApiKey {
  id: string;
  organizationId: string;
  createdBy: string | null;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

export type InvitationStatus = "pending" | "accepted" | "revoked";

export interface OrganizationInvitation {
  id: string;
  organizationId: string;
  email: string;
  role: OrgRole;
  invitedBy: string | null;
  status: InvitationStatus;
  createdAt: string;
  acceptedAt: string | null;
}

export interface PlatformAdmin {
  userId: string;
  grantedBy: string | null;
  grantedAt: string;
}
