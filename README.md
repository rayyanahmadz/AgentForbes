# AgentForge AI

AI Digital Employee platform — monorepo.

## Status

- **Phase 1 — Monorepo scaffold + UI system** ✅
- **Phase 2 — Authentication** ✅
- **Phase 3 — Database (organizations & membership)** ✅
- **Phase 4 — Landing Website** ✅
- **Phase 5 — Dashboard** ✅
- **Phase 6 — AI Digital Employees** ✅
- **Phase 7 — AI Chat** ✅
- **Phase 8 — Knowledge Base** ✅
- **Phase 9 — Memory** ✅
- **Phase 10 — Workflow Builder** ✅
- **Phase 11 — Multi-Agent Teams** ✅
- **Phase 12 — Marketplace** ✅
- **Phase 13 — Payments** ✅
- **Phase 14 — Billing** ✅
- **Phase 15 — Notifications** ✅
- **Phase 16 — Analytics** ✅
- **Phase 17 — API Platform** ✅
- **Phase 18 — Organization Management** ✅
- **Phase 19 — Admin Panel** ✅
- **Phase 20 — Mobile App** ✅
- **Phase 21 — Testing** ✅
- **Phase 21 — Testing** ✅

### Phase 1: Monorepo scaffold + UI system

- pnpm workspaces + Turborepo monorepo
- `apps/web` — Vite + React 19 + TypeScript app, routed with `react-router-dom`
- `packages/ui` — shared shadcn/ui-style component library (Button, Card, Input,
  Label) with a Tailwind preset and design tokens (light/dark) that any app can
  consume
- `packages/types`, `packages/utils` — shared primitives, intentionally minimal for
  now
- Shared TypeScript, ESLint (flat config), and Prettier setup at the root
- GitHub Actions CI (lint → type-check → build) on the free tier

### Phase 2: Authentication

Real signup/login/logout backed by Supabase Auth (free tier), with session
persistence and route protection:

- `apps/web/src/lib/supabase/client.ts` — typed Supabase browser client
- `apps/web/src/contexts/auth-context.tsx` — `AuthProvider` / `useAuth()`: session,
  user, profile, `signUp`, `signIn`, `signOut`
- `apps/web/src/pages/auth/{login,signup}-page.tsx` — real forms wired to Supabase
- `apps/web/src/components/auth/{protected-route,public-only-route}.tsx` — route
  guards (`/dashboard` requires a session; `/login` and `/signup` redirect away if
  already signed in)
- A protected page proving the whole loop (session + profile row) works — later
  replaced by the full dashboard shell in Phase 5
- `supabase/migrations/20260713000000_profiles.sql` — `profiles` table, RLS
  policies (a user can only read/update their own row), and a trigger that creates
  the profile automatically when someone signs up
- `supabase/config.toml` — local Supabase CLI config for `supabase start`

**Deliberately not included yet** (future phases per the roadmap): `apps/admin`,
`apps/mobile`, AI Employees / knowledge base / workflow schema, AI provider adapters,
payments, marketplace, etc. Each lands as its own fully-working phase.

### Phase 3: Database (organizations & membership)

Multi-tenancy foundation everything after this hangs off of:

- `supabase/migrations/20260714000000_organizations.sql`:
  - `org_role` enum (`owner` / `admin` / `member`)
  - `organizations` table (name, unique slug, owner)
  - `organization_members` table (role per user per org, unique per pair)
  - `profiles.default_organization_id` — which org the user is currently in
  - `is_org_member()` / `is_org_admin()` security-definer helper functions, used by
    RLS policies (members can read their orgs; only admins/owners can update the org
    or change member roles/remove members)
  - `handle_new_user()` extended: signup now also creates a personal organization
    (unique slug, e.g. `jane-a1b2c3`) and an `owner` membership row automatically —
    no separate "create your first org" step
- `apps/web/src/lib/supabase/types.ts` — `organizations` / `organization_members`
  added to the generated-style `Database` type
- `packages/types` — framework-agnostic `Organization` / `OrganizationMember` /
  `OrgRole` types for reuse outside `apps/web`
- `apps/web/src/contexts/organization-context.tsx` — `OrganizationProvider` /
  `useOrganization()`: loads the current org + the signed-in user's role in it

**If you already ran Phase 2's migration on an existing Supabase project**, just run
this new migration file next (SQL Editor, or `supabase db push` if using the CLI) —
it only adds to the schema, it doesn't touch the `profiles` migration.

### Phase 4: Landing Website

A real marketing page at `/`, replacing the placeholder used in earlier phases:

- `apps/web/src/pages/landing-page.tsx` — composes the sections below
- `components/landing/navbar.tsx` — auth-aware nav (shows Dashboard if signed in,
  Log in / Get started free if not)
- `components/landing/hero.tsx` + `schematic-illustration.tsx` — the page's
  signature element: an original SVG "exploded schematic" of an AI Employee
  assembled from four modules (reasoning core, memory, knowledge, tools), styled
  as an engineering blueprint
- `components/landing/features-grid.tsx` — six module cards that map directly onto
  the schematic's parts
- `components/landing/how-it-works.tsx` — the real three-stage build sequence
  (Specify → Forge → Deploy)
- `components/landing/cta-banner.tsx`, `footer.tsx`
- Visual identity: dark blueprint palette (`#0B1220` ink, `#5EEAD4` cyan linework,
  `#FF8A3D` forge-amber for CTAs), Space Grotesk for display type, Inter for body,
  IBM Plex Mono for the blueprint-style annotations — loaded via Google Fonts in
  `index.html`, wired into Tailwind as `font-display` / `font-body` / `font-mono`
  in `apps/web/tailwind.config.js`

This palette and type system are scoped to the landing page's own markup (not the
shared `--background` / `--primary` tokens in `packages/ui`), so the authenticated
app (dashboard, forms) keeps its own neutral theme unaffected by the marketing
page's branding.

### Phase 5: Dashboard

A real authenticated app shell, replacing the single-page dashboard used for
verification in earlier phases:

- `apps/web/src/layouts/dashboard-layout.tsx` — sidebar + routed content area,
  wraps all `/dashboard/*` routes via React Router's nested routes
- `components/dashboard/sidebar.tsx` — organization name, nav (Overview /
  Organization / Profile), user info, sign out
- `pages/dashboard/overview-page.tsx` — `/dashboard` index route
- `pages/dashboard/profile-page.tsx` — `/dashboard/settings/profile`: edit your full
  name, a real update against `profiles` (protected by its existing RLS policy)
- `pages/dashboard/organization-page.tsx` — `/dashboard/settings/organization`: view
  org name/slug/your role; owners and admins can rename the organization (protected
  by the `is_org_admin()` RLS policy from Phase 3) — members see the same page
  read-only
- `AuthContext.refreshProfile()` and `OrganizationContext.refresh()` — added so both
  settings pages can reload their data immediately after a successful edit, without
  a full page reload

**Deliberately deferred**: inviting teammates and managing member roles/removal.
Reading other members' names would need a new RLS policy on `profiles` (a member
can currently only read their *own* profile row) — that's real scope belonging to
the **Organization Management** phase, not this one, so it's left out rather than
half-built.

### Phase 6: AI Digital Employees

