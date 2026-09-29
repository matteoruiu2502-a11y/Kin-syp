import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { TradeOnboarding } from "@/components/TradeOnboarding";
import { FeaturesBento } from "@/components/features/FeaturesBento";
import { LiveQuoteDemo } from "@/components/LiveQuoteDemo";
import { RoiCalculator } from "@/components/RoiCalculator";
import { Pricing } from "@/components/Pricing";
import { Faq } from "@/components/Faq";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="overflow-x-clip">
        <Hero />
        <TradeOnboarding />
        <FeaturesBento />
        <LiveQuoteDemo />
        <RoiCalculator />
        <Pricing />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
