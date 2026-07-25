// Supabase Edge Function: invite-member
//
// Runs on Deno. Deploy with: supabase functions deploy invite-member
// Uses the normal session-based auth (like chat/run-workflow/team-chat) —
// the caller IS a logged-in dashboard user, unlike the api-* functions from
// the API Platform phase. No --no-verify-jwt needed here.
//
// Two paths, decided by whether the invited email already has an account:
//   - Existing user: added to organization_members immediately (they can
//     already log in — there's nothing to "accept"), and gets an in-app
//     notification.
//   - New user: a real Supabase Auth invite email is sent via the admin API
//     (admin.inviteUserByEmail — this is Supabase's own auth email system,
//     already relied on since the Authentication phase for signup
//     confirmation; NOT the Resend integration the Notifications phase
//     deliberately deferred, which is for a different kind of email). A
//     pending organization_invitations row is claimed automatically by
//     handle_new_user() once they complete signup.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

interface InviteMemberBody {
  organizationId: string;
  email: string;
  role: "admin" | "member";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response("Missing Authorization header", { status: 401, headers: CORS_HEADERS });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } }
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const {
    data: { user }
  } = await userClient.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });
  }

  let body: InviteMemberBody;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400, headers: CORS_HEADERS });
  }

  const email = body.email?.trim().toLowerCase();
  if (!body.organizationId || !email || !["admin", "member"].includes(body.role)) {
    return new Response(
      "organizationId, a valid email, and role ('admin' or 'member') are required",
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // RLS-scoped check: the caller must actually be an admin/owner of this
  // org. is_org_admin() is security-definer so it works here even though
  // we haven't selected anything from organization_members directly.
  const { data: isAdmin } = await userClient.rpc("is_org_admin", {
    target_org_id: body.organizationId
  });

  if (!isAdmin) {
    return new Response("Only organization admins or owners can invite members", {
      status: 403,
      headers: CORS_HEADERS
    });
  }

  const { data: organization } = await userClient
    .from("organizations")
    .select("name")
    .eq("id", body.organizationId)
    .single();

  // Does this email already belong to an account? profiles.email lets us
  // check without needing the admin auth API's user-listing endpoints.
  const { data: existingProfile } = await adminClient
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile) {
    const { error: memberError } = await adminClient.from("organization_members").insert({
      organization_id: body.organizationId,
      user_id: existingProfile.id,
      role: body.role
    });

    if (memberError) {
      // Most likely: they're already a member (unique constraint).
      const message = memberError.message.includes("duplicate")
        ? "This person is already a member."
        : memberError.message;
      return new Response(JSON.stringify({ error: message }), {
        status: 409,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    await adminClient.from("notifications").insert({
      user_id: existingProfile.id,
      organization_id: body.organizationId,
      type: "added_to_organization",
      title: `You've been added to ${organization?.name ?? "an organization"}`,
      link: "/dashboard"
    });

    return new Response(JSON.stringify({ status: "added_immediately" }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });
  }

  // New user: create (or reuse) a pending invitation, then send a real
  // Supabase Auth invite email.
  const { error: invitationError } = await adminClient.from("organization_invitations").upsert(
    {
      organization_id: body.organizationId,
      email,
      role: body.role,
      invited_by: user.id,
      status: "pending"
    },
    { onConflict: "organization_id,email,status" }
  );

  if (invitationError) {
    return new Response(JSON.stringify({ error: invitationError.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });
  }

  const { error: sendError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { invited_to_organization: organization?.name ?? null }
  });

  if (sendError) {
    return new Response(
      JSON.stringify({
        error: `Invitation saved, but the email couldn't be sent: ${sendError.message}`
      }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ status: "invite_email_sent" }), {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
  });
});
