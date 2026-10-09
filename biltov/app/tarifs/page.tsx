import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { PricingPage } from "@/components/Pricing";
import { PLANS, PLAN_ORDER } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Tarifs — Biltov",
  description: `Forfaits ${PLAN_ORDER.map((id) => `${PLANS[id].name} (${PLANS[id].monthly} € HTVA / mois)`).join(", ")}. Devis illimités, essai gratuit de 5 jours.`,
};

export default function TarifsPage() {
  return (
    <>
      <Navbar />
      <main className="overflow-x-clip pt-32 sm:pt-40">
        <PricingPage />
      </main>
      <Footer />
    </>
  );
}
