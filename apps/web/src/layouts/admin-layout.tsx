import { Link, NavLink, Outlet } from "react-router-dom";
import { ArrowLeft, Banknote, LayoutDashboard, Store } from "lucide-react";

import { usePlatformAdmin } from "@/hooks/use-platform-admin";

const adminNavItems = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/bank-transfers", label: "Bank Transfers", icon: Banknote, end: false },
  { to: "/admin/marketplace", label: "Marketplace", icon: Store, end: false }
];

export function AdminLayout() {
  const { isPlatformAdmin, isLoading } = usePlatformAdmin();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Checking access…</p>
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4 text-center">
        <p className="text-lg font-semibold">Not authorized</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          This area is for AgentForge platform staff only, separate from your
          organization's own permissions.
        </p>
        <Link to="/dashboard" className="text-sm text-primary underline">
          Back to your dashboard
        </Link>
      </div>
    );
  }

  return (
<div className="flex h-screen overflow-hidden bg-background">      <aside className="flex w-64 flex-col border-r bg-card">
        <div className="border-b px-5 py-5">
          <p className="font-semibold tracking-tight">AgentForge</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Platform Admin</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {adminNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-secondary font-medium text-secondary-foreground"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                }`
              }
            >
              <item.icon className="h-4 w-4" strokeWidth={1.75} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t p-3">
          <Link
            to="/dashboard"
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            Back to dashboard
          </Link>
        </div>
      </aside>
<main className="min-h-0 min-w-0 flex-1 overflow-y-auto">        <div className="mx-auto max-w-4xl px-8 py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
