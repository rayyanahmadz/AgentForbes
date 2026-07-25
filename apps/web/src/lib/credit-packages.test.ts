import { describe, expect, it } from "vitest";
import { CREDIT_PACKAGES, formatPrice } from "./credit-packages";

describe("formatPrice", () => {
  it("formats cents as a USD currency string by default", () => {
    expect(formatPrice(500)).toBe("$5.00");
    expect(formatPrice(2000)).toBe("$20.00");
  });

  it("formats zero correctly", () => {
    expect(formatPrice(0)).toBe("$0.00");
  });

  it("rounds to two decimal places for non-round cent amounts", () => {
    expect(formatPrice(1099)).toBe("$10.99");
  });

  it("accepts an explicit currency", () => {
    expect(formatPrice(4000, "USD")).toBe("$40.00");
  });
});

describe("CREDIT_PACKAGES", () => {
  it("has unique ids", () => {
    const ids = CREDIT_PACKAGES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every package has a positive price and credit amount", () => {
    for (const pkg of CREDIT_PACKAGES) {
      expect(pkg.priceCents).toBeGreaterThan(0);
      expect(pkg.credits).toBeGreaterThan(0);
    }
  });
});