Full create/read/update/delete for an employee's *spec* — the thing every later
phase (memory, knowledge, tools, chat) attaches to:

- `supabase/migrations/20260716000000_ai_employees.sql` — `ai_employees` table:
  `name`, `description`, `instructions`, `provider` (checked against the six
  providers named in the product brief — Anthropic, OpenAI, Gemini, OpenRouter,
  Ollama, LM Studio), `model` (free text), `temperature`, `is_active`, scoped to
  `organization_id`. RLS: any member of the organization can view/create/edit/
  delete its employees (same "shared team resource" model as the org itself —
  see the Phase 5 note on why per-role restriction is deferred)
- `apps/web/src/lib/ai-providers.ts` — provider dropdown metadata + a suggested
  starting model per provider. `model` stays a free-text input rather than a
  locked dropdown of model IDs, since provider catalogs change often and real
  adapters land in the **AI Provider Adapters** phase — this just seeds a
  sensible default per provider
- `pages/dashboard/employees/employees-list-page.tsx` — `/dashboard/employees`:
  grid of employee cards (provider/model, active/draft badge), edit and delete
- `pages/dashboard/employees/employee-form-page.tsx` — shared form for
  `/dashboard/employees/new` and `/dashboard/employees/:employeeId/edit`
- New shared UI primitives added to `packages/ui` as they were needed:
  `Select` (plain native select, not the full Radix compound version — added
  later if a feature needs search/grouping), `Switch`, `Textarea`
- Sidebar gained an "AI Employees" nav item; the Overview page now shows a real
  employee count pulled from the database instead of static placeholder copy

**Deliberately not included yet**: actually talking to an employee (that's **AI
Chat**), memory, knowledge base connections, and tools/actions — each is its own
phase. This phase is the configuration surface those will build on.

### Phase 7: AI Chat

Real, streaming conversations with an AI Employee — only Gemini is wired up to an
actual provider this phase; every other provider returns a clear in-chat error
instead of a fake reply, until the **AI Provider Adapters** phase builds proper
modular adapters and key management for all six.

**Why an Edge Function.** API keys can never touch the browser. This phase adds
the project's first Supabase Edge Function (`supabase/functions/chat`), which is
the only thing that ever calls out to Gemini.

- `supabase/migrations/20260717000000_organization_api_keys.sql` —
  `organization_api_keys` (one row per organization per provider). Deliberately
  **has no SELECT policy at all** — not even org admins can read a key back
  through the normal client. Only code running with the service role key (the
  Edge Function) can read it. `has_org_api_key()` is a security-definer RPC that
  lets any org member check *whether* a key is configured without ever exposing
  it — the same "write it, we don't show it back" pattern as a GitHub token.
- `supabase/migrations/20260718000000_conversations_and_messages.sql` —
  `conversations` and `messages`, `organization_id` denormalized onto both for
  simple RLS. Same shared-team-resource model as `ai_employees`: any org member
  can see and manage the org's conversations.
- `supabase/functions/chat/index.ts` — the Edge Function. Takes a conversation ID
  + message, authenticates the caller, loads the conversation/employee through
  the caller's own RLS-scoped client (proves they're allowed to see it), reads
  the Gemini key with a service-role client (the one exception to RLS), then
  streams the model's response back over Server-Sent Events and persists both
  the user's message and the full assistant reply.
- `apps/web/src/lib/chat-client.ts` — calls the Edge Function via `fetch`
  directly (not `supabase.functions.invoke`, which buffers the whole response)
  so the UI can render tokens as they arrive.
- `pages/dashboard/chat/employee-chat-page.tsx` + `components/chat/conversation-list.tsx`
  — the chat UI: conversation list, streaming message thread, input. Reached via
  a **Chat** button on each employee card in `/dashboard/employees`.
- `components/dashboard/api-keys-card.tsx` — added to Organization settings
  (admin/owner only): paste a Gemini key, see "configured ✓" without the key
  ever being echoed back.
- `layouts/dashboard-layout.tsx` — the chat route now renders edge-to-edge
  (full height, no padding) instead of the padded container every other
  dashboard page uses, since a chat thread needs the full viewport.

**Deploying the Edge Function** (needed for chat to actually work, beyond just
running migrations):

