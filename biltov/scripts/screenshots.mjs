// Captures d'écran des pages Fonctionnalités, prises dans la démo sur un écran d'iPhone (390 × 844, ×2).
// Usage : construire le site (npm run build), le servir (ex. `cd out && python3 -m http.server 4310`),
// puis `npm run screenshots` (ou `npm run screenshots -- devis planning` pour quelques captures).
// Variables : SITE_URL (défaut http://localhost:4310), CHROMIUM_PATH (navigateur Chromium installé).
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const { FEATURES } = await import("../lib/knowledge/features.ts");
const BASE = (process.env.SITE_URL || "http://localhost:4310").replace(/\/$/, "");
const only = process.argv.slice(2);
const OUT = "public/screenshots";
mkdirSync(OUT, { recursive: true });

const HIDE = `[data-demo-banner]{display:none!important} button[aria-label="Ouvrir l'aide Biltov"]{display:none!important} *{caret-color:transparent!important}`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
let failed = 0;

for (const f of FEATURES.filter((x) => x.shot && (!only.length || only.includes(x.slug)))) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: "dark", locale: "fr-BE", reducedMotion: "reduce" });
  const p = await ctx.newPage();
  p.on("dialog", (d) => d.accept());
  const go = async (hash) => {
    await p.evaluate((h) => (window.location.hash = h), hash);
    await p.waitForTimeout(700);
  };
  const openJob = async (name, sub) => {
    await go("chantiers");
    await p.getByText(name).first().click();
    await p.waitForTimeout(500);
    if (sub) await go((await p.evaluate(() => location.hash)).slice(1) + `/${sub}`);
  };
  try {
    const { action, hash } = f.shot;
    if (action === "auth") {
      await p.goto(`${BASE}/tableau-de-bord/`, { waitUntil: "networkidle" });
      await p.getByRole("button", { name: "Créer mon compte" }).waitFor();
    } else if (action === "landing-pricing") {
      await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
      await p.addStyleTag({ content: HIDE });
      await p.locator("#tarif").scrollIntoViewIfNeeded();
      await p.waitForTimeout(1500);
      await p.evaluate(() => window.scrollBy(0, 120));
      await p.waitForTimeout(800);
    } else {
      await p.goto(`${BASE}/tableau-de-bord/#demo`, { waitUntil: "networkidle" });
      await p.getByText("Mode démonstration").first().waitFor({ state: "attached", timeout: 20000 });
      await p.addStyleTag({ content: HIDE });
      if (hash) await go(hash);
      const dlg = p.getByRole("dialog");
      switch (action) {
        case "open-first-quote":
        case "open-send":
          await p.getByRole("tab", { name: /Devis/ }).first().click();
          await p.locator("tbody tr").first().click();
          await dlg.getByText("Désignation").first().waitFor();
          if (action === "open-first-quote") await dlg.getByText("Désignation").first().evaluate((el) => el.scrollIntoView({ block: "start" }));
          if (action === "open-send") {
            await dlg.getByRole("button", { name: "Envoyer" }).click();
            await p.waitForTimeout(600);
          }
          break;
        case "open-voice": {
          await p.getByRole("button", { name: "Dictée vocale" }).first().click();
          const v = p.getByRole("dialog", { name: "Dictée vocale" });
          await v.getByLabel("Écrire un message").fill("Pour Mme Claes, 24 m² de parquet chêne à 45 euros, 12 mètres de plinthes à 9 euros et 6 heures de main-d'œuvre");
          await v.getByRole("button", { name: "Envoyer le message" }).click();
          await v.getByRole("button", { name: "Ouvrir / Modifier" }).waitFor({ timeout: 8000 });
          await p.waitForTimeout(600);
          await v.locator("div.overflow-y-auto").first().evaluate((el) => (el.scrollTop = el.scrollHeight));
          break;
        }
        case "open-help":
          await p.evaluate(() => window.dispatchEvent(new CustomEvent("biltov:help", { detail: {} })));
          await p.getByRole("button", { name: "Comment créer un devis à la voix ?" }).click();
          await p.getByText("Voir le guide").first().waitFor({ timeout: 8000 });
          break;
        case "open-bouw-quote":
          await openJob("Appartementen Bouw & Co");
          await p.getByRole("button", { name: /D-\d{4}-\d{4}/ }).first().click();
          await dlg.getByText("Désignation").first().waitFor();
          await dlg.getByText("onderaanneming").first().scrollIntoViewIfNeeded();
          break;
        case "open-job-photos":
          await openJob("Salle de bain Durand");
          await p.getByRole("tab", { name: /Photos/ }).click();
          await p.locator('[role="tablist"]').first().evaluate((el) => el.scrollIntoView({ block: "start" }));
          await p.evaluate(() => window.scrollBy(0, -70));
          await p.waitForTimeout(800);
          break;
        case "open-job-profit":
        case "open-job-materials":
          await openJob(action === "open-job-profit" ? "Appartementen Bouw & Co" : "Salle de bain Durand", action === "open-job-profit" ? "rentabilite" : "materiaux");
          await p.locator('[role="tablist"]').first().evaluate((el) => el.scrollIntoView({ block: "start" }));
          await p.evaluate(() => window.scrollBy(0, -70));
          break;
        case "open-team-roles":
          await p.getByRole("tab", { name: /Rôles et accès/ }).click();
          break;
        case "open-team-hours":
          await p.getByRole("tab", { name: /Heures de la semaine/ }).click();
          break;
        case "open-backup":
          await p.getByRole("tab", { name: /Sauvegarde/ }).click();
          break;
        case "open-worker":
          await p.getByTitle("Changer d'utilisateur sur cet appareil").click();
          await p.getByRole("button", { name: /Utilisateur de l'équipe/ }).click();
          await p.getByRole("dialog").getByRole("button", { name: /Karim/ }).click();
          await p.getByRole("dialog").locator("input").fill("2222");
          await p.getByRole("dialog").getByRole("button", { name: "Entrer" }).click();
          break;
      }
      await p.waitForTimeout(900);
    }
    await p.screenshot({ path: `${OUT}/${f.slug}.jpg`, type: "jpeg", quality: 80 });
    console.log("✓", f.slug);
  } catch (e) {
    failed++;
    console.log("✗", f.slug, e.message.split("\n")[0]);
  }
  await ctx.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
