import { useEffect, useState } from "react";
import { Bot, Building2, Coins, DollarSign, Store, Users } from "lucide-react";
import { Card, CardContent } from "@agentforge/ui";

import { formatPrice } from "@/lib/credit-packages";
import { supabase } from "@/lib/supabase/client";

interface Stats {
  total_organizations: number;
  total_users: number;
  total_ai_employees: number;
  total_marketplace_listings: number;
  total_credits_purchased: number;
  total_credits_spent: number;
  total_revenue_cents: number;
}

export function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    supabase.rpc("get_platform_stats").then(({ data, error: rpcError }) => {
      if (!isMounted) return;
      if (rpcError) {
        setError(rpcError.message);
      } else {
        setStats(data?.[0] ?? null);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Platform overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Stats across every organization on AgentForge, not just your own.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!stats && !error ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard icon={Building2} label="Organizations" value={stats.total_organizations} />
          <StatCard icon={Users} label="Users" value={stats.total_users} />
          <StatCard icon={Bot} label="AI Employees" value={stats.total_ai_employees} />
          <StatCard icon={Store} label="Published listings" value={stats.total_marketplace_listings} />
          <StatCard icon={Coins} label="Credits purchased" value={stats.total_credits_purchased} />
          <StatCard icon={Coins} label="Credits spent" value={stats.total_credits_spent} />
          <StatCard
            icon={DollarSign}
            label="Revenue"
            value={formatPrice(stats.total_revenue_cents)}
          />
        </div>
      ) : null}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Coins;
  label: string;
  value: number | string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div>
          <p className="text-xl font-semibold tabular-nums">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