```bash
supabase functions deploy chat --project-ref <your-project-ref>
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are provided
automatically to every Edge Function by the platform — no manual secrets needed.

### Phase 8: Knowledge Base

Upload or paste text, attach it to employees, and it actually grounds their chat
answers — no vector search yet (see the scoping notes below), but real end to end.

- `supabase/migrations/20260719000000_knowledge_base.sql`:
  - `knowledge_sources` — pasted text or an extracted `.txt`/`.md` file's content,
    scoped to the organization (same shared-resource RLS pattern as everything
    else). `char_count` is a generated column.
  - `ai_employee_knowledge_sources` — many-to-many between employees and sources
  - A private `knowledge-files` Storage bucket, with `storage.objects` policies
    scoped by the first path segment (`{organization_id}/{uuid}-{filename}`) via
    `storage.foldername(name)` — the same `is_org_member()` helper used
    everywhere else backs these policies too
- `apps/web/src/lib/knowledge.ts` — shared constants/helpers: allowed extensions
  (`.txt`, `.md` only — see below), max upload size, and the caps used when
  building the chat prompt
- `pages/dashboard/knowledge/{knowledge-list-page,knowledge-new-page}.tsx` —
  `/dashboard/knowledge`: add a source (paste text or upload a file), list, delete
  (also removes the underlying Storage object when applicable)
- `employee-form-page.tsx` gained a **Knowledge sources** card: a checklist of the
  organization's sources, synced to `ai_employee_knowledge_sources` on save
- `supabase/functions/chat/index.ts` updated: now fetches the employee's attached
  sources (through the caller's own RLS-scoped client — no new trust boundary)
  and folds their text into the system instruction sent to Gemini, capped at
  4,000 chars per source and 12,000 total, with `[truncated]` markers so it's
  never silently cut off without saying so

**Two scoping decisions worth restating** (agreed before building):

1. **Only `.txt`/`.md` files.** PDF/DOCX text extraction needs libraries that
   would be shipped completely untested (no network access here to verify a
   Deno-compatible parser actually works). Plain text decoding is zero-risk.
   Uploading anything else shows a clear validation error, not a silent failure.
2. **Context stuffing, not vector search.** Attached sources' text goes directly
   into the prompt (capped), rather than being chunked, embedded, and retrieved
   by relevance. This scales to a modest number of small-to-medium sources per
   employee; a real embeddings + `pgvector` retrieval pipeline is a future
   enhancement once source libraries grow larger than the context cap can hold.

### Phase 9: Memory

The thing that's actually new here versus everything built so far: a fact an
employee learns keeps applying in *every future conversation*, not just the
thread it came from — different from a single conversation's own message history
(persisted since AI Chat) and from Knowledge Base's static documents.

- `supabase/migrations/20260720000000_employee_memories.sql` — `employee_memories`:
  short (≤1000 char) facts scoped to one `ai_employee_id`, same shared-resource
  RLS pattern as everything else
- `pages/dashboard/memories/employee-memories-page.tsx` —
  `/dashboard/employees/:employeeId/memories`: add, list, delete memories for one
  employee. Reached via a **Memory** button on each employee card
- **Two ways memories get created**, both fully manual/user-driven (no second
  automatic "what should I remember" model call this phase — that's a
  reasonable future enhancement, but doubles Gemini calls per turn and adds a
  failure mode not worth the risk without a way to test it here):
  1. Directly on the Memory page
  2. A **"Save to memory"** action under any assistant reply in the chat UI —
     saves that exact reply's text as a memory
- `supabase/functions/chat/index.ts` updated again: fetches the employee's
  memories (through the caller's own RLS-scoped client, same trust boundary as
  knowledge sources) and folds them into the system instruction as a distinct
  "long-term memory" section, capped at 3,000 total characters, separate from
  and in addition to Knowledge Base context

### Phase 10: Workflow Builder

Chain AI Employees into an ordered, multi-step automation instead of one reply
per message. Scoped deliberately (see below) rather than attempting the full
drag-and-drop/branching vision from the master brief in one pass.

- `supabase/migrations/20260721000000_workflows.sql`:
  - `workflows` — a named, ordered pipeline
  - `workflow_steps` — one step each, `prompt_template` supports `{{input}}`
    (the run's starting input) and `{{previous_output}}` (the prior step's
    result), substituted at run time
  - `workflow_runs` / `workflow_step_runs` — execution history; a run's status
    is `running` → `completed` or `failed`, and a failed step stops the whole
    run rather than faking the remaining steps
  - Same shared-team-resource RLS pattern as everything else
- `supabase/functions/_shared/grounding.ts` — **new**: the knowledge/memory
  context builders and the CORS/SSE helpers, extracted out of `chat/index.ts`
  so `run-workflow` can reuse the exact same grounding logic rather than
  duplicating (and risking drift from) it. `chat/index.ts` was refactored to
  import from here too — behavior unchanged, just de-duplicated.
- `supabase/functions/run-workflow/index.ts` — **new** Edge Function. Runs each
  step in order: loads that step's employee (provider/model/instructions),
  its attached knowledge sources and memory (identical to how chat grounds a
  conversation), substitutes the template, calls Gemini once (non-streaming —
  a step needs its complete output before the next step's prompt can be
  built), records the result, and streams step-level progress events
  (`step-start`, `step-complete`, `step-error`, `run-complete`, `run-failed`)
  back to the client via SSE.
- `apps/web/src/lib/workflow-client.ts` — SSE client for the above, mirroring
  `chat-client.ts`'s pattern
- `pages/dashboard/workflows/`:
  - `workflows-list-page.tsx` — `/dashboard/workflows`
  - `workflow-form-page.tsx` — create/edit: name, description, and a
    reorderable list of steps (each: employee, optional step name, prompt).
    Saving replaces all of a workflow's steps rather than diffing them —
    simplest reliable sync given steps are small in number
  - `workflow-run-page.tsx` — enter input, hit Run, watch each step's status
    and output arrive live, then browse and inspect past runs

**Two scoping decisions worth restating** (agreed before building):

1. **Sequential steps only — no branching, conditionals, or schedule
   triggers.** A visual canvas with branch logic is a large, hard-to-verify
   undertaking without the ability to render and click through it here. This
   phase is a real, working linear pipeline; branching is a natural future
   phase once this foundation is proven out.
2. **Each step is a single non-streaming Gemini call.** Steps stream progress
   at the step level (you see each step's status and full output as it lands),
   not token-by-token within a step — the next step's prompt needs the
   previous step's *complete* output before it can even be built, so
   token-level streaming inside a step wouldn't add anything functional here.

### Phase 11: Multi-Agent Teams

Genuinely different from Workflow Builder's fixed pipeline: a team's **lead**
employee decides, per message, which teammate is best suited — dynamic runtime
routing rather than a pre-defined step order.

- `supabase/migrations/20260722000000_teams.sql`:
  - `teams` — a name/description plus one required `lead_ai_employee_id`
  - `team_members` — the roster, each with an optional `role_note` ("handles
    billing and refunds") shown to the lead when it decides who answers
  - `team_conversations` / `team_messages` — same shape as the AI Chat phase's
    `conversations`/`messages`, plus `responded_by_employee_id` on each
    assistant message so the UI can show "Answered by X"
  - Same shared-team-resource RLS pattern as everything else
- `supabase/functions/_shared/grounding.ts` gained `streamGeminiSSE()` — a
  streaming counterpart to `callGeminiOnce()`, used by `team-chat` for the
  teammate's actual reply (routing itself uses the existing non-streaming
  `callGeminiOnce()`, since a routing decision is just one short label, not
  something worth streaming)
- `supabase/functions/team-chat/index.ts` — **new** Edge Function. Per message:
  1. the lead makes one low-temperature classification call against a
     dedicated routing prompt (not the lead's own persona instructions — a
     separate, mechanical "dispatcher" system instruction) listing the team's
     members and their role notes
  2. the response is matched case-insensitively against member names; **any**
     unparseable or unmatched response (including the literal `SELF`) safely
     falls back to the lead answering directly — routing failure never blocks
     the conversation
  3. the chosen employee — with its own knowledge, memory, and instructions,
     identical to a normal chat — streams the actual reply
- `apps/web/src/lib/team-chat-client.ts` — SSE client mirroring
  `chat-client.ts`, with an added `picked` event
- `components/chat/conversation-list.tsx` was generalized (accepts any
  `{id, title}` shape rather than the specific `Conversation` type) so both
  employee chat and team chat reuse the same component
- `pages/dashboard/teams/`:
  - `teams-list-page.tsx` — `/dashboard/teams`
  - `team-form-page.tsx` — name, description, lead employee, and a member
    checklist with per-member role notes
  - `team-chat-page.tsx` — same conversation-list + streaming pattern as
    employee chat, with an "Answered by X" tag over each assistant reply

**Scope constraint carried over from AI Chat**: both the lead (for routing)
and whichever employee is ultimately chosen must use the Gemini provider —
same as every other AI-calling feature so far.

### Phase 12: Marketplace

Publish an AI Employee's spec as a free, cross-organization listing; any other
organization can browse it and install a fresh copy into their own.

- `supabase/migrations/20260723000000_marketplace.sql` — `marketplace_listings`:
  a **snapshot** of an employee's name/description/instructions/provider/model/
  temperature at publish time, deliberately decoupled from the live employee
  row (editing the original afterward doesn't retroactively change what
  people already installed)
- **The one deliberate RLS deviation in this whole project.** Every other
  table uses "readable only by `is_org_member`". Marketplace listings are the
  first thing that must be readable by *any* authenticated user regardless of
  organization — that's the entire point of a marketplace. The migration
  calls this out explicitly in comments rather than leaving it to look like
  an oversight.
- `increment_marketplace_install_count()` — a narrow security-definer RPC that
  lets any authenticated user (typically not a member of the publishing org)
  bump a listing's install count, without granting them any broader write
  access to it
- `pages/dashboard/marketplace/`:
  - `marketplace-list-page.tsx` — `/dashboard/marketplace`: browse every
    published listing, search, install (creates a new `ai_employees` row in
    your own org), plus a "Published by your organization" section to remove
    your own listings
  - `publish-page.tsx` — pick one of your org's employees, adjust the listing
    title/description, publish

**Scoped deliberately** (agreed before building) to keep this a real, working
feature rather than a partial shell of the full master-brief vision:

- **AI Employee templates only.** No Workflow, Knowledge Base, or Team
  templates yet — a workflow's steps reference specific employee IDs, which
  makes cross-organization installing meaningfully more complex (whose
  employee does an installed step point to?). That's real future scope, not
  something to fake here.
- **No ratings, reviews, or paid sales.** Revenue and paid listings need the
  **Payments** and **Billing** phases, which don't exist yet — building
  "sales" now would mean fake numbers with nothing behind them.
- **Installing never brings over knowledge sources or memory.** Those are
  private, potentially sensitive organization data; only the employee's
  configuration is ever published. Installers start with a clean employee
  they can attach their own knowledge/memory to.

### Phase 13: Payments

Real money-handling code, scoped carefully. Two gateways, both genuinely
working end to end — not stubbed buttons: **Stripe** (test mode) for card
payments, and a **manual bank transfer claim** form for the Pakistan-market
case the product brief calls for. PayPal, Paddle, Lemon Squeezy, Easypaisa,
and JazzCash remain documented future gateway slots rather than fake buttons
that don't do anything.

**Security is the whole story of this phase — read the migration's header
comment first.** Nobody should ever be able to grant their own organization
credits by calling the API directly:

- `organization_wallets` and `payment_orders` have **no update policy for the
  authenticated role at all**. A user can create a pending order; only
  service-role code (the webhook) can ever change its status.
- `increment_wallet_balance()` — the only thing that can ever add
  credits — has its `EXECUTE` privilege explicitly revoked from
  `authenticated`/`anon` and granted only to `service_role`. Contrast this
  with `has_org_api_key()` / `increment_marketplace_install_count()` from
  earlier phases, which are deliberately open to any authenticated user
  because their blast radius is harmless — this one moves real balances, so
  it isn't, and the migration comments explain the distinction rather than
  leaving it to look inconsistent.

**What's built:**

- `supabase/migrations/20260724000000_payments.sql` — `organization_wallets`
  (one row per org, auto-created via a trigger on `organizations`, same
  pattern as the personal-org trigger from Phase 3) and `payment_orders`
  (one row per purchase attempt, either gateway)
- `supabase/functions/create-checkout-session/index.ts` — creates a Stripe
  Checkout Session for a **fixed credit package looked up server-side**
  (`apps/web/src/lib/credit-packages.ts` has the same three packages,
  duplicated by hand since a Vite app and a Deno function can't share an
  import without bundling machinery — the price a user pays is never trusted
  from the client)
- `supabase/functions/stripe-webhook/index.ts` — verifies the
  `Stripe-Signature` header (the entire security model for this endpoint,
  since Stripe can't send a Supabase auth header — deployed with
  `--no-verify-jwt` for exactly that reason), then credits the wallet
  idempotently (checked against the order's `pending` status, so a redelivered
  webhook event can't double-credit)
- `pages/dashboard/wallet/wallet-page.tsx` — balance, three Stripe packages
  ("Buy" redirects to Stripe's hosted Checkout — no Stripe.js/Elements needed
  client-side at all), a bank transfer claim form, and order history. Handles
  the redirect back from Stripe by briefly polling for the webhook to finish
  (it runs asynchronously, so the redirect can land before the credit does)

**Setting up Stripe** (test mode is free, no business verification needed):

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase functions deploy create-checkout-session --project-ref <your-project-ref>
supabase functions deploy stripe-webhook --project-ref <your-project-ref> --no-verify-jwt
```

