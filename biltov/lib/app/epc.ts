// QR code de paiement EPC (norme EPC069-12, « SEPA Credit Transfer ») lisible par les apps bancaires belges.

import QRCode from "qrcode";

export function epcPayload(o: { name: string; iban: string; bic?: string; amount: number; communication?: string; text?: string }) {
  const amount = o.amount > 0 ? `EUR${o.amount.toFixed(2)}` : "";
  return [
    "BCD",
    "002",
    "1",
    "SCT",
    (o.bic ?? "").replace(/\s/g, ""),
    o.name.slice(0, 70),
    o.iban.replace(/\s/g, "").toUpperCase(),
    amount,
    "",
    "",
    // la communication structurée belge est transmise en remise non structurée, comprise par les banques belges
    (o.communication ?? o.text ?? "").slice(0, 140),
  ].join("\n");
}

export const epcQrDataUrl = (payload: string) => QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 1, width: 360 });
