import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { TradeOnboarding } from "@/components/TradeOnboarding";
import { FeaturesBento } from "@/components/features/FeaturesBento";
import { LiveQuoteDemo } from "@/components/LiveQuoteDemo";
import { RoiCalculator } from "@/components/RoiCalculator";
import { Pricing } from "@/components/Pricing";
import { Faq } from "@/components/Faq";
import { Footer } from "@/components/Footer";
import { VideoSection } from "@/components/site/VideoSection";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="overflow-x-clip">
        <Hero />
        <TradeOnboarding />
        <FeaturesBento />
        <VideoSection page="accueil" title="Biltov en action" subtitle="Trois vidéos pour voir comment Biltov règle la paperasse, du chantier jusqu'au paiement." />
        <LiveQuoteDemo />
        <RoiCalculator />
        <Pricing />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