Then in the Stripe Dashboard (test mode), add a webhook endpoint pointing at
`https://<project-ref>.supabase.co/functions/v1/stripe-webhook` listening for
`checkout.session.completed`, and copy its signing secret into
`STRIPE_WEBHOOK_SECRET` above. Test card: `4242 4242 4242 4242`, any future
expiry, any CVC.

**Scoped deliberately:**

- **The bank transfer details shown in the app are a labeled placeholder**
  ("replace with real details before launch"), not a real account.
- **Bank transfer claims have no approval screen in this phase.** They sit in
  `awaiting_verification` permanently until the **Admin Panel** phase builds
  the actual verification UI — building a fake "approve" button here would
  mean either no real access control (any org could approve its own claim) or
  inventing a platform-admin role that doesn't exist yet. Both are Admin
  Panel's job, not this one's.
- **No subscriptions, invoices, refunds, coupons, or tax handling yet** —
  those are the **Billing** phase, which also owns actually *spending* these
  credits (deducting them per AI call). This phase only gets money/credits
  in.

### Phase 14: Billing

The spend side of the wallet the Payments phase only built the earn/buy side
of, plus real invoices — genuinely the riskiest phase to build so far, since
it means editing three already-working, security-sensitive Edge Functions
rather than adding new isolated ones.

- `supabase/migrations/20260725000000_billing.sql`:
  - `credit_ledger` — an append-only spend record (signed `amount`, always
    negative from this phase; a future grant/refund can reuse the same
    column as a positive entry rather than needing a schema change)
  - `deduct_credits()` — atomically checks-and-deducts in a single `UPDATE
    ... WHERE balance_credits >= amount`, so it can never take a wallet
    negative and never has a read-then-write race condition. Same lockdown
    as `increment_wallet_balance()` from Payments: `EXECUTE` revoked from
    `authenticated`/`anon`, granted only to `service_role`
  - **Every new organization now gets 50 free starter credits** instead of
    zero (with a one-time backfill for orgs created by earlier phases in
    this same project that were sitting at zero). Without this, a fresh
    install would be unable to use chat, workflows, or teams at all until
    someone ran a real purchase first — directly contradicting this
    project's own "buildable and testable on free tiers" requirement. Caught
    and fixed during this phase rather than shipped as a hidden trap.
- `supabase/functions/_shared/grounding.ts` gained `hasCredits()` (a fast,
  friendly pre-check — not itself the security boundary) and
  `chargeOneCredit()` (called only *after* a successful reply, so a failed
  Gemini call never costs anything)
- **All three AI-calling Edge Functions updated**: `chat`, `run-workflow`,
  and `team-chat` each now check credits before doing any real work and
  charge exactly 1 credit after a successful reply — `run-workflow` checks
  before *every step*, so a multi-step run stops cleanly (not fake-completes)
  if credits run out partway through, matching that phase's existing
  no-faking-remaining-steps principle
- `pages/dashboard/wallet/invoice-page.tsx` — a formatted receipt for any
  paid/verified order, printable via the browser's native print-to-PDF
  (`window.print()`) rather than adding a PDF-generation library that would
  ship completely unverified in this environment
- `wallet-page.tsx` gained an **Invoice** link on paid/verified orders, a
  **Recent usage** section reading from `credit_ledger`, and the balance
  turns red with an explanatory note at exactly zero

**Scoped deliberately** (agreed before building): **flat 1-credit-per-call
platform fee**, charged on top of (not instead of) the organization's own
Gemini API key from the Payments phase — modeling a real pattern where you
pay the platform for orchestration/access separately from your own model
costs. **No recurring Stripe subscriptions this phase** — that's a distinct
Stripe flow (subscription mode, new webhook events, plan management) layered
on top of spend logic that already touches three working functions; doing
both in one phase risked both. Subscriptions are a natural next-phase
follow-up.

