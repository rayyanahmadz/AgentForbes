import { supabase } from "@/lib/supabase/client";

/**
 * Calls create-checkout-session and returns the Stripe-hosted Checkout URL
 * to redirect the browser to. Unlike chat/workflow/team-chat, this is a
 * plain request/response — no streaming — so supabase.functions.invoke is
 * fine here (it buffers the whole response, which is exactly what we want).
 */
export async function createCheckoutSession(
  organizationId: string,
  packageId: string
): Promise<{ checkoutUrl: string } | { error: string }> {
  const { data, error } = await supabase.functions.invoke("create-checkout-session", {
    body: {
      organizationId,
      packageId,
      origin: window.location.origin
    }
  });

  if (error) {
    return { error: error.message };
  }

  if (!data?.checkoutUrl) {
    return { error: "No checkout URL returned." };
  }

  return { checkoutUrl: data.checkoutUrl };
}
