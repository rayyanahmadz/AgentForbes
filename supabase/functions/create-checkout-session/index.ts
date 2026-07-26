// Supabase Edge Function: create-checkout-session
//
// Runs on Deno. Deploy with: supabase functions deploy create-checkout-session
// Requires SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (all
// auto-provided) plus STRIPE_SECRET_KEY, which you set yourself:
//   supabase secrets set STRIPE_SECRET_KEY=sk_test_...
//
// Creates a one-time-payment Stripe Checkout Session (test mode) for a fixed
// AI-credit package. The price is ALWAYS looked up here, server-side, from
// the CREDIT_PACKAGES list below — a client can only ever send a packageId,
// never an amount. Keep this list in sync with
// apps/web/src/lib/credit-packages.ts by hand; there's no shared import
// between the Vite app and a Deno function without extra bundling
// machinery, so this is a deliberate, documented duplication.

import Stripe from "https://esm.sh/stripe@14?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { CORS_HEADERS } from "../_shared/grounding.ts";

const CREDIT_PACKAGES: Record<string, { credits: number; priceCents: number; label: string }> = {
  starter: { credits: 500, priceCents: 500, label: "Starter" },
  growth: { credits: 2500, priceCents: 2000, label: "Growth" },
  scale: { credits: 6000, priceCents: 4000, label: "Scale" }
};

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
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

  if (!stripeSecretKey) {
    return new Response(
      "Stripe isn't configured on this deployment yet (STRIPE_SECRET_KEY missing).",
      { status: 500, headers: CORS_HEADERS }
    );
  }

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

  let body: { organizationId?: string; packageId?: string; origin?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400, headers: CORS_HEADERS });
  }

  const pkg = body.packageId ? CREDIT_PACKAGES[body.packageId] : undefined;
  if (!body.organizationId || !pkg) {
    return new Response("organizationId and a valid packageId are required", {
      status: 400,
      headers: CORS_HEADERS
    });
  }

  // RLS (is_org_member) proves this user belongs to this organization —
  // selecting it at all is the membership check.
  const { data: organization, error: orgError } = await userClient
    .from("organizations")
    .select("id")
    .eq("id", body.organizationId)
    .single();

  if (orgError || !organization) {
    return new Response("Organization not found", { status: 404, headers: CORS_HEADERS });
  }

  const { data: order, error: orderError } = await userClient
    .from("payment_orders")
    .insert({
      organization_id: organization.id,
      created_by: user.id,
      gateway: "stripe",
      credits_purchased: pkg.credits,
      amount_cents: pkg.priceCents,
      currency: "usd",
      status: "pending"
    })
    .select("id")
    .single();

  if (orderError || !order) {
    return new Response(`Couldn't create order: ${orderError?.message ?? "unknown error"}`, {
      status: 500,
      headers: CORS_HEADERS
    });
  }

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2026-06-24.dahlia"
});  const origin = body.origin ?? "http://localhost:5173";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: pkg.priceCents,
          product_data: { name: `AgentForge AI credits — ${pkg.label} (${pkg.credits} credits)` }
        },
        quantity: 1
      }
    ],
    success_url: `${origin}/dashboard/wallet?status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/dashboard/wallet?status=cancelled`,
    metadata: { order_id: order.id }
  });

  // No update policy exists for payment_orders under the authenticated
  // role (by design — see the migration's security note), so recording the
  // session id requires the service-role client.
  await adminClient
    .from("payment_orders")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", order.id);

  return new Response(JSON.stringify({ checkoutUrl: session.url }), {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
  });
});
