import { Monitor, Moon, Sun } from "lucide-react";

import { useTheme, type Theme } from "@/contexts/theme-context";

const CYCLE: Theme[] = ["light", "dark", "system"];
const ICONS = { light: Sun, dark: Moon, system: Monitor } as const;
const LABELS = { light: "Light", dark: "Dark", system: "System" } as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const Icon = ICONS[theme];

  function cycleTheme() {
    const currentIndex = CYCLE.indexOf(theme);
    setTheme(CYCLE[(currentIndex + 1) % CYCLE.length]!);
  }

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      aria-label={`Theme: ${LABELS[theme]}. Click to change.`}
      title={`Theme: ${LABELS[theme]}`}
    >
      <Icon className="h-4 w-4" strokeWidth={1.75} />
    </button>
  );
}