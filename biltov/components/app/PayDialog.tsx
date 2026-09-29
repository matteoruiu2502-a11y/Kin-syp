"use client";

import { useState } from "react";
import { todayIso } from "@/lib/app/defaults";
import { computeTotals, eur } from "@/lib/app/money";
import type { Doc } from "@/lib/app/types";
import { Field, Modal, inputClass } from "./ui";

const METHODS = ["Virement", "Chèque", "Carte bancaire", "Espèces", "Prélèvement"];

export function PayDialog({ doc, onClose, onPaid }: { doc: Doc; onClose: () => void; onPaid: (date: string, method: string) => void }) {
  const [date, setDate] = useState(todayIso());
  const [method, setMethod] = useState(METHODS[0]);
  return (
    <Modal
      title={`Paiement de la facture ${doc.number}`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost text-sm">
            Annuler
          </button>
          <button onClick={() => onPaid(date, method)} className="btn-primary text-sm">
            Enregistrer le paiement de {eur(computeTotals(doc).due)}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date de réception">
          <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Moyen de paiement">
          <select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value)}>
            {METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
      </div>
      <p className="mt-4 text-xs text-slate-500">Les relances automatiques s&apos;arrêtent dès que la facture est marquée payée.</p>
    </Modal>
  );
}
