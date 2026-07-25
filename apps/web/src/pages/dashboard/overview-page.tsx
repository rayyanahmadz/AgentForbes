import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bot } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@agentforge/ui";

import { useAuth } from "@/contexts/auth-context";
import { useOrganization } from "@/contexts/organization-context";
import { supabase } from "@/lib/supabase/client";

export function OverviewPage() {
  const { profile } = useAuth();
  const { organization, role } = useOrganization();
  const [employeeCount, setEmployeeCount] = useState<number | null>(null);

  useEffect(() => {
    if (!organization) return;

    let isMounted = true;
    supabase
      .from("ai_employees")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .then(({ count }) => {
        if (isMounted) setEmployeeCount(count ?? 0);
      });

    return () => {
      isMounted = false;
    };
  }, [organization]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {organization
            ? `You're working in ${organization.name} as ${role ?? "a member"}.`
            : "Loading your organization…"}
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary">
              <Bot className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div>
              <CardTitle className="text-base">AI Employees</CardTitle>
              <p className="text-sm text-muted-foreground">
                {employeeCount === null
                  ? "Loading…"
                  : employeeCount === 0
                    ? "None configured yet"
                    : `${employeeCount} configured`}
              </p>
            </div>
          </div>
          <Button asChild size="sm">
            <Link to="/dashboard/employees">
              {employeeCount === 0 ? "Create one" : "Manage"}
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Memory, knowledge sources, tools, and conversations land in their own
            upcoming phases — this covers each employee's core spec: name,
            provider, model, and instructions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
