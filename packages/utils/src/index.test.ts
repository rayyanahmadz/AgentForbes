import { describe, expect, it } from "vitest";
import { formatDate, getInitials, sleep, truncate } from "./index";

describe("formatDate", () => {
  it("formats a Date object", () => {
    // Constructed from local components (year, month, day) rather than an
    // ISO string, so this is immune to the test runner's timezone: both the
    // construction and Intl's default formatting use local time, and stay
    // consistent with each other regardless of what "local" is.
    expect(formatDate(new Date(2026, 0, 15))).toBe("Jan 15, 2026");
  });

  it("formats a date string with no timezone offset as local time", () => {
    // A date-time string with no timezone designator is spec'd (ECMA-262)
    // to be interpreted as local time, not UTC — matching the Date-object
    // case above, so this is timezone-safe for the same reason. (A "Z" or
    // "+HH:MM" suffix would instead be interpreted as UTC/that offset and
    // could shift to a different local day depending on the runner's
    // timezone — deliberately avoided here.)
    expect(formatDate("2026-01-15T00:00:00")).toBe("Jan 15, 2026");
  });

  it("formats a bare date-only string (no time component) as that exact calendar day", () => {
    // The specific case formatDate() has a dedicated branch for: per
    // ECMA-262, a DATE-only string (unlike a date-TIME string with no
    // offset, tested above) parses as UTC midnight, not local time. Without
    // the date-only branch in formatDate(), this would render as "Jan 14"
    // in any timezone behind UTC. Using a local Date for comparison (not a
    // hardcoded string) keeps this assertion itself timezone-safe.
    const expected = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    }).format(new Date(2026, 0, 15));
    expect(formatDate("2026-01-15")).toBe(expected);
  });
});

describe("truncate", () => {
  it("returns the original text if it's within maxLength", () => {
    expect(truncate("Hi", 10)).toBe("Hi");
    expect(truncate("Hello", 5)).toBe("Hello");
  });

  it("truncates and appends an ellipsis if text exceeds maxLength", () => {
    expect(truncate("Hello World", 5)).toBe("Hello…");
  });

  it("trims trailing whitespace left by the cut before adding the ellipsis", () => {
    expect(truncate("Hello   World", 8)).toBe("Hello…");
  });
});

describe("sleep", () => {
  it("resolves after roughly the given delay", async () => {
    const start = Date.now();
    await sleep(20);
    expect(Date.now() - start).toBeGreaterThanOrEqual(15);
  });
});

describe("getInitials", () => {
  it("returns the fallback for null, undefined, or empty/whitespace-only input", () => {
    expect(getInitials(null)).toBe("?");
    expect(getInitials(undefined)).toBe("?");
    expect(getInitials("")).toBe("?");
    expect(getInitials("   ")).toBe("?");
  });

  it("supports a custom fallback", () => {
    expect(getInitials(null, "??")).toBe("??");
  });

  it("uses the first two letters, uppercased, for a single word", () => {
    expect(getInitials("Madonna")).toBe("MA");
  });

  it("uses first-letter-of-first + first-letter-of-last for multiple words", () => {
    expect(getInitials("Jane Doe")).toBe("JD");
  });

  it("ignores middle names/words", () => {
    expect(getInitials("Jane Middle Doe")).toBe("JD");
  });

  it("uppercases lowercase input", () => {
    expect(getInitials("jane doe")).toBe("JD");
  });
});
