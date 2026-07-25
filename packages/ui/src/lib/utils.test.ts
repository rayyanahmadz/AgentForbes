import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("joins plain string classes", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops falsy values (conditional classes)", () => {
    expect(cn("a", false && "b", undefined, null, "c")).toBe("a c");
  });

  it("supports clsx's object syntax", () => {
    expect(cn("base", { active: true, hidden: false })).toBe("base active");
  });

  it("merges conflicting Tailwind utilities, keeping the last one (tailwind-merge)", () => {
    // px-2 and px-4 are the same utility category (horizontal padding) —
    // tailwind-merge should resolve the conflict by keeping whichever
    // appears last, same as if they'd been written in one class string.
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("leaves non-conflicting classes alone", () => {
    expect(cn("text-sm font-medium", "text-muted-foreground")).toBe(
      "text-sm font-medium text-muted-foreground"
    );
  });
});
