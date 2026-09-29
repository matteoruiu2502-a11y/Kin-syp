// Envoi sans serveur : partage natif (le PDF part en pièce jointe sur mobile),
// sinon téléchargement du PDF + ouverture de l'e-mail / WhatsApp / SMS pré-rempli.

export type Channel = "email" | "whatsapp" | "sms" | "share" | "download";

/** Numéro au format international sans « + » (wa.me) : 06 12… → 336 12… */
export function intlPhone(phone: string) {
  let d = phone.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) return d.slice(1);
  if (d.startsWith("00")) return d.slice(2);
  if (d.startsWith("0") && d.length === 10) return `33${d.slice(1)}`;
  return d;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function canShareFiles(file?: File) {
  try {
    return typeof navigator !== "undefined" && !!navigator.canShare && navigator.canShare({ files: [file ?? new File([""], "x.pdf", { type: "application/pdf" })] });
  } catch {
    return false;
  }
}

export async function shareFile(file: File, title: string, text: string) {
  await navigator.share({ files: [file], title, text });
}

export function openChannel(channel: "email" | "whatsapp" | "sms", to: { email?: string; phone?: string }, subject: string, body: string) {
  let url = "";
  if (channel === "email") url = `mailto:${encodeURIComponent(to.email ?? "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  if (channel === "whatsapp") url = `https://wa.me/${intlPhone(to.phone ?? "")}?text=${encodeURIComponent(body)}`;
  if (channel === "sms") url = `sms:${to.phone ?? ""}${/iPhone|iPad/.test(navigator.userAgent) ? "&" : "?"}body=${encodeURIComponent(body)}`;
  window.open(url, channel === "whatsapp" ? "_blank" : "_self");
}
