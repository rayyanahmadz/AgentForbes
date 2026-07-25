import { useCallback, useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { Button, Card, CardContent, Input } from "@agentforge/ui";

import { formatPrice } from "@/lib/credit-packages";
import { supabase } from "@/lib/supabase/client";

interface PendingTransfer {
  id: string;
  organization_id: string;
  organization_name: string;
  credits_purchased: number;
  amount_cents: number;
  currency: string;
  bank_transfer_reference: string | null;
  created_at: string;
}

export function AdminBankTransfersPage() {
  const [transfers, setTransfers] = useState<PendingTransfer[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    const { data, error: rpcError } = await supabase.rpc("list_pending_bank_transfers");
    if (rpcError) {
      setError(rpcError.message);
    } else {
      setError(null);
      setTransfers(data ?? []);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDecision(transfer: PendingTransfer, approve: boolean) {
    setProcessingId(transfer.id);
    setError(null);

    const { error: rpcError } = await supabase.rpc("verify_bank_transfer", {
      target_order_id: transfer.id,
      approve,
note: notes[transfer.id]?.trim() || undefined    });

    setProcessingId(null);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setTransfers((current) => current.filter((t) => t.id !== transfer.id));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bank transfer claims</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verify against your actual bank statement before approving — approving
          credits the organization's wallet immediately.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : transfers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No pending claims.
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-4">
          {transfers.map((transfer) => (
            <li key={transfer.id}>
              <Card>
                <CardContent className="flex flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{transfer.organization_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {transfer.credits_purchased.toLocaleString()} credits ·{" "}
                        {formatPrice(transfer.amount_cents, transfer.currency.toUpperCase())}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(transfer.created_at).toLocaleString()}
                    </p>
                  </div>

                  <p className="text-sm">
                    <span className="text-muted-foreground">Reference: </span>
                    <span className="font-mono">{transfer.bank_transfer_reference}</span>
                  </p>

                  <Input
                    placeholder="Optional note (shown to the organization)"
                    value={notes[transfer.id] ?? ""}
                    onChange={(event) =>
                      setNotes((current) => ({ ...current, [transfer.id]: event.target.value }))
                    }
                  />

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="gap-1.5"
                      disabled={processingId === transfer.id}
                      onClick={() => void handleDecision(transfer, true)}
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      disabled={processingId === transfer.id}
                      onClick={() => void handleDecision(transfer, false)}
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
