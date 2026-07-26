import { Outlet, useLocation } from "react-router-dom";
import { DashboardSidebar } from "@/components/dashboard/sidebar";

export function DashboardLayout() {
  const location = useLocation();
  const isFullBleed = location.pathname.includes("/chat");

  return (
    <div className="flex h-screen bg-background">
      <DashboardSidebar />

      <main
        className={
          isFullBleed
            ? "flex-1 min-w-0 min-h-0"
            : "flex-1 min-w-0 overflow-y-auto"
        }
      >
        {isFullBleed ? (
          <Outlet />
        ) : (
          <div className="mx-auto max-w-4xl px-8 py-10">
            <Outlet />
          </div>
        )}
      </main>
    </div>
  );
}