export interface CreditPackage {
  id: string;
  label: string;
  credits: number;
  priceCents: number;
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: "starter", label: "Starter", credits: 500, priceCents: 500 },
  { id: "growth", label: "Growth", credits: 2500, priceCents: 2000 },
  { id: "scale", label: "Scale", credits: 6000, priceCents: 4000 }
];

export function formatPrice(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}
