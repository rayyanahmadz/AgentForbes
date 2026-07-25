// Supabase Edge Function: stripe-webhook
//
// Runs on Deno. Deploy with:
//   supabase functions deploy stripe-webhook --no-verify-jwt
// The --no-verify-jwt flag is required — Stripe calls this endpoint
// directly and doesn't send a Supabase auth header. Security instead comes
// entirely from verifying the Stripe-Signature header below; never remove
// that check.
//
// After deploying, register the endpoint in the Stripe Dashboard (Developers
// → Webhooks) pointing at:
//   https://<project-ref>.supabase.co/functions/v1/stripe-webhook
// listening for the checkout.session.completed event, then:
//   supabase secrets set STRIPE_SECRET_KEY=sk_test_...
//   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...

import Stripe from "https://esm.sh/stripe@14?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!stripeSecretKey || !webhookSecret) {
    console.error("Stripe env vars missing on this deployment.");
    return new Response("Not configured", { status: 500 });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-11-20" });
  const cryptoProvider = Stripe.createSubtleCryptoProvider();

  const signature = req.headers.get("Stripe-Signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      webhookSecret,
      undefined,
      cryptoProvider
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response(`Webhook signature verification failed`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.order_id;

    if (!orderId) {
      console.error("checkout.session.completed with no order_id in metadata");
      return new Response("Missing order_id in metadata", { status: 400 });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: order, error: orderError } = await adminClient
      .from("payment_orders")
      .select("id, organization_id, credits_purchased, status")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      console.error("Order not found for webhook:", orderId, orderError?.message);
      return new Response("Order not found", { status: 404 });
    }

    // Idempotency: Stripe may redeliver this event. Only credit once.
    if (order.status === "pending") {
      await adminClient
        .from("payment_orders")
        .update({ status: "paid" })
        .eq("id", order.id);

      const { error: creditError } = await adminClient.rpc("increment_wallet_balance", {
        target_org_id: order.organization_id,
        amount: order.credits_purchased
      });

      if (creditError) {
        console.error("Failed to credit wallet:", creditError.message);
        // Still return 200 below — Stripe would otherwise retry
        // indefinitely for something that needs manual investigation, not
        // a webhook retry loop. This is logged for follow-up.
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" }
  });
});
