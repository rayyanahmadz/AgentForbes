import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Bot, Coins, Store, Workflow as WorkflowIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@agentforge/ui";

import { useOrganization } from "@/contexts/organization-context";
import { supabase } from "@/lib/supabase/client";
import type { CreditLedgerEntry } from "@/lib/supabase/types";

const DAYS_BACK = 30;
const REASON_LABELS: Record<CreditLedgerEntry["reason"], string> = {
  chat: "Chat messages",
  workflow_step: "Workflow steps",
  team_chat: "Team chat messages"
};

interface DailySpend {
  date: string;
  credits: number;
}

interface WorkflowStat {
  name: string;
  total: number;
  completed: number;
  failed: number;
}

interface EmployeeStat {
  name: string;
  credits: number;
}

function startOfDaysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
}

function dayKey(dateString: string): string {
  return dateString.slice(0, 10);
}

export function AnalyticsPage() {
  const { organization } = useOrganization();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [ledger, setLedger] = useState<CreditLedgerEntry[]>([]);
  const [workflowStats, setWorkflowStats] = useState<WorkflowStat[]>([]);
  const [runTotals, setRunTotals] = useState({ total: 0, completed: 0, failed: 0 });
  const [marketplaceInstalls, setMarketplaceInstalls] = useState(0);
  const [topEmployees, setTopEmployees] = useState<EmployeeStat[]>([]);

  useEffect(() => {
    if (!organization) return;

    let isMounted = true;

    async function load() {
      setIsLoading(true);
      setError(null);

      const since = startOfDaysAgo(DAYS_BACK).toISOString();

      const [
        { data: walletData },
        { data: ledgerData, error: ledgerError },
        { data: runsData },
        { data: workflowsData },
        { data: listingsData }
      ] = await Promise.all([
        supabase
          .from("organization_wallets")
          .select("balance_credits")
          .eq("organization_id", organization!.id)
          .single(),
        supabase
          .from("credit_ledger")
          .select("*")
          .eq("organization_id", organization!.id)
          .gte("created_at", since)
          .order("created_at", { ascending: true }),
        supabase
          .from("workflow_runs")
          .select("workflow_id, status")
          .eq("organization_id", organization!.id),
        supabase.from("workflows").select("id, name").eq("organization_id", organization!.id),
        supabase
          .from("marketplace_listings")
          .select("install_count")
          .eq("organization_id", organization!.id)
      ]);

      if (!isMounted) return;

      if (ledgerError) {
        setError(ledgerError.message);
        setIsLoading(false);
        return;
      }

      setBalance(walletData?.balance_credits ?? 0);
      setLedger(ledgerData ?? []);
      setMarketplaceInstalls(
        (listingsData ?? []).reduce((sum, l) => sum + l.install_count, 0)
      );

      // Workflow runs by workflow — a clean, unambiguous aggregation since
      // each run belongs to exactly one workflow.
      const workflowNameById = new Map((workflowsData ?? []).map((w) => [w.id, w.name]));
      const statsByWorkflow = new Map<string, WorkflowStat>();
      let totalRuns = 0;
      let completedRuns = 0;
      let failedRuns = 0;

      for (const run of runsData ?? []) {
        totalRuns += 1;
        if (run.status === "completed") completedRuns += 1;
        if (run.status === "failed") failedRuns += 1;

        const name = workflowNameById.get(run.workflow_id) ?? "Deleted workflow";
        const existing = statsByWorkflow.get(run.workflow_id) ?? {
          name,
          total: 0,
          completed: 0,
          failed: 0
        };
        existing.total += 1;
        if (run.status === "completed") existing.completed += 1;
        if (run.status === "failed") existing.failed += 1;
        statsByWorkflow.set(run.workflow_id, existing);
      }

      setRunTotals({ total: totalRuns, completed: completedRuns, failed: failedRuns });
      setWorkflowStats(Array.from(statsByWorkflow.values()).sort((a, b) => b.total - a.total));

      // Top employees by chat volume. credit_ledger.reference_id for
      // reason='chat' is a conversation id — a clean 1:1 path to the
      // employee. Deliberately NOT attempting this for workflow_step or
      // team_chat: a workflow run can involve several employees across its
      // steps, and a team conversation's replies come from whichever
      // teammate the lead picked message-by-message — neither maps cleanly
      // to one employee per ledger entry, so it stays out of "top
      // employees" rather than being attributed inexactly.
      const chatEntries = (ledgerData ?? []).filter((entry) => entry.reason === "chat");
      const conversationIds = Array.from(
        new Set(chatEntries.map((entry) => entry.reference_id).filter(Boolean))
      ) as string[];

      if (conversationIds.length > 0) {
        const { data: conversations } = await supabase
          .from("conversations")
          .select("id, ai_employee_id")
          .in("id", conversationIds);

        const employeeIdByConversation = new Map(
          (conversations ?? []).map((c) => [c.id, c.ai_employee_id])
        );
        const employeeIds = Array.from(new Set(employeeIdByConversation.values()));

        const { data: employees } = await supabase
          .from("ai_employees")
          .select("id, name")
          .in("id", employeeIds.length > 0 ? employeeIds : [""]);

        const employeeNameById = new Map((employees ?? []).map((e) => [e.id, e.name]));
        const creditsByEmployee = new Map<string, number>();

        for (const entry of chatEntries) {
          const employeeId = entry.reference_id
            ? employeeIdByConversation.get(entry.reference_id)
            : undefined;
          if (!employeeId) continue;
          creditsByEmployee.set(
            employeeId,
            (creditsByEmployee.get(employeeId) ?? 0) + Math.abs(entry.amount)
          );
        }

        setTopEmployees(
          Array.from(creditsByEmployee.entries())
            .map(([employeeId, credits]) => ({
              name: employeeNameById.get(employeeId) ?? "Deleted employee",
              credits
            }))
            .sort((a, b) => b.credits - a.credits)
            .slice(0, 8)
        );
      } else {
        setTopEmployees([]);
      }

      setIsLoading(false);
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [organization]);

  const dailySpend: DailySpend[] = useMemo(() => {
    const byDay = new Map<string, number>();
    for (let i = DAYS_BACK - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      byDay.set(dayKey(date.toISOString()), 0);
    }
    for (const entry of ledger) {
      const key = dayKey(entry.created_at);
      if (byDay.has(key)) {
        byDay.set(key, (byDay.get(key) ?? 0) + Math.abs(entry.amount));
      }
    }
    return Array.from(byDay.entries()).map(([date, credits]) => ({
      date: date.slice(5), // MM-DD
      credits
    }));
  }, [ledger]);

  const reasonTotals = useMemo(() => {
    const totals: Record<CreditLedgerEntry["reason"], number> = {
      chat: 0,
      workflow_step: 0,
      team_chat: 0
    };
    for (const entry of ledger) {
totals[entry.reason] = (totals[entry.reason] ?? 0) + Math.abs(entry.amount);    }
    return totals;
  }, [ledger]);

  const totalSpent30d = ledger.reduce((sum, entry) => sum + Math.abs(entry.amount), 0);
  const successRate =
    runTotals.total > 0 ? Math.round((runTotals.completed / runTotals.total) * 100) : null;
  const maxReasonTotal = Math.max(1, ...Object.values(reasonTotals));
  const maxEmployeeCredits = Math.max(1, ...topEmployees.map((e) => e.credits));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your organization's usage over the last {DAYS_BACK} days.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Coins} label="Credit balance" value={balance.toLocaleString()} />
        <StatCard
          icon={Coins}
          label={`Spent (${DAYS_BACK}d)`}
          value={totalSpent30d.toLocaleString()}
        />
        <StatCard
          icon={WorkflowIcon}
          label="Workflow success rate"
          value={successRate === null ? "—" : `${successRate}%`}
        />
        <StatCard
          icon={Store}
          label="Marketplace installs"
          value={marketplaceInstalls.toLocaleString()}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Credit spend, last {DAYS_BACK} days</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailySpend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    interval={Math.ceil(DAYS_BACK / 10)}
                  />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={30} />
                  <Tooltip
                    formatter={(value: number) => [`${value} credits`, "Spent"]}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Bar dataKey="credits" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Spend by feature</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : totalSpent30d === 0 ? (
              <p className="text-sm text-muted-foreground">No usage yet.</p>
            ) : (
              (Object.keys(REASON_LABELS) as CreditLedgerEntry["reason"][]).map((reason) => (
                <div key={reason} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{REASON_LABELS[reason]}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {reasonTotals[reason]}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
style={{
  width: `${
    maxReasonTotal === 0
      ? 0
      : ((reasonTotals[reason] ?? 0) / maxReasonTotal) * 100
  }%`
}}                  />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-4 w-4" strokeWidth={1.75} />
              Top employees by chat messages
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : topEmployees.length === 0 ? (
              <p className="text-sm text-muted-foreground">No chat usage yet.</p>
            ) : (
              topEmployees.map((employee) => (
                <div key={employee.name} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate">{employee.name}</span>
                    <span className="tabular-nums text-muted-foreground">{employee.credits}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(employee.credits / maxEmployeeCredits) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workflow runs by workflow</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : workflowStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">No workflow runs yet.</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {workflowStats.map((stat) => (
                <li key={stat.name} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="truncate font-medium">{stat.name}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {stat.total} runs · {stat.completed} completed · {stat.failed} failed
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
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
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div>
          <p className="text-xl font-semibold tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
