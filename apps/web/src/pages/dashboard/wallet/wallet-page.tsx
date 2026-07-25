import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Banknote, CreditCard, FileText, Wallet as WalletIcon } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label
} from "@agentforge/ui";

import { useAuth } from "@/contexts/auth-context";
import { useOrganization } from "@/contexts/organization-context";
import { createCheckoutSession } from "@/lib/checkout-client";
import { CREDIT_PACKAGES, formatPrice } from "@/lib/credit-packages";
import { supabase } from "@/lib/supabase/client";
import type { CreditLedgerEntry, OrganizationWallet, PaymentOrder } from "@/lib/supabase/types";

const STATUS_LABELS: Record<PaymentOrder["status"], string> = {
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
  awaiting_verification: "Awaiting verification",
  verified: "Verified",
  rejected: "Rejected"
};

const CHARGE_REASON_LABELS: Record<CreditLedgerEntry["reason"], string> = {
  chat: "Chat message",
  workflow_step: "Workflow step",
  team_chat: "Team chat message"
};

export function WalletPage() {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const [searchParams, setSearchParams] = useSearchParams();

  const [wallet, setWallet] = useState<OrganizationWallet | null>(null);
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [ledger, setLedger] = useState<CreditLedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [buyingPackageId, setBuyingPackageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);

  const [bankReference, setBankReference] = useState("");
  const [bankPackageId, setBankPackageId] = useState(CREDIT_PACKAGES[0]!.id);
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);
  const [claimSubmitted, setClaimSubmitted] = useState(false);

  const loadWalletAndOrders = useCallback(async () => {
    if (!organization) return;

    setIsLoading(true);
    const [{ data: walletData }, { data: orderData }, { data: ledgerData }] = await Promise.all([
      supabase.from("organization_wallets").select("*").eq("organization_id", organization.id).single(),
      supabase
        .from("payment_orders")
        .select("*")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("credit_ledger")
        .select("*")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false })
        .limit(50)
    ]);
    setWallet(walletData ?? null);
    setOrders(orderData ?? []);
    setLedger(ledgerData ?? []);
    setIsLoading(false);
  }, [organization]);

  useEffect(() => {
    void loadWalletAndOrders();
  }, [loadWalletAndOrders]);

  // Handle the redirect back from Stripe Checkout: poll briefly for the
  // webhook to finish crediting the wallet, since it runs asynchronously.
  useEffect(() => {
    const status = searchParams.get("status");
    if (!status) return;

    if (status === "cancelled") {
      setCheckoutNotice("Checkout was cancelled — no charge was made.");
      setSearchParams({}, { replace: true });
      return;
    }

    if (status === "success") {
      setCheckoutNotice("Finalizing your payment…");
      setSearchParams({}, { replace: true });

      let attempts = 0;
      const interval = setInterval(async () => {
        attempts += 1;
        await loadWalletAndOrders();
        const { data } = await supabase
          .from("payment_orders")
          .select("status")
          .eq("organization_id", organization?.id ?? "")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data?.status === "paid") {
          setCheckoutNotice("Payment successful — credits added to your wallet.");
          clearInterval(interval);
        } else if (attempts >= 8) {
          setCheckoutNotice(
            "Payment is still processing. Refresh in a moment if your balance hasn't updated."
          );
          clearInterval(interval);
        }
      }, 2000);

      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function handleBuy(packageId: string) {
    if (!organization) return;

    setBuyingPackageId(packageId);
    setError(null);

    const result = await createCheckoutSession(organization.id, packageId);

    if ("error" in result) {
      setBuyingPackageId(null);
      setError(result.error);
      return;
    }

    window.location.href = result.checkoutUrl;
  }

  async function handleSubmitClaim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization || !user || !bankReference.trim()) return;

    const pkg = CREDIT_PACKAGES.find((p) => p.id === bankPackageId);
    if (!pkg) return;

    setIsSubmittingClaim(true);
    setError(null);

    const { error: insertError } = await supabase.from("payment_orders").insert({
      organization_id: organization.id,
      created_by: user.id,
      gateway: "manual_bank_transfer",
      credits_purchased: pkg.credits,
      amount_cents: pkg.priceCents,
      currency: "usd",
      status: "awaiting_verification",
      bank_transfer_reference: bankReference.trim()
    });

    setIsSubmittingClaim(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    await supabase.from("notifications").insert({
      user_id: user.id,
      organization_id: organization.id,
      type: "bank_transfer_submitted",
      title: "Bank transfer claim submitted",
      body: `${pkg.credits.toLocaleString()} credits, reference "${bankReference.trim()}" — awaiting verification.`,
      link: "/dashboard/wallet"
    });

    setBankReference("");
    setClaimSubmitted(true);
    void loadWalletAndOrders();
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Wallet</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Buy AI credits for your organization.
        </p>
      </div>

      {checkoutNotice && (
        <div className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
          {checkoutNotice}
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardContent className="flex items-center gap-3 p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary">
            <WalletIcon className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div>
            <p
              className={`text-2xl font-semibold tabular-nums ${
                !isLoading && (wallet?.balance_credits ?? 0) === 0 ? "text-destructive" : ""
              }`}
            >
              {isLoading ? "…" : (wallet?.balance_credits ?? 0).toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">
              {!isLoading && (wallet?.balance_credits ?? 0) === 0
                ? "credits available — chat, workflows, and teams need at least 1"
                : "credits available"}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Buy with card (Stripe test mode)</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {CREDIT_PACKAGES.map((pkg) => (
            <Card key={pkg.id}>
              <CardHeader>
                <CardTitle className="text-base">{pkg.label}</CardTitle>
                <CardDescription>{pkg.credits.toLocaleString()} credits</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-2xl font-semibold">{formatPrice(pkg.priceCents)}</p>
                <Button
                  className="w-full gap-1.5"
                  disabled={buyingPackageId === pkg.id}
                  onClick={() => void handleBuy(pkg.id)}
                >
                  <CreditCard className="h-4 w-4" strokeWidth={1.75} />
                  {buyingPackageId === pkg.id ? "Redirecting…" : "Buy"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          This project runs Stripe in test mode — use card number 4242 4242 4242 4242,
          any future expiry, and any CVC.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Pay by bank transfer</h2>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Banknote className="h-4 w-4" strokeWidth={1.75} />
              Manual bank transfer
            </CardTitle>
            <CardDescription>
              Transfer to the account below, then submit your reference number. An
              admin verifies transfers manually — credits are added once verified,
              which isn't built into this dashboard yet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 rounded-md border p-3 font-mono text-xs text-muted-foreground">
              Account name: AgentForge AI (example) · Account number: 0000-0000-0000 ·
              Bank: Your Bank Here — replace with real details before launch
            </div>

            {claimSubmitted ? (
              <p className="text-sm text-primary">
                Claim submitted — it's awaiting verification.
              </p>
            ) : (
              <form onSubmit={handleSubmitClaim} className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="bankPackage">Package</Label>
                    <select
                      id="bankPackage"
                      value={bankPackageId}
                      onChange={(event) => setBankPackageId(event.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    >
                      {CREDIT_PACKAGES.map((pkg) => (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.label} — {pkg.credits.toLocaleString()} credits (
                          {formatPrice(pkg.priceCents)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="bankReference">Transfer reference</Label>
                    <Input
                      id="bankReference"
                      required
                      placeholder="e.g. bank confirmation number"
                      value={bankReference}
                      onChange={(event) => setBankReference(event.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Button type="submit" disabled={isSubmittingClaim || !bankReference.trim()}>
                    {isSubmittingClaim ? "Submitting…" : "Submit claim"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Order history</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No orders yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {orders.map((order) => {
              const hasInvoice = order.status === "paid" || order.status === "verified";
              return (
                <li key={order.id}>
                  <Card>
                    <CardContent className="flex items-center justify-between gap-3 p-4 text-sm">
                      <div>
                        <p className="font-medium">
                          {order.credits_purchased.toLocaleString()} credits ·{" "}
                          {formatPrice(order.amount_cents, order.currency.toUpperCase())}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {order.gateway === "stripe" ? "Stripe" : "Bank transfer"} ·{" "}
                          {new Date(order.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {hasInvoice && (
                          <Button asChild size="sm" variant="ghost" className="gap-1.5">
                            <Link to={`/dashboard/wallet/invoice/${order.id}`}>
                              <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
                              Invoice
                            </Link>
                          </Button>
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            hasInvoice
                              ? "bg-primary/10 text-primary"
                              : order.status === "failed" || order.status === "rejected"
                                ? "bg-destructive/10 text-destructive"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {STATUS_LABELS[order.status]}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Recent usage</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : ledger.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No credits spent yet — usage from chat, workflows, and teams shows up
            here.
          </p>
        ) : (
          <Card>
            <CardContent className="flex flex-col divide-y p-0">
              {ledger.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">
                    {CHARGE_REASON_LABELS[entry.reason]} ·{" "}
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                  <span className="font-medium tabular-nums">{entry.amount}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
