import { Link } from "react-router-dom";
import { Button } from "@agentforge/ui";

import { BlueprintGrid } from "@/components/landing/blueprint-grid";
import { SchematicIllustration } from "@/components/landing/schematic-illustration";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-[#1E3A5F] bg-[#0B1220]">
      <BlueprintGrid />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-2 lg:items-center lg:py-28">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#5EEAD4]">
            AI workforce, assembled
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.1] text-[#F5F7FA] sm:text-5xl">
            Forge AI employees your company can actually rely on.
          </h1>
          <p className="mt-5 max-w-lg font-body text-base leading-relaxed text-[#8FA8C2] sm:text-lg">
            Give them memory, connect your knowledge, wire up tools, and put them to
            work — one AI Employee at a time, built from parts you control instead of
            a black-box chatbot.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="bg-[#FF8A3D] text-[#0B1220] hover:bg-[#FF8A3D]/90"
            >
              <Link to="/signup">Get started free</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-[#2C4864] bg-transparent text-[#F5F7FA] hover:bg-[#16233B]"
            >
              <a href="#how-it-works">See how it works</a>
            </Button>
          </div>

          <p className="mt-6 font-mono text-xs text-[#5B7794]">
            No credit card required — free tier covers your first AI Employee.
          </p>
        </div>

        <div className="flex justify-center lg:justify-end">
          <SchematicIllustration />
        </div>
      </div>
    </section>
  );
}
