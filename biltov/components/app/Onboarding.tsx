"use client";

import { useState } from "react";
import { ArrowRight, LogOut } from "lucide-react";
import { useAppData } from "@/lib/app/store";
import { missingCompanyFields } from "@/lib/app/legal";
import { BiltovLogo } from "../BiltovLogo";
import { CompanyForm } from "./CompanyForm";
import { BrandingForm } from "./BrandingForm";
import { Notice } from "./ui";

/** Première connexion : informations légales obligatoires avant de pouvoir établir un devis. */
export function Onboarding() {
  const { data, updateCompany, updateBranding, logOut, account } = useAppData();
  const [company, setCompany] = useState(data.company);
  const [branding, setBranding] = useState(data.branding);
  const [showErrors, setShowErrors] = useState(false);
  const missing = missingCompanyFields(company);

  const save = () => {
    setShowErrors(true);
    if (missing.length) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    updateBranding(branding);
    updateCompany(company);
  };

  return (
    <div className="relative min-h-screen px-4 py-10">
      <div className="bg-grid pointer-events-none fixed inset-0 -z-10 opacity-60" aria-hidden />
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between">
          <BiltovLogo size={32} />
          <button onClick={logOut} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
            <LogOut className="h-4 w-4" /> {account?.email}
          </button>
        </div>
        <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">Votre entreprise</h1>
        <p className="mt-2 text-slate-400">
          Ces informations figurent obligatoirement sur vos devis et factures (Code de commerce, Code de la consommation, loi Pinel pour l&apos;assurance décennale). Vous pourrez les modifier dans les paramètres.
        </p>
        {showErrors && missing.length > 0 && (
          <div className="mt-6">
            <Notice tone="warn">Complétez les champs signalés en rouge pour continuer.</Notice>
          </div>
        )}
        <div className="card mt-8 space-y-10 p-6 sm:p-8">
          <CompanyForm value={company} onChange={setCompany} showErrors={showErrors} />
          <BrandingForm value={branding} onChange={setBranding} />
        </div>
        <div className="mt-6 flex justify-end">
          <button onClick={save} className="btn-primary">
            Accéder à mon tableau de bord <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