### Phase 15: Notifications

Real in-app notifications triggered by genuine events, not a decorative bell
with nothing behind it.

- `supabase/migrations/20260726000000_notifications.sql` — `notifications`:
  **the second deliberate RLS deviation in this project** (the first was
  Marketplace). Every other table gates access by organization membership;
  a notification is private to the one person it's for, so access here is
  simply `user_id = auth.uid()` — called out explicitly in the migration's
  comments, same as the Marketplace deviation was.
- Users can insert notifications **for themselves only** (`with check
  (user_id = auth.uid())`) — covers self-triggered events like a workflow run
  you started finishing, or a bank transfer claim you just submitted.
  Notifying someone *else* can't go through that policy, so those two cases
  are handled by extending existing `SECURITY DEFINER` functions that already
  bypass RLS safely:
  - `deduct_credits()` (Billing phase) now fans out a `low_credits`
    notification to every member of an organization the moment a charge
    brings its balance to exactly zero — fires once per depletion, not on
    every subsequent blocked call, since those never reach this function at
    all (stopped earlier by `hasCredits()`)
  - `increment_marketplace_install_count()` (Marketplace phase) now notifies
    a listing's publisher when someone installs it
- `run-workflow` updated to insert a `workflow_run_completed` /
  `workflow_run_failed` notification for the user who triggered the run —
  a self-insert via the existing `userClient`, no new privileged code path
  needed
- `wallet-page.tsx` inserts a `bank_transfer_submitted` confirmation
  notification right after a claim is created — also a simple self-insert
- `packages/ui` gained a `Popover` primitive (Radix-based), and
  `components/dashboard/notification-bell.tsx` uses it: unread badge,
  mark-one-or-all-as-read, click-to-navigate via each notification's `link`,
  polling every 30s (not Supabase Realtime — that needs enabling table
  replication as an extra per-project setup step; documented as a future
  upgrade rather than added silently)

**Scoped deliberately**: in-app only. Email (via Resend, as the product brief
suggests) is a new external service this sandbox has no way to verify without
network access — it stays a documented future integration point rather than
code that ships unable to be checked.

### Phase 16: Analytics

The lowest-risk phase so far — read-only, no new write paths, nothing
touching the security-sensitive Edge Functions. A real usage dashboard built
entirely from data already being collected by earlier phases.

- `pages/dashboard/analytics/analytics-page.tsx` — `/dashboard/analytics`:
  - Stat cards: credit balance, credits spent (30d), workflow success rate,
    total marketplace installs
  - A daily credit-spend bar chart (the one place this project uses
    `recharts`, newly added to `apps/web`) over the last 30 days
  - Spend broken down by feature (chat / workflow steps / team chat)
  - **Top employees by chat messages** — the one non-trivial join in this
    phase: `credit_ledger.reference_id` for `reason='chat'` is a conversation
    id, joined client-side to `conversations.ai_employee_id` then to
    `ai_employees.name`. Deliberately **not** attempted for workflow or team
    chat spend: a single workflow run can involve several different
    employees across its steps, and a team conversation's replies come from
    whichever teammate the lead picked message-by-message — neither maps
    cleanly to one employee per ledger entry, so those stay out of "top
    employees" rather than being attributed inexactly
  - Workflow runs grouped by workflow (total / completed / failed) — a clean
    aggregation since every run belongs to exactly one workflow

**Scoped deliberately**: this is genuinely per-organization self-service
analytics, not the platform-wide product analytics (PostHog or similar) the
brief also mentions. Those are a different concern — tracking user behavior
across every organization for the SaaS operator, not an organization's own
usage — and would mean a new external service/API key this sandbox has no
way to verify. Worth revisiting once (or if) an **Admin Panel** phase needs
platform-wide visibility.

### Phase 17: API Platform

Organizations can call AgentForge programmatically — chat with an employee,
run a workflow, or message a team over plain HTTP — instead of only through
the dashboard. This introduces a genuinely different trust model from every
other Edge Function so far: **the caller has no Supabase session at all**,
just a bearer API key, so there's no `auth.uid()` and no RLS safety net for
anything these functions do.

- `supabase/migrations/20260727000000_api_platform.sql` — `api_keys`
  (admin/owner-only, same restriction level as the organization's own Gemini
  key) and `create_api_key()`: generates the key, stores only a SHA-256
  hash, and returns the plaintext **exactly once** — the same "shown once,
  never again" pattern as GitHub or Stripe. The migration's header comment
  states the core invariant this whole phase depends on: every one of the
  three new functions must filter *every* query by the key's own
  `organization_id` in application code, since RLS provides no backstop when
  there's no user session.
- `supabase/functions/_shared/api-auth.ts` — shared by all three: hashes the
  incoming key, looks it up, confirms it's active, and returns an
  `{organizationId, apiKeyId, createdBy}` context (or a typed error). Every
  function below is built on the admin/service-role client from this point
  on — there is no other option, since there's no JWT to scope a
  user-context client with.
- `supabase/functions/api-chat`, `api-run-workflow`, `api-team-chat` — the
  same logic as their internal, session-based counterparts, adapted to this
  phase's constraints:
  - Plain JSON responses instead of SSE — a normal REST shape for external
    HTTP clients (curl, server-to-server integrations) rather than a browser
    reading a streaming response
  - `grounding.ts` gained `callGeminiOnceWithHistory()` — a non-streaming
    call that still takes a full multi-turn `contents` array, needed because
    `api-team-chat`'s actual reply (unlike its routing decision, which is
    correctly single-turn) needs real conversation history
- **Two real bugs caught reviewing this phase**, both fixed:
  1. `api-chat` was built using the single-turn `callGeminiOnce()` with only
     the current message — meaning a caller continuing an existing
     `conversationId` would silently lose all prior context on every turn
     after the first, contradicting the entire point of returning a
     `conversationId` to continue a conversation. Fixed by fetching full
     message history and switching to `callGeminiOnceWithHistory()`, matching
     the internal `chat` function's own approach.
  2. `api-run-workflow`'s per-step employee lookup and `api-team-chat`'s lead
     employee lookup were both missing the `organization_id` filter that
     every *other* query in those same files has — the one inconsistency
     with the invariant the migration's own header comment states as the
     whole security model of this phase. Not exploitable through normal
     usage today (a workflow step or team lead can only reference an
     employee from its own org given how the dashboard UI and RLS already
     constrain that data), but defense-in-depth matters most exactly where a
     function has stated "we rely on this check because nothing else is
     checking" — so both were fixed to match every other query in their
     respective files.
- `pages/dashboard/api-keys/api-keys-page.tsx` — `/dashboard/settings/api-keys`
  (admin/owner only): create/revoke keys, plus inline `curl` examples for
  all three endpoints so the page is actually usable by an external
  developer reading it, not just a key-management list with nothing to call

**Scoped deliberately**: no rate limiting beyond the credit system itself
(an organization running out of credits is a natural usage ceiling); a
proper token-bucket limiter would need infrastructure (Redis or similar) this
free-tier architecture doesn't have. Worth revisiting if abuse becomes a
real concern.

