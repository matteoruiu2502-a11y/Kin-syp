import type { Metadata } from "next";
import { F, L, LegalPage, Section } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Cookies — Biltov" };

export default function Cookies() {
  return (
    <LegalPage
      title="Cookies et stockage local"
      intro={<p>Biltov n'utilise aucun cookie publicitaire ni de mesure d'audience. Il n'enregistre sur votre appareil que ce qui est nécessaire à son fonctionnement.</p>}
    >
      <Section title="Ce qui est enregistré sur votre appareil">
        <ul>
          <li>Cookies de session (Supabase) : vous garder connecté à votre compte. Strictement nécessaires.</li>
          <li>
            Stockage local du navigateur (IndexedDB et localStorage) : copie de vos données pour travailler hors ligne, liste des modifications en attente
            d'envoi, langue et thème choisis, utilisateur actif sur l'appareil. Strictement nécessaires.
          </li>
          <li>Service worker : permet d'ouvrir l'application sans connexion. Strictement nécessaire.</li>
        </ul>
        <p>Ces éléments étant indispensables au service, ils ne nécessitent pas votre consentement (article 129 de la loi du 13 juin 2005).</p>
      </Section>

      <Section title="Contenus de tiers">
        <p>
          La carte affichée sur la fiche d'un chantier est fournie par Google Maps, qui peut déposer ses propres cookies lors de son affichage. Elle ne se
          charge que lorsque vous ouvrez un chantier qui a une adresse.
        </p>
      </Section>

      <Section title="Supprimer ces données">
        <p>
          La déconnexion supprime la session. Vous pouvez effacer toutes les données du site dans les réglages de votre navigateur ; vos données restent
          disponibles en ligne et se rechargent à la prochaine connexion, à l'exception des modifications pas encore envoyées.
        </p>
        <p>
          Questions : <F k="email" />. Voir aussi la <L href="/confidentialite/">politique de confidentialité</L>.
        </p>
      </Section>
    </LegalPage>
  );
}
