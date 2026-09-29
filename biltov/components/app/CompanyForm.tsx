"use client";

import { Building2, Landmark, Scale, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatIban, frVatFromSiren, isFrVat, isIban, isSiret } from "@/lib/app/legal";
import { LEGAL_FORMS, type Company } from "@/lib/app/types";
import { Field, Toggle, inputClass } from "./ui";

const Section = ({ icon: Icon, title, children }: { icon: typeof Building2; title: string; children: React.ReactNode }) => (
  <section className="space-y-4">
    <h3 className="flex items-center gap-2 font-display text-base font-bold text-white">
      <Icon className="h-4 w-4 text-cyan" /> {title}
    </h3>
    <div className="grid gap-4 sm:grid-cols-2">{children}</div>
  </section>
);

/** Identité légale de l'entreprise : alimente l'en-tête et les mentions de chaque devis et facture. */
export function CompanyForm({ value, onChange, showErrors }: { value: Company; onChange: (c: Company) => void; showErrors: boolean }) {
  const { t } = useI18n();
  const set = <K extends keyof Company>(k: K, v: Company[K]) => onChange({ ...value, [k]: v });
  const req = (k: keyof Company) => showErrors && !String(value[k] ?? "").trim() && "Obligatoire";
  const isCompany = !["EI", "EI (micro-entreprise)"].includes(value.legalForm);
  const siretErr = showErrors && (!value.siret.trim() ? "Obligatoire" : !isSiret(value.siret) && "SIRET invalide (14 chiffres, clé de contrôle)");
  const vatErr =
    showErrors && value.vatMode === "normal" && (!value.vatNumber.trim() ? "Obligatoire si vous facturez la TVA" : value.vatNumber.toUpperCase().startsWith("FR") && !isFrVat(value.vatNumber) && "Numéro de TVA invalide");

  return (
    <div className="space-y-8">
      <Section icon={Building2} title="Entreprise">
        <Field label="Raison sociale / nom commercial *" error={req("name")}>
          <input className={inputClass} value={value.name} onChange={(e) => set("name", e.target.value)} placeholder="Dupont Rénovation" />
        </Field>
        <Field label="Dirigeant / entrepreneur *" error={req("owner")}>
          <input className={inputClass} value={value.owner} onChange={(e) => set("owner", e.target.value)} placeholder="Jean Dupont" />
        </Field>
        <Field label="Forme juridique">
          <select className={inputClass} value={value.legalForm} onChange={(e) => set("legalForm", e.target.value as Company["legalForm"])}>
            {LEGAL_FORMS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </Field>
        {isCompany ? (
          <Field label="Capital social" hint="Obligatoire pour les sociétés">
            <input className={inputClass} value={value.capital} onChange={(e) => set("capital", e.target.value)} placeholder="10 000 €" />
          </Field>
        ) : (
          <Field label="Métier principal">
            <select className={inputClass} value={value.trade} onChange={(e) => set("trade", e.target.value as Company["trade"])}>
              {t.trades.list.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Adresse du siège *" error={req("address")} className="sm:col-span-2">
          <input className={inputClass} value={value.address} onChange={(e) => set("address", e.target.value)} placeholder="12 rue des Artisans" />
        </Field>
        <Field label="Code postal *" error={req("postcode")}>
          <input className={inputClass} value={value.postcode} onChange={(e) => set("postcode", e.target.value)} inputMode="numeric" />
        </Field>
        <Field label="Ville *" error={req("city")}>
          <input className={inputClass} value={value.city} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label="Téléphone">
          <input className={inputClass} value={value.phone} onChange={(e) => set("phone", e.target.value)} type="tel" />
        </Field>
        <Field label="E-mail professionnel *" error={req("email")}>
          <input className={inputClass} value={value.email} onChange={(e) => set("email", e.target.value)} type="email" />
        </Field>
      </Section>

      <Section icon={Scale} title="Immatriculation & TVA">
        <Field label="SIRET *" error={siretErr} hint="14 chiffres — vérifié avec la clé de contrôle">
          <input
            className={inputClass}
            value={value.siret}
            inputMode="numeric"
            onChange={(e) => {
              const siret = e.target.value;
              const auto = !value.vatNumber && isSiret(siret) ? frVatFromSiren(siret.replace(/\D/g, "").slice(0, 9)) : value.vatNumber;
              onChange({ ...value, siret, vatNumber: value.vatMode === "normal" ? auto : value.vatNumber });
            }}
          />
        </Field>
        <Field label="Immatriculation (RCS ou RM)" hint="Ex. « RCS Lyon 912 345 678 » ou « RM 69 912 345 678 »">
          <input className={inputClass} value={value.registry} onChange={(e) => set("registry", e.target.value)} />
        </Field>
        <Field label="Régime de TVA">
          <select className={inputClass} value={value.vatMode} onChange={(e) => set("vatMode", e.target.value as Company["vatMode"])}>
            <option value="normal">Assujetti à la TVA</option>
            <option value="franchise">Franchise en base (art. 293 B du CGI)</option>
          </select>
        </Field>
        {value.vatMode === "normal" && (
          <Field label="N° de TVA intracommunautaire *" error={vatErr} hint="Calculé automatiquement à partir du SIRET">
            <input className={inputClass} value={value.vatNumber} onChange={(e) => set("vatNumber", e.target.value.toUpperCase())} />
          </Field>
        )}
        {value.vatMode === "normal" && (
          <div className="sm:col-span-2">
            <Toggle checked={value.vatOnDebits} onChange={(v) => set("vatOnDebits", v)} label="Option pour le paiement de la TVA d'après les débits" hint="Mention ajoutée automatiquement sur vos factures si vous avez choisi cette option." />
          </div>
        )}
      </Section>

      <Section icon={ShieldCheck} title="Assurance décennale / RC pro (obligatoire sur les devis et factures BTP)">
        <Field label="Assureur *" error={req("insurer")}>
          <input className={inputClass} value={value.insurer} onChange={(e) => set("insurer", e.target.value)} placeholder="SMABTP" />
        </Field>
        <Field label="N° de contrat *" error={req("policyNumber")}>
          <input className={inputClass} value={value.policyNumber} onChange={(e) => set("policyNumber", e.target.value)} />
        </Field>
        <Field label="Coordonnées de l'assureur">
          <input className={inputClass} value={value.insurerContact} onChange={(e) => set("insurerContact", e.target.value)} placeholder="8 rue Louis Armand, 75015 Paris" />
        </Field>
        <Field label="Couverture géographique *" error={req("coverage")}>
          <input className={inputClass} value={value.coverage} onChange={(e) => set("coverage", e.target.value)} />
        </Field>
        <Field label="Médiateur de la consommation" hint="Obligatoire si vous travaillez pour des particuliers">
          <input className={inputClass} value={value.mediatorName} onChange={(e) => set("mediatorName", e.target.value)} placeholder="CM2C" />
        </Field>
        <Field label="Site du médiateur">
          <input className={inputClass} value={value.mediatorUrl} onChange={(e) => set("mediatorUrl", e.target.value)} placeholder="https://www.cm2c.net" />
        </Field>
      </Section>

      <Section icon={Landmark} title="Coordonnées bancaires (affichées sur les factures)">
        <Field label="IBAN" error={showErrors && !!value.iban && !isIban(value.iban) && "IBAN invalide"}>
          <input className={`${inputClass} font-mono`} value={value.iban} onChange={(e) => set("iban", formatIban(e.target.value))} spellCheck={false} />
        </Field>
        <Field label="BIC">
          <input className={`${inputClass} font-mono`} value={value.bic} onChange={(e) => set("bic", e.target.value.toUpperCase())} spellCheck={false} />
        </Field>
      </Section>
    </div>
  );
}
