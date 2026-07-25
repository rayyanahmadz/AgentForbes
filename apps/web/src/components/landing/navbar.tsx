import { Link } from "react-router-dom";
import { Button } from "@agentforge/ui";

import { useAuth } from "@/contexts/auth-context";

export function LandingNavbar() {
  const { session } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-[#1E3A5F] bg-[#0B1220]/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-semibold text-[#F5F7FA]">
          <span className="flex h-6 w-6 items-center justify-center border border-[#5EEAD4] text-xs text-[#5EEAD4]">
            A
          </span>
          AGENTFORGE
        </Link>

        <nav className="hidden items-center gap-8 font-mono text-xs uppercase tracking-wide text-[#8FA8C2] md:flex">
          <a href="#features" className="transition-colors hover:text-[#5EEAD4]">
            Features
          </a>
          <a href="#how-it-works" className="transition-colors hover:text-[#5EEAD4]">
            How it works
          </a>
        </nav>

        <div className="flex items-center gap-3">
          {session ? (
            <Button asChild size="sm" className="bg-[#FF8A3D] text-[#0B1220] hover:bg-[#FF8A3D]/90">
              <Link to="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button
                asChild
                size="sm"
                variant="ghost"
                className="text-[#F5F7FA] hover:bg-[#16233B] hover:text-[#F5F7FA]"
              >
                <Link to="/login">Log in</Link>
              </Button>
              <Button asChild size="sm" className="bg-[#FF8A3D] text-[#0B1220] hover:bg-[#FF8A3D]/90">
                <Link to="/signup">Get started free</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
