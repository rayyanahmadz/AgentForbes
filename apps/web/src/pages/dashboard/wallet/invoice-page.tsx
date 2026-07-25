import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { Button, Card, CardContent } from "@agentforge/ui";

import { useOrganization } from "@/contexts/organization-context";
import { formatPrice } from "@/lib/credit-packages";
import { supabase } from "@/lib/supabase/client";
import type { PaymentOrder } from "@/lib/supabase/types";

export function InvoicePage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { organization } = useOrganization();
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!orderId) return;

    supabase
      .from("payment_orders")
      .select("*")
      .eq("id", orderId)
      .single()
      .then(({ data }) => {
        setOrder(data ?? null);
        setIsLoading(false);
      });
  }, [orderId]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (!order || (order.status !== "paid" && order.status !== "verified")) {
    return (
      <div className="flex flex-col gap-4">
        <Button asChild variant="ghost" size="sm" className="w-fit gap-1.5 print:hidden">
          <Link to="/dashboard/wallet">
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
            Back to wallet
          </Link>
        </Button>
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No invoice available — this order hasn't been paid or verified yet.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between print:hidden">
        <Button asChild variant="ghost" size="sm" className="gap-1.5">
          <Link to="/dashboard/wallet">
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
            Back to wallet
          </Link>
        </Button>
        <Button size="sm" className="gap-1.5" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5" strokeWidth={1.75} />
          Print / Save as PDF
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-6 p-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-display text-lg font-semibold">AgentForge AI</p>
              <p className="text-sm text-muted-foreground">Receipt</p>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>Invoice #{order.id.slice(0, 8).toUpperCase()}</p>
              <p>{new Date(order.created_at).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-y py-4 text-sm">
            <div>
              <p className="text-muted-foreground">Billed to</p>
              <p className="font-medium">{organization?.name ?? "—"}</p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground">Payment method</p>
              <p className="font-medium">
                {order.gateway === "stripe" ? "Card (Stripe)" : "Bank transfer"}
              </p>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-normal">Description</th>
                <th className="pb-2 text-right font-normal">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-2">
                  AI credits — {order.credits_purchased.toLocaleString()} credits
                </td>
                <td className="py-2 text-right">
                  {formatPrice(order.amount_cents, order.currency.toUpperCase())}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t font-medium">
                <td className="pt-2">Total</td>
                <td className="pt-2 text-right">
                  {formatPrice(order.amount_cents, order.currency.toUpperCase())}
                </td>
              </tr>
            </tfoot>
          </table>

          <p className="text-xs text-muted-foreground">
            Status: {order.status === "paid" ? "Paid" : "Verified"} ·{" "}
            {order.gateway === "stripe" && order.stripe_checkout_session_id
              ? `Stripe session ${order.stripe_checkout_session_id}`
              : order.bank_transfer_reference
                ? `Reference ${order.bank_transfer_reference}`
                : null}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
