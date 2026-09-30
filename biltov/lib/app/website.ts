// Mini-site vitrine : une page HTML autonome à héberger où l'on veut (ou à envoyer à son webdesigner).

import type { Company, Branding } from "./types";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export type SiteContent = { headline: string; about: string; services: string; area: string; photos: string[] };

export function buildSiteHtml(c: Company, b: Branding, s: SiteContent) {
  const color = b.color || "#2563eb";
  const services = s.services
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
  const mail = `mailto:${encodeURIComponent(c.email)}?subject=${encodeURIComponent("Demande de devis")}&body=${encodeURIComponent("Bonjour,\n\nJe souhaite un devis pour :\n\nAdresse du chantier :\nTéléphone :\n")}`;
  return `<!doctype html>
<html lang="${c.lang}">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(c.name)}</title>
<meta name="description" content="${esc(s.headline)}">
<style>
:root{--c:${color}}*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;background:#f8fafc;line-height:1.6}
header{background:var(--c);color:#fff;padding:56px 20px}main,header>div,footer>div{max-width:960px;margin:0 auto}
h1{font-size:2.2rem;margin:.2em 0}h2{margin-top:0}.btn{display:inline-block;background:#fff;color:var(--c);padding:12px 22px;border-radius:999px;font-weight:700;text-decoration:none;margin-top:16px}
section{padding:40px 20px}ul{padding-left:1.2em}.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}.grid img{width:100%;border-radius:12px;aspect-ratio:4/3;object-fit:cover}
footer{background:#0f172a;color:#cbd5e1;padding:32px 20px;font-size:.9rem}a{color:inherit}
</style>
</head>
<body>
<header><div>${b.logo ? `<img src="${b.logo}" alt="" style="height:56px;background:#fff;border-radius:8px;padding:6px">` : ""}
<h1>${esc(c.name)}</h1><p>${esc(s.headline)}</p><a class="btn" href="${mail}">Demander un devis</a></div></header>
<main>
${s.about ? `<section><h2>Qui sommes-nous ?</h2><p>${esc(s.about).replace(/\n/g, "<br>")}</p></section>` : ""}
${services.length ? `<section><h2>Nos services</h2><ul>${services.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></section>` : ""}
${s.area ? `<section><h2>Zone d'intervention</h2><p>${esc(s.area)}</p></section>` : ""}
${s.photos.length ? `<section><h2>Réalisations</h2><div class="grid">${s.photos.map((p) => `<img src="${p}" alt="" loading="lazy">`).join("")}</div></section>` : ""}
<section><h2>Contact</h2><p>${c.phone ? `Téléphone : <a href="tel:${esc(c.phone)}">${esc(c.phone)}</a><br>` : ""}${c.email ? `E-mail : <a href="mailto:${esc(c.email)}">${esc(c.email)}</a><br>` : ""}${esc(c.address.street)}, ${esc(c.address.postcode)} ${esc(c.address.city)}</p></section>
</main>
<footer><div>${esc(c.name)}${c.legalForm && c.legalForm !== "Personne physique" ? ` ${esc(c.legalForm)}` : ""} — ${esc(c.address.street)}, ${esc(c.address.postcode)} ${esc(c.address.city)}${c.bce ? ` — BCE ${esc(c.bce)}` : ""}${c.rpm ? ` — ${esc(c.rpm)}` : ""}</div></footer>
</body>
</html>`;
}
