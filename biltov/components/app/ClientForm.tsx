"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAppData } from "@/lib/app/store";
import { useTr } from "@/lib/app/tr";
import { newClient, uid } from "@/lib/app/defaults";
import { audit } from "@/lib/app/ops";
import { CLIENT_KIND } from "@/lib/app/labels";
import { formatBeVat, isBce, isBeVat, normalizeBce, vatFromBce } from "@/lib/tax/belgium";
import { emptyAddress, type Client, type ClientKind, type Lang } from "@/lib/app/types";
import { Field, Modal, Toggle, inputClass } from "./ui";

export function ClientForm({ client, onClose, onSaved }: { client: Client | null; onClose: () => void; onSaved?: (c: Client) => void }) {
  const { t } = useTr();
  const { data, update } = useAppData();
  const [c, setC] = useState<Client>(client ?? newClient({ lang: data.company.lang }));
  const [showErrors, setShowErrors] = useState(false);
  const set = <K extends keyof Client>(k: K, v: Client[K]) => setC((x) => ({ ...x, [k]: v }));
  const pro = c.kind !== "particulier";
  const errors = {
    name: !c.name.trim() && t("Obligatoire"),
    vat: c.kind === "assujetti" && !isBeVat(c.vatNumber) && t("N° de TVA belge valide requis (autoliquidation, Peppol)"),
    bce: c.bce.trim() !== "" && !isBce(c.bce) && t("Numéro invalide (contrôle modulo 97)"),
  };

  const save = () => {
    setShowErrors(true);
    if (Object.values(errors).some(Boolean)) return;
    const saved: Client = { ...c, name: c.name.trim(), vatNumber: c.vatNumber.replace(/[\s.]/g, "").toUpperCase(), peppolId: c.kind === "assujetti" && isBce(c.bce) ? `0208:${normalizeBce(c.bce)}` : "" };
    update((d) => audit({ ...d, clients: d.clients.some((x) => x.id === saved.id) ? d.clients.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...d.clients] }, client ? "update" : "create", "client", saved.id, saved.name));
    onSaved?.(saved);
    onClose();
  };

  return (
    <Modal
      title={client ? t("Modifier le client") : t("Nouveau client")}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost text-sm">
            {t("Annuler")}
          </button>
          <button onClick={save} className="btn-primary text-sm">
            {t("Enregistrer")}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label={t("Type de client")} hint={t("Détermine le taux de TVA (6 %, autoliquidation…) et l'envoi Peppol.")}>
          <select className={inputClass} value={c.kind} onChange={(e) => set("kind", e.target.value as ClientKind)}>
            {(Object.keys(CLIENT_KIND) as ClientKind[]).map((k) => (
              <option key={k} value={k}>
                {t(CLIENT_KIND[k])}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`${pro ? t("Raison sociale") : t("Nom et prénom")} *`} error={showErrors && errors.name}>
            <input className={inputClass} value={c.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label={t("Personne de contact")}>
            <input className={inputClass} value={c.contactName} onChange={(e) => set("contactName", e.target.value)} />
          </Field>
          {pro && (
            <>
              <Field label={t("Numéro d'entreprise (BCE)")} error={showErrors && errors.bce}>
                <input
                  className={inputClass}
                  value={c.bce}
                  onChange={(e) => {
                    const bce = e.target.value;
                    setC((x) => ({ ...x, bce, vatNumber: !x.vatNumber && isBce(bce) ? vatFromBce(bce) : x.vatNumber }));
                  }}
                  placeholder="0xxx.xxx.xxx"
                />
              </Field>
              <Field label={t("N° de TVA")} error={showErrors && errors.vat} hint={isBeVat(c.vatNumber) ? formatBeVat(c.vatNumber) : undefined}>
                <input className={inputClass} value={c.vatNumber} onChange={(e) => set("vatNumber", e.target.value)} placeholder="BE0xxxxxxxxx" />
              </Field>
            </>
          )}
          <Field label={t("Langue des documents")}>
            <select className={inputClass} value={c.lang} onChange={(e) => set("lang", e.target.value as Lang)}>
              <option value="fr">Français</option>
              <option value="nl">Nederlands</option>
              <option value="de">Deutsch</option>
            </select>
          </Field>
          <Field label={t("Grille tarifaire")}>
            <select className={inputClass} value={c.priceListId ?? ""} onChange={(e) => set("priceListId", e.target.value || null)}>
              <option value="">{t("Prix du catalogue")}</option>
              {data.settings.priceLists.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.discountPercent} %)
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("E-mail")}>
            <input className={inputClass} type="email" value={c.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label={t("Téléphone (WhatsApp / SMS)")}>
            <input className={inputClass} type="tel" value={c.phone} onChange={(e) => set("phone", e.target.value)} placeholder="0475 12 34 56" />
          </Field>
        </div>

        <fieldset className="space-y-3">
          <legend className="mb-2 font-display text-base font-bold text-white">{t("Adresse de facturation")}</legend>
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1.5fr]">
            <input className={inputClass} placeholder={t("Rue et numéro")} value={c.billing.street} onChange={(e) => set("billing", { ...c.billing, street: e.target.value })} />
            <input className={inputClass} placeholder={t("Code postal")} value={c.billing.postcode} onChange={(e) => set("billing", { ...c.billing, postcode: e.target.value })} />
            <input className={inputClass} placeholder={t("Localité")} value={c.billing.city} onChange={(e) => set("billing", { ...c.billing, city: e.target.value })} />
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="mb-2 flex w-full items-center justify-between font-display text-base font-bold text-white">
            {t("Adresses de chantier")}
            <button type="button" onClick={() => set("sites", [...c.sites, { ...emptyAddress(), id: uid(), label: "" }])} className="btn-ghost !px-3 !py-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" /> {t("Ajouter")}
            </button>
          </legend>
          {c.sites.map((s, i) => (
            <div key={s.id} className="grid gap-2 sm:grid-cols-[1fr_2fr_1fr_1.5fr_auto]">
              <input className={inputClass} placeholder={t("Nom (ex. seconde résidence)")} value={s.label} onChange={(e) => set("sites", c.sites.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} />
              <input className={inputClass} placeholder={t("Rue et numéro")} value={s.street} onChange={(e) => set("sites", c.sites.map((x, k) => (k === i ? { ...x, street: e.target.value } : x)))} />
              <input className={inputClass} placeholder={t("Code postal")} value={s.postcode} onChange={(e) => set("sites", c.sites.map((x, k) => (k === i ? { ...x, postcode: e.target.value } : x)))} />
              <input className={inputClass} placeholder={t("Localité")} value={s.city} onChange={(e) => set("sites", c.sites.map((x, k) => (k === i ? { ...x, city: e.target.value } : x)))} />
              <button type="button" onClick={() => set("sites", c.sites.filter((_, k) => k !== i))} className="rounded-lg p-2 text-slate-500 hover:text-rose-400" aria-label={t("Supprimer")}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("Origine du contact")}>
            <input className={inputClass} value={c.source} onChange={(e) => set("source", e.target.value)} placeholder={t("Bouche-à-oreille, site web, architecte…")} />
          </Field>
          <Field label={t("Étiquettes")} hint={t("Séparées par des virgules")}>
            <input className={inputClass} value={c.tags.join(", ")} onChange={(e) => set("tags", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} />
          </Field>
          <Field label={t("Notes")} className="sm:col-span-2">
            <textarea className={`${inputClass} resize-y`} rows={3} value={c.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
        <Toggle checked={c.marketingConsent} onChange={(v) => set("marketingConsent", v)} label={t("Accepte de recevoir des communications (entretien annuel, offres)")} hint={t("Consentement RGPD requis pour les campagnes.")} />
      </div>
    </Modal>
  );
}