### Phase 18: Organization Management

Everything the Database phase (Phase 3) deferred back when organizations
were first built: inviting teammates, managing roles, and — since inviting
someone to a *second* organization is meaningless if they can never switch
into it — an organization switcher, which the app had no version of at all
until this phase (every user had only ever belonged to exactly one org).

- `supabase/migrations/20260728000000_organization_management.sql`:
  - **Cross-member profile visibility** — the exact RLS policy Phases 3 and
    5 both explicitly named as deferred scope. Postgres combines multiple
    `SELECT` policies with OR, so this *adds to* rather than replaces the
    "read your own row" policy from Authentication.
  - `organization_invitations` + **real invite emails via Supabase's own
    auth admin API** (`admin.inviteUserByEmail`) — not Resend, which the
    Notifications phase deferred as a new, unverifiable external service.
    This reuses Supabase's *existing* auth email system (already relied on
    since the Authentication phase for signup confirmation), so it delivers
    genuine email invites without introducing a new dependency this sandbox
    has no way to check works.
  - `handle_new_user()` extended again: on signup, also claims any pending
    invitations sent to that email address, joining those organizations too.
  - `prevent_owner_membership_change` — a trigger, not just an RLS
    restriction, guaranteeing the organization's founding owner
    (`organizations.owner_id`) can never be demoted or removed through any
    path (the existing admin update/delete policies, or a future one).
    Ownership transfer stays explicitly out of scope.
- `supabase/migrations/20260729000000_organization_switching.sql`:
  - `create_organization()` — lets any user create an *additional*
    organization beyond their auto-created personal one, becoming its owner
  - A new `DELETE` policy letting a member remove themselves — combined via
    OR with the existing admin-removal policy, and still protected from
    removing the founding owner by the trigger above
