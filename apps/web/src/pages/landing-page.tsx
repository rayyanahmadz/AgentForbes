import { CtaBanner } from "@/components/landing/cta-banner";
import { FeaturesGrid } from "@/components/landing/features-grid";
import { LandingFooter } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { LandingNavbar } from "@/components/landing/navbar";

export function LandingPage() {
  return (
    <div className="font-body">
      <LandingNavbar />
      <Hero />
      <FeaturesGrid />
      <HowItWorks />
      <CtaBanner />
      <LandingFooter />
    </div>
  );
}
