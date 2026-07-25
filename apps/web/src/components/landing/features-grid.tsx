import { Bot, Brain, Database, Store, Users, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Feature {
  tag: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

const features: Feature[] = [
  {
    tag: "MOD.00",
    title: "Reasoning core",
    description:
      "Pick the model behind each AI Employee — and switch providers per employee, per conversation, or organization-wide.",
    icon: Bot
  },
  {
    tag: "MOD.01",
    title: "Memory",
    description:
      "Employees remember prior conversations and context, so they get more useful the longer you work with them.",
    icon: Brain
  },
  {
    tag: "MOD.02",
    title: "Knowledge",
    description:
      "Connect documents and data sources so answers are grounded in your material, not just general training data.",
    icon: Database
  },
  {
    tag: "MOD.03",
    title: "Tools",
    description:
      "Give employees the ability to call APIs, browse, and take action — not just talk about the work.",
    icon: Zap
  },
  {
    tag: "MOD.04",
    title: "Teams",
    description:
      "Group employees into multi-agent teams that hand work off to each other on more complex jobs.",
    icon: Users
  },
  {
    tag: "MOD.05",
    title: "Marketplace",
    description:
      "Publish an employee, prompt pack, or workflow template — or install one someone else already built.",
    icon: Store
  }
];

export function FeaturesGrid() {
  return (
    <section id="features" className="bg-[#0B1220] px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#5EEAD4]">
          Parts list
        </p>
        <h2 className="mt-3 font-display text-3xl font-semibold text-[#F5F7FA]">
          Every employee is built from the same modules.
        </h2>

        <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-[#1E3A5F] bg-[#1E3A5F] sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ tag, title, description, icon: Icon }) => (
            <div key={tag} className="flex flex-col gap-3 bg-[#111B2E] p-6">
              <div className="flex items-center justify-between">
                <Icon className="h-5 w-5 text-[#5EEAD4]" strokeWidth={1.5} />
                <span className="font-mono text-[10px] text-[#5B7794]">{tag}</span>
              </div>
              <h3 className="font-display text-lg font-semibold text-[#F5F7FA]">
                {title}
              </h3>
              <p className="font-body text-sm leading-relaxed text-[#8FA8C2]">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
