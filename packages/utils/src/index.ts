/**
 * @agentforge/utils
 *
 * Framework-agnostic helpers shared across apps. Kept intentionally small
 * for Phase 1 — grows as later phases (auth, billing, AI providers) land.
 */

export function formatDate(input: string | Date): string {
  let date: Date;
  if (typeof input === "string") {
    // Date-only strings (e.g. "2026-01-15") are parsed as UTC midnight by
    // `new Date()`, which can display as the PREVIOUS day in timezones
    // behind UTC (e.g. US Pacific). Parse these from their local-date
    // components instead, so the calendar day shown always matches the
    // string, regardless of the viewer's timezone. Full datetime strings
    // (with a time and/or "Z") represent a specific instant and should
    // still convert to local time normally — that's correct, not a bug.
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
    date = dateOnlyMatch
      ? new Date(
          Number(dateOnlyMatch[1]),
          Number(dateOnlyMatch[2]) - 1,
          Number(dateOnlyMatch[3])
        )
      : new Date(input);
  } else {
    date = input;
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(date);
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}…`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getInitials(name: string | null | undefined, fallback = "?"): string {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}
