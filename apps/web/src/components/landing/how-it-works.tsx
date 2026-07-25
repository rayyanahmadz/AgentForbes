const stages = [
  {
    code: "01 / SPEC",
    title: "Specify",
    description:
      "Name the employee, choose its model, and set instructions — what it does and how it should behave."
  },
  {
    code: "02 / FORGE",
    title: "Forge",
    description:
      "Attach memory, connect knowledge sources, and give it tools. This is where it becomes useful, not just talkative."
  },
  {
    code: "03 / DEPLOY",
    title: "Deploy",
    description:
      "Put it to work in your dashboard, on a schedule, through the API, or share it with your team."
  }
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-[#1E3A5F] bg-[#0B1220] px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#5EEAD4]">
          Assembly sequence
        </p>
        <h2 className="mt-3 font-display text-3xl font-semibold text-[#F5F7FA]">
          Three stages, start to finish.
        </h2>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {stages.map((stage, index) => (
            <div key={stage.code} className="relative pl-6">
              <span
                aria-hidden="true"
                className="absolute left-0 top-1 h-full w-px bg-[#2C4864] md:hidden"
              />
              {index < stages.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute right-0 top-4 hidden h-px w-8 translate-x-full bg-[#2C4864] md:block"
                />
              )}
              <span className="font-mono text-xs text-[#FF8A3D]">{stage.code}</span>
              <h3 className="mt-2 font-display text-xl font-semibold text-[#F5F7FA]">
                {stage.title}
              </h3>
              <p className="mt-2 font-body text-sm leading-relaxed text-[#8FA8C2]">
                {stage.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
