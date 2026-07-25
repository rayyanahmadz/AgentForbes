import { Link } from "react-router-dom";

export function LandingFooter() {
  return (
    <footer className="border-t border-[#1E3A5F] bg-[#0B1220] px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:justify-between">
        <div>
          <p className="font-display text-sm font-semibold text-[#F5F7FA]">AGENTFORGE</p>
          <p className="mt-2 max-w-xs font-body text-sm text-[#5B7794]">
            Create, train, and deploy AI Digital Employees.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-2">
          <div>
            <p className="font-mono text-xs uppercase tracking-wide text-[#5B7794]">
              Product
            </p>
            <ul className="mt-3 flex flex-col gap-2 font-body text-sm text-[#8FA8C2]">
              <li>
                <a href="#features" className="hover:text-[#5EEAD4]">
                  Features
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-[#5EEAD4]">
                  How it works
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-mono text-xs uppercase tracking-wide text-[#5B7794]">
              Account
            </p>
            <ul className="mt-3 flex flex-col gap-2 font-body text-sm text-[#8FA8C2]">
              <li>
                <Link to="/login" className="hover:text-[#5EEAD4]">
                  Log in
                </Link>
              </li>
              <li>
                <Link to="/signup" className="hover:text-[#5EEAD4]">
                  Sign up
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-6xl border-t border-[#1E3A5F] pt-6 font-mono text-xs text-[#5B7794]">
        © {new Date().getFullYear()} AgentForge AI.
      </div>
    </footer>
  );
}