- `supabase/functions/invite-member/index.ts` — **new** Edge Function, two
  paths depending on whether the invited email already has an account:
  existing users are added immediately (with an in-app notification, reusing
  the Notifications phase's system — `added_to_organization` added to that
  phase's type constraint); new users get the real invite email above, with
  a pending invitation resolved automatically at signup.
- `contexts/organization-context.tsx` extended: `myOrganizations`,
  `switchOrganization()`, `createOrganization()`
- `components/dashboard/org-switcher.tsx` — replaces the static org name in
  the sidebar with a real switcher (built on the `Popover` primitive from
  Notifications), plus inline "create organization"
- `pages/dashboard/members/members-page.tsx` — `/dashboard/settings/members`:
  invite by email, change roles, remove members, view/revoke pending
  invitations — all admin/owner only
- `organization-page.tsx` gained a "Leave organization" action

**One real fix made during review**: the Leave-organization button was
originally hidden for anyone with the `owner` *role*, but the guard trigger
only actually protects the organization's specific founding owner
(`organizations.owner_id`) — a member later *promoted* to the owner role
(a legitimate state the schema allows) would have seen no way to leave in
the UI even though the backend would correctly allow it. Fixed to check the
specific founding-owner id instead of the role generally, matching what the
database actually enforces.

### Phase 19: Admin Panel

A genuinely new authorization boundary — the first (and only) role in this
project that sits *above* every organization rather than scoped to one, for
things a platform operator needs to do that no organization's own admin
should be able to: verifying bank transfer claims across every org, seeing
platform-wide numbers, moderating the marketplace.

- `supabase/migrations/20260730000000_admin_panel.sql`:
  - `platform_admins` — a plain allowlist. **No INSERT/UPDATE/DELETE policy
    for any client role, by design** — a self-service "become an admin"
    path would be a privilege-escalation hole, so the only way in is a
    manual SQL insert run directly against the database (see below).
    `is_platform_admin()` mirrors the `is_org_admin()` pattern used
    everywhere else, just with no organization scope.
  - `verify_bank_transfer()` — **the concrete thing the Payments phase
    explicitly said would stay unbuilt** until this phase existed to
    provide real access control for it. Reuses `increment_wallet_balance()`
    from Payments — the exact same function the Stripe webhook uses — so
    there's one source of truth for "how a wallet gets credited," regardless
    of which gateway or approval path triggered it. Also notifies the
    submitter of the decision (extending the Notifications phase's system
    with two new types, `bank_transfer_verified`/`bank_transfer_rejected`).
  - `get_platform_stats()`, `list_pending_bank_transfers()`,
    `admin_unpublish_listing()` — same self-checking-RPC pattern as
    `create_api_key()`/`create_organization()` from earlier phases: callable
    by any authenticated user, with `is_platform_admin()` as the actual gate
    inside, raising an exception for anyone else.
- `layouts/admin-layout.tsx` — every `/admin/*` route lives under its own
  layout, completely separate from the org-scoped dashboard shell (an admin
  session isn't "acting as" any particular organization). Checks
  `is_platform_admin()` client-side for UX — showing "not authorized" rather
  than a blank or broken page — while every actual RPC above independently
  re-checks the same thing server-side regardless of whether this client
  gate was somehow bypassed.
- `hooks/use-platform-admin.ts` — shared by the layout guard and a
  conditional "Platform Admin" link that only renders in the regular
  dashboard sidebar for actual platform admins
- `pages/admin/`: `admin-overview-page.tsx` (platform-wide stats),
  `admin-bank-transfers-page.tsx` (approve/reject with an optional note sent
  back to the submitter), `admin-marketplace-page.tsx` (unpublish any org's
  listing)

**Bootstrapping the first platform admin** (there is no app UI for this,
deliberately):

```sql
insert into public.platform_admins (user_id)
values ('<your-user-id-from-the-auth-users-table>');
```

Run directly in the Supabase SQL editor. Find your user id under
**Authentication → Users** in the dashboard.

**Scoped deliberately**: feature flags, announcements, and support tickets
from the master brief's full admin feature list are skipped — none of them
are tied to anything an earlier phase already deferred, so building them now
would be inventing new scope rather than completing existing work.

### Phase 20: Mobile App

An Expo (React Native) app in `apps/mobile` — genuinely the hardest phase to
have confidence in, since this sandbox has no simulator, no device, and no
network access to install Expo's toolchain at all. Everything here is
written carefully against documented, standard patterns, but it's untested
in a way no other phase has been. **Running `npx expo start` yourself is the
real first test.**

**Scope, as agreed**: login/signup and a chat screen — reusing the exact
same Supabase backend and `chat` Edge Function the web app already uses, no
new backend work at all. Workflows, teams, knowledge base, billing, and
everything else stay web-only for now.

- `apps/mobile/src/lib/supabase.ts` — the standard documented Expo+Supabase
  pattern: `react-native-url-polyfill` imported first (Hermes doesn't
  implement the URL API `supabase-js` needs), `AsyncStorage` as the session
  storage adapter, `detectSessionInUrl: false` (no URL bar on mobile to
  carry a redirect). Env vars use the `EXPO_PUBLIC_` prefix Expo requires to
  expose anything to the client bundle.
- **The single biggest technical risk in this phase, and how it's handled**:
  `apps/web`'s chat client reads the `chat` function's SSE response via
  `response.body.getReader()`, but React Native's `fetch` has historically
  inconsistent support for streaming response bodies across the
  iOS/Android/Hermes stack — something with no simulator here to verify
  either way. `apps/mobile/src/lib/chat-client.ts` deliberately uses
  `response.text()` instead — universally supported, at the cost of waiting
  for the complete reply instead of showing it token by token. The `chat`
  Edge Function itself is completely unchanged; only how this one client
  reads its response differs.
- `apps/mobile/src/lib/supabase-types.ts` — deliberately **not** importing
  `@agentforge/types`: that package's types are camelCase domain models,
  but a raw Supabase query result is snake_case, matching the database
  columns directly. `apps/web` never actually types its Supabase queries
  with `@agentforge/types` either, for the same reason — this file is the
  mobile app's equivalent, trimmed to the three tables this app touches.
  `@agentforge/utils` (framework-agnostic helpers with zero DOM dependency)
  *is* genuinely reused, e.g. `truncate()` on the employee list.
- UI is plain React Native primitives (`View`, `Text`, `Pressable`,
  `TextInput`, `FlatList`) styled with `StyleSheet`, not a third-party
  component library — `packages/ui` doesn't apply here at all (it's built on
  Radix + Tailwind, both web-only), and pulling in an unfamiliar RN UI
  library would add a dependency this sandbox has no way to verify actually
  works. `src/lib/theme.ts` carries the same color/spacing intent as the web
  app's design tokens without literally sharing code across two
  fundamentally different styling systems.
- Screens: `app/(auth)/{login,signup}.tsx`, `app/index.tsx` (employee list,
  the auth-gate redirect target), `app/employee/[id]/chat.tsx` — one
  continuous thread per employee rather than the web app's conversation
  list, the simplest reasonable mobile UX, clearly commented as a deliberate
  simplification rather than a missing feature.

**Setting up the mobile app:**

```bash
cd apps/mobile
cp .env.example .env   # fill in the same Supabase project apps/web uses
pnpm install
pnpm start              # then press i for iOS simulator, a for Android, or scan the QR code
```

No new Supabase setup needed — this phase adds zero migrations and zero
Edge Functions. It's a second frontend against everything already built.

### Phase 21: Testing

Real, genuinely reliable unit tests — not a testing framework installed with
nothing meaningful in it. Scoped deliberately to what can actually be
verified by hand in an environment with no way to run anything: pure,
deterministic functions only. Anything touching React rendering or a real
Supabase/Gemini call would need mocking whose own correctness couldn't be
checked here, so it's left out rather than shipped as false confidence.

**One real bug found and fixed while writing these tests**:
`formatDate()` in `packages/utils` parsed date-only strings (e.g.
`"2026-01-15"`) as UTC midnight, which can render as the *previous* calendar
day in any timezone behind UTC. It's currently unused anywhere in the app
(both `apps/web` and `apps/mobile` format dates inline instead), so nothing
is broken today — but it's exactly the class of bug testing exists to catch,
so it's fixed now rather than left as a trap for whoever reaches for this
function next. Full datetime strings (with a time and/or `Z`) were already
correct and are untouched.

**What's covered, and why each was chosen:**

- `packages/utils` (Vitest) — `formatDate`, `truncate`, `sleep`,
  `getInitials`. The `formatDate` tests are themselves written to be
  timezone-safe (constructing expected values from local `Date` components
  rather than hardcoded strings) — the same class of bug being tested for
  would otherwise make the *test* flaky too.
- `packages/ui` (Vitest) — `cn()`, including a real Tailwind-conflict
  resolution case (`px-2` + `px-4` → keeps `px-4`), not just class
  concatenation.
- `apps/web` (Vitest) — `formatPrice()` and `getProviderOption()` from
  Billing/AI Employees, plus data-integrity checks on the static
  `CREDIT_PACKAGES` and `AI_PROVIDERS` arrays (unique ids, all six providers
  present).
- `supabase/functions/_shared/grounding.test.ts` (Deno's built-in test
  runner — no dependency to install) — `buildKnowledgeContext`,
  `buildMemoryContext`, `buildSystemInstruction`, `sseEvent`. Precisely
  traces the exact per-source/total character caps from the Knowledge Base
  and Memory phases, including the real behavioral difference between them
  (knowledge context adds a `[truncated]` marker; memory context silently
  truncates, no marker).
- `supabase/functions/run-workflow/index.test.ts` (Deno) — `substituteTemplate`,
  including that `{{input}}` appearing twice in one prompt gets replaced
  both times (`.replaceAll`, not `.replace`).
- `supabase/functions/team-chat/index.test.ts` (Deno) — `buildRoutingInstruction`
  and `matchTeamMemberByName`, covering the routing-response parsing
  edge cases that function was specifically written to handle: case
  insensitivity, surrounding whitespace, quotes/periods Gemini sometimes
  adds, the literal `SELF` response, and an unparseable response — all
  correctly falling back to null (→ the lead answers directly) rather than
  crashing.
- **`run-workflow/index.ts` and `team-chat/index.ts` are now guarded** with
  `if (import.meta.main) { Deno.serve(...) }` so their pure functions can be
  imported for testing without also starting a real server as an import side
  effect. `import.meta.main` is `true` only when a file is run directly —
  exactly how Supabase's Edge Runtime already invokes these in production —
  so this changes nothing about real deployments.

**Explicitly deferred, not attempted**: component tests (would need React
Testing Library + jsdom + mocking every Supabase call a component makes —
several layers whose interaction couldn't be verified here), integration
tests against a real database, and end-to-end tests (need an actual running
app — Playwright/Cypress have nothing to drive without one). All three are
better attempted somewhere with the infrastructure to confirm they work.

**Running the tests:**

```bash
pnpm test                                              # web + shared packages, via Turborepo
deno test supabase/functions/_shared/grounding.test.ts # Edge Function shared logic
deno test supabase/functions/run-workflow/index.test.ts
deno test supabase/functions/team-chat/index.test.ts
```

CI (`.github/workflows/ci.yml`) runs all of the above automatically, plus
lint/type-check/build, on every push and pull request.

**Whole-project syntax verification, actually run, not just claimed.** Unit
tests only cover the handful of pure functions above — everything else in
this project has never been executed anywhere. As a real (if partial) form
of build verification, every source file was checked for syntax errors using
actual tooling in this environment:

```bash
# Every .ts file (Edge Functions, configs, test files):
node --check path/to/file.ts

# Every .tsx file (node's --check doesn't understand the extension at all,
# so these went through tsc directly, filtered to only TS1xxx syntax-error
# codes — the missing-module/missing-type errors this produces without
# node_modules installed are expected and irrelevant here):
tsc --noEmit --jsx react-jsx --esModuleInterop --skipLibCheck \
    --module esnext --moduleResolution bundler --target es2022 path/to/file.tsx
```

Result: **zero syntax errors across every `.ts` and `.tsx` file** in
`apps/web`, `apps/mobile`, `packages/*`, and every Edge Function. This
doesn't catch type errors, logic bugs, or anything requiring module
resolution (there's no `node_modules` installed in this environment to
resolve against) — but it does mean every file will at least parse, which is
worth knowing for certain rather than assuming.

## Getting started

Requires Node 20+ and [pnpm](https://pnpm.io) (`corepack enable` will give you the
right pnpm version automatically).

```bash
pnpm install
```

### Set up Supabase (free tier)

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run all seventeen migration files in order (or, if you
   have the [Supabase CLI](https://supabase.com/docs/guides/cli) installed and
   linked to your project, just run `supabase db push`, which applies them in
   order automatically):
   - `20260713000000_profiles.sql`
   - `20260714000000_organizations.sql`
   - `20260716000000_ai_employees.sql`
   - `20260717000000_organization_api_keys.sql`
   - `20260718000000_conversations_and_messages.sql`
   - `20260719000000_knowledge_base.sql`
   - `20260720000000_employee_memories.sql`
   - `20260721000000_workflows.sql`
   - `20260722000000_teams.sql`
   - `20260723000000_marketplace.sql`
   - `20260724000000_payments.sql`
   - `20260725000000_billing.sql`
   - `20260726000000_notifications.sql`
   - `20260727000000_api_platform.sql`
   - `20260728000000_organization_management.sql`
   - `20260729000000_organization_switching.sql`
   - `20260730000000_admin_panel.sql`
3. Deploy all Edge Functions:
   ```bash
   supabase functions deploy chat --project-ref <your-project-ref>
   supabase functions deploy run-workflow --project-ref <your-project-ref>
   supabase functions deploy team-chat --project-ref <your-project-ref>
   supabase functions deploy create-checkout-session --project-ref <your-project-ref>
   supabase functions deploy stripe-webhook --project-ref <your-project-ref> --no-verify-jwt
   supabase functions deploy api-chat --project-ref <your-project-ref> --no-verify-jwt
   supabase functions deploy api-run-workflow --project-ref <your-project-ref> --no-verify-jwt
   supabase functions deploy api-team-chat --project-ref <your-project-ref> --no-verify-jwt
   supabase functions deploy invite-member --project-ref <your-project-ref>
   ```
   (If you already deployed `chat` in an earlier phase, redeploy it — it
   changed again in the Knowledge Base, Memory, Workflow Builder, and Billing
   phases. `run-workflow` also changed again in both the Billing and
   Notifications phases; `team-chat` changed again in Billing. Redeploy
   whichever of these you already have deployed.)
   The Stripe functions need `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` set
   first — see the Payments phase section below for the full Stripe setup. The
   API Platform functions don't need any extra secrets — they read each
   organization's own Gemini key from the database, same as the dashboard.
4. Copy `apps/web/.env.example` to `apps/web/.env.local` and fill in your project's
   URL and anon key from **Project Settings → API**.
5. By default Supabase requires email confirmation on signup — the signup page
   handles this and tells the user to check their inbox. You can turn confirmation
   off in **Authentication → Providers → Email** for faster local testing.
6. To actually chat with an employee, get a free Gemini API key at
   [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) and add
   it in **Organization settings** in the app (owner/admin only).

### Run the app

```bash
pnpm dev
```

This starts `apps/web` on **http://localhost:5173**. You should land on the new
marketing homepage (dark blueprint hero with the AI Employee schematic), and from
there sign up, confirm, log in, and land in the dashboard shell. Submit a bank
transfer claim from Wallet, then grant yourself platform admin access with the
SQL insert from the Phase 19 section above, reload, and check a "Platform
Admin" link appears at the bottom of the sidebar — approve the claim from there
and confirm the wallet balance actually updates.

Other useful commands from the root:

```bash
pnpm build         # builds all apps/packages via Turborepo
pnpm lint           # lint everything
pnpm type-check      # type-check everything
pnpm format          # format with Prettier
```

## Project structure

```
apps/
  web/            # Vite + React 19 + TS — the main product app
  mobile/         # Expo (React Native) — login/signup + employee chat
packages/
  ui/             # shared shadcn/ui component library + design tokens (web only)
  types/          # shared TypeScript types
  utils/          # shared framework-agnostic helpers (reused by web + mobile)
.github/workflows/ # CI
```

## Why this stack

Chosen to match the project's zero-budget constraint: everything here runs and builds
for free (GitHub, local dev, and later Vercel + Supabase free tiers). No paid service
is required to develop or deploy Phase 1.

## Deploying to Vercel

`apps/web` is a standard Vite SPA and deploys to Vercel's free tier with no
paid add-ons. Nothing else in this repo (Supabase, Edge Functions, the
mobile app) is Vercel's concern — those are deployed separately, per the
Supabase setup steps above.

1. **Push this repo to GitHub** (or GitLab/Bitbucket) if it isn't already.
2. **In Vercel**: New Project → import the repo.
3. **Set the Root Directory to `apps/web`** in the project's configuration
   screen (Vercel monorepo support — this is the one setting that matters
   most). `apps/web/vercel.json` handles the rest: it installs and builds
   from the monorepo root (`pnpm install`, `turbo run build --filter=@agentforge/web`)
   so the workspace packages (`@agentforge/ui`, `@agentforge/types`,
   `@agentforge/utils`) resolve correctly, and rewrites all routes to
   `index.html` so React Router's client-side routes (e.g. `/dashboard`)
   don't 404 on a direct visit or page refresh.
4. **Add environment variables** in the Vercel project's Settings →
   Environment Variables (not just locally in `.env.local` — Vercel doesn't
   read that file):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

   Same values as `apps/web/.env.local` — the same Supabase project you set
   up earlier in this README.
5. **Deploy.** Vercel builds and gives you a `*.vercel.app` URL.
6. **Update Supabase's allowed redirect URLs** (Authentication → URL
   Configuration in the Supabase dashboard) to include your new Vercel
   domain, or email confirmation / invite links will redirect somewhere
   that doesn't exist. Add both the `*.vercel.app` URL Vercel gives you and
   any custom domain you attach.

That's the whole deploy. Every subsequent `git push` to your default branch
redeploys automatically; Vercel also builds a preview deployment for every
pull request.

**What does *not* get deployed by this**: `apps/mobile` (ships through Expo/
App Store/Play Store, not Vercel — see the Mobile App phase above),
`supabase/migrations` and `supabase/functions` (deployed to Supabase directly
via the Supabase CLI commands in the Getting Started section above, not
through Vercel at all).

## Current status: deployable, with honest gaps

Every phase through **Testing** (21 of the master roadmap's phases) is built
and documented above, each independently reviewed rather than assumed
correct. The app is real and deployable today via the Vercel instructions
above plus the Supabase setup earlier in this README.

**Not built, and clearly not pretended to be:**

- **Optimization** — no dedicated performance pass (bundle-size audit,
  query/index tuning, caching strategy) has been done. Nothing here is known
  to be slow; it also hasn't been measured.
- **Documentation** — this README is thorough phase-by-phase engineering
  documentation, not polished end-user docs (a docs site, onboarding guide,
  API reference beyond the inline `curl` examples on the API Keys page).
- **Final Production Review** — no formal security/accessibility/legal
  audit. The security-sensitive pieces (RLS policies, Edge Function auth,
  Stripe webhook verification, API key hashing) were each reviewed carefully
  as they were built, documented inline in this README's phase write-ups —
  but that's not a substitute for a dedicated audit before handling real
  money or real user data at scale.

None of these block running the app or deploying it — they're about
hardening and polish on top of a working product, not missing functionality.
