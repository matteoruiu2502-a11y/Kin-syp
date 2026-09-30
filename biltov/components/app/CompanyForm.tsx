"use client";

import { Building2, Landmark, Scale, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTr } from "@/lib/app/tr";
import { formatBeVat, isBce, isIban, vatFromBce } from "@/lib/tax/belgium";
import { LEGAL_FORMS, type Company, type Lang } from "@/lib/app/types";
import { Field, inputClass } from "./ui";

const Section = ({ icon: Icon, title, children }: { icon: typeof Building2; title: string; children: React.ReactNode }) => (
  <section className="space-y-4">
    <h3 className="flex items-center gap-2 font-display text-base font-bold text-white">
      <Icon className="h-4 w-4 text-cyan" /> {title}
    </h3>
    <div className="grid gap-4 sm:grid-cols-2">{children}</div>
  </section>
);

export const formatIban = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 34).replace(/(.{4})/g, "$1 ").trim();

/** Identité de l'entreprise : alimente l'en-tête, le pied de page et les mentions de chaque document. */
export function CompanyForm({ value, onChange, showErrors }: { value: Company; onChange: (c: Company) => void; showErrors: boolean }) {
  const { t: land } = useI18n();
  const { t } = useTr();
  const set = <K extends keyof Company>(k: K, v: Company[K]) => onChange({ ...value, [k]: v });
  const req = (v: string) => showErrors && !v.trim() && t("Obligatoire");

  return (
    <div className="space-y-8">
      <Section icon={Building2} title={t("Entreprise")}>
        <Field label={`${t("Nom / raison sociale")} *`} error={req(value.name)}>
          <input className={inputClass} value={value.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label={`${t("Gérant / indépendant")} *`} error={req(value.owner)}>
          <input className={inputClass} value={value.owner} onChange={(e) => set("owner", e.target.value)} />
        </Field>
        <Field label={t("Forme juridique")}>
          <select className={inputClass} value={value.legalForm} onChange={(e) => set("legalForm", e.target.value as Company["legalForm"])}>
            {LEGAL_FORMS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </Field>
        <Field label={t("Métier principal")}>
          <select className={inputClass} value={value.trade} onChange={(e) => set("trade", e.target.value as Company["trade"])}>
            {land.trades.list.map((tr) => (
              <option key={tr.id} value={tr.id}>
                {tr.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`${t("Rue et numéro")} *`} error={req(value.address.street)} className="sm:col-span-2">
          <input className={inputClass} value={value.address.street} onChange={(e) => set("address", { ...value.address, street: e.target.value })} />
        </Field>
        <Field label={`${t("Code postal")} *`} error={req(value.address.postcode)}>
          <input className={inputClass} value={value.address.postcode} inputMode="numeric" onChange={(e) => set("address", { ...value.address, postcode: e.target.value })} />
        </Field>
        <Field label={`${t("Localité")} *`} error={req(value.address.city)}>
          <input className={inputClass} value={value.address.city} onChange={(e) => set("address", { ...value.address, city: e.target.value })} />
        </Field>
        <Field label={t("Téléphone")}>
          <input className={inputClass} type="tel" value={value.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label={`${t("E-mail")} *`} error={req(value.email)}>
          <input className={inputClass} type="email" value={value.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label={t("Langue par défaut des documents")}>
          <select className={inputClass} value={value.lang} onChange={(e) => set("lang", e.target.value as Lang)}>
            <option value="fr">Français</option>
            <option value="nl">Nederlands</option>
            <option value="de">Deutsch</option>
          </select>
        </Field>
        <Field label={t("Site web")}>
          <input className={inputClass} value={value.website} onChange={(e) => set("website", e.target.value)} />
        </Field>
      </Section>

      <Section icon={Scale} title={t("Numéro d'entreprise & TVA")}>
        <Field
          label={`${t("Numéro d'entreprise (BCE)")} *`}
          error={showErrors && (!value.bce.trim() ? t("Obligatoire") : !isBce(value.bce) && t("Numéro invalide (contrôle modulo 97)"))}
          hint={isBce(value.bce) && value.vatRegime === "normal" ? `${t("N° de TVA")} : ${formatBeVat(vatFromBce(value.bce))}` : t("Format 0xxx.xxx.xxx")}
        >
          <input className={inputClass} value={value.bce} inputMode="numeric" onChange={(e) => set("bce", e.target.value)} placeholder="0xxx.xxx.xxx" />
        </Field>
        <Field label={t("Régime de TVA")}>
          <select className={inputClass} value={value.vatRegime} onChange={(e) => set("vatRegime", e.target.value as Company["vatRegime"])}>
            <option value="normal">{t("Assujetti (régime normal)")}</option>
            <option value="franchise">{t("Franchise des petites entreprises")}</option>
          </select>
        </Field>
        <Field label={t("RPM (personnes morales)")} hint={t("Ex. « RPM Liège »")}>
          <input className={inputClass} value={value.rpm} onChange={(e) => set("rpm", e.target.value)} />
        </Field>
      </Section>

      <Section icon={ShieldCheck} title={t("Assurance")}>
        <Field label={t("Assureur (RC / décennale)")}>
          <input className={inputClass} value={value.insurer} onChange={(e) => set("insurer", e.target.value)} />
        </Field>
        <Field label={t("N° de police")}>
          <input className={inputClass} value={value.policyNumber} onChange={(e) => set("policyNumber", e.target.value)} />
        </Field>
        <Field label={t("Coordonnées de l'assureur")} className="sm:col-span-2">
          <input className={inputClass} value={value.insurerContact} onChange={(e) => set("insurerContact", e.target.value)} />
        </Field>
      </Section>

      <Section icon={Landmark} title={t("Coordonnées bancaires")}>
        <Field label={`${t("IBAN")} *`} error={showErrors && (!value.iban.trim() ? t("Obligatoire") : !isIban(value.iban) && t("IBAN invalide"))}>
          <input className={`${inputClass} font-mono`} value={value.iban} onChange={(e) => set("iban", formatIban(e.target.value))} placeholder="BE68 5390 0754 7034" spellCheck={false} />
        </Field>
        <Field label="BIC">
          <input className={`${inputClass} font-mono`} value={value.bic} onChange={(e) => set("bic", e.target.value.toUpperCase())} spellCheck={false} />
        </Field>
      </Section>
    </div>
  );
}

export const companyMissing = (c: Company) => !c.name.trim() || !c.owner.trim() || !c.address.street.trim() || !c.address.city.trim() || !c.email.trim() || !isBce(c.bce) || !isIban(c.iban);
