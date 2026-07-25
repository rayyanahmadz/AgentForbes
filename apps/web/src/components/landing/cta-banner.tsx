import { Link } from "react-router-dom";
import { Button } from "@agentforge/ui";

export function CtaBanner() {
  return (
    <section className="border-t border-[#1E3A5F] bg-[#111B2E] px-6 py-16">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 text-center">
        <h2 className="font-display text-3xl font-semibold text-[#F5F7FA] sm:text-4xl">
          Start forging your AI workforce.
        </h2>
        <p className="max-w-md font-body text-[#8FA8C2]">
          Free to start. Bring your own API keys, or use the free development
          provider to try it out today.
        </p>
        <Button
          asChild
          size="lg"
          className="bg-[#FF8A3D] text-[#0B1220] hover:bg-[#FF8A3D]/90"
        >
          <Link to="/signup">Get started free</Link>
        </Button>
      </div>
    </section>
  );
}
