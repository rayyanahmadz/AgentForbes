import { Link, NavLink } from "react-router-dom";
import { BarChart3, Bot, Building2, Database, KeyRound, LayoutDashboard, LogOut, ShieldCheck, Store, UserRound, Users, Wallet, Workflow } from "lucide-react";
import { Button } from "@agentforge/ui";
import { getInitials } from "@agentforge/utils";

import { NotificationBell } from "@/components/dashboard/notification-bell";
import { OrgSwitcher } from "@/components/dashboard/org-switcher";
import { useAuth } from "@/contexts/auth-context";
import { usePlatformAdmin } from "@/hooks/use-platform-admin";

const navItems = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/dashboard/analytics", label: "Analytics", icon: BarChart3, end: false },
  { to: "/dashboard/employees", label: "AI Employees", icon: Bot, end: false },
  { to: "/dashboard/teams", label: "Teams", icon: Users, end: false },
  { to: "/dashboard/workflows", label: "Workflows", icon: Workflow, end: false },
  { to: "/dashboard/knowledge", label: "Knowledge Base", icon: Database, end: false },
  { to: "/dashboard/marketplace", label: "Marketplace", icon: Store, end: false },
  { to: "/dashboard/wallet", label: "Wallet", icon: Wallet, end: false },
  { to: "/dashboard/settings/members", label: "Members", icon: Users, end: false },
  { to: "/dashboard/settings/api-keys", label: "API Keys", icon: KeyRound, end: false },
  { to: "/dashboard/settings/organization", label: "Organization", icon: Building2, end: false },
  { to: "/dashboard/settings/profile", label: "Profile", icon: UserRound, end: false }
];

export function DashboardSidebar() {
  const { profile, user, signOut } = useAuth();
  const { isPlatformAdmin } = usePlatformAdmin();

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-card print:hidden">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-4">
        <div className="min-w-0 flex-1">
          <p className="px-1.5 text-xs font-medium text-muted-foreground">AgentForge</p>
          <OrgSwitcher />
        </div>
        <NotificationBell />
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`
            }
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} />
            {label}
          </NavLink>
        ))}
      </nav>

      {isPlatformAdmin && (
        <div className="border-t p-3">
          <Link
            to="/admin"
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <ShieldCheck className="h-4 w-4" strokeWidth={1.75} />
            Platform Admin
          </Link>
        </div>
      )}

      <div className="border-t p-3">
        <div className="flex items-center gap-2.5 rounded-md px-2 py-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
            {getInitials(profile?.full_name, user?.email?.slice(0, 2).toUpperCase())}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{profile?.full_name ?? "—"}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 w-full justify-start gap-2.5 text-muted-foreground"
          onClick={() => void signOut()}
        >
          <LogOut className="h-4 w-4" strokeWidth={1.75} />
          Log out
        </Button>
      </div>
    </aside>
  );
}
