"use client";

import { useState } from "react";
import { ArrowRight, LogOut } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAppData } from "@/lib/app/store";
import { useTr } from "@/lib/app/tr";
import { starterCatalog } from "@/lib/app/catalog/starter";
import { BiltovLogo } from "../BiltovLogo";
import { CompanyForm, companyMissing } from "./CompanyForm";
import { BrandingForm } from "./BrandingForm";
import { Notice, Toggle } from "./ui";

/** Première connexion : identité de l'entreprise (obligatoire pour émettre) + catalogue de démarrage. */
export function Onboarding() {
  const { t } = useTr();
  const { t: land } = useI18n();
  const { data, update, logOut, account } = useAppData();
  const [company, setCompany] = useState(data.company);
  const [branding, setBranding] = useState(data.branding);
  const [starter, setStarter] = useState(true);
  const [showErrors, setShowErrors] = useState(false);

  const save = () => {
    setShowErrors(true);
    if (companyMissing(company)) return window.scrollTo({ top: 0, behavior: "smooth" });
    update((d) => ({ ...d, company, branding, articles: starter && !d.articles.length ? starterCatalog(company.trade) : d.articles }));
  };

  return (
    <div className="relative min-h-dvh px-4 py-10">
      <div className="bg-grid pointer-events-none fixed inset-0 -z-10 opacity-60" aria-hidden />
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between">
          <BiltovLogo size={32} />
          <button onClick={logOut} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
            <LogOut className="h-4 w-4" /> {account?.email}
          </button>
        </div>
        <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">{t("Votre entreprise")}</h1>
        <p className="mt-2 text-slate-400">{t("Ces informations figurent sur vos devis et factures. Vous pourrez les modifier dans les paramètres.")}</p>
        {showErrors && companyMissing(company) && (
          <div className="mt-6">
            <Notice tone="warn">{t("Complétez les champs signalés en rouge pour continuer.")}</Notice>
          </div>
        )}
        <div className="card mt-8 space-y-10 p-6 sm:p-8">
          <CompanyForm value={company} onChange={setCompany} showErrors={showErrors} />
          <BrandingForm value={branding} onChange={setBranding} />
          <Toggle checked={starter} onChange={setStarter} label={t("Charger le catalogue de démarrage de mon métier")} hint={`${land.trades.list.find((x) => x.id === company.trade)?.name ?? ""} — ${t("articles et main-d'œuvre FR/NL/DE, prix modifiables")}`} />
        </div>
        <div className="mt-6 flex justify-end">
          <button onClick={save} className="btn-primary">
            {t("Accéder à mon espace")} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
