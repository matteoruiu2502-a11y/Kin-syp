import type { Metadata } from "next";
import { F, L, LegalPage, Section } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Mentions légales — Biltov" };

export default function MentionsLegales() {
  return (
    <LegalPage title="Mentions légales">
      <Section title="Éditeur">
        <ul>
          <li>
            <F k="company" /> (<F k="legalForm" />)
          </li>
          <li>
            Siège : <F k="address" />
          </li>
          <li>
            Numéro d'entreprise (BCE) : <F k="bce" />
          </li>
          <li>
            TVA : <F k="vat" />
          </li>
          <li>
            Contact : <F k="email" />
          </li>
          <li>
            Responsable de la publication : <F k="publisher" />
          </li>
        </ul>
      </Section>

      <Section title="Hébergement">
        <ul>
          <li>Site : GitHub Pages, GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis.</li>
          <li>
            Comptes et données des utilisateurs : Supabase, Inc. (région d'hébergement : <F k="dataRegion" />).
          </li>
        </ul>
      </Section>

      <Section title="Propriété intellectuelle">
        <p>
          Le nom Biltov, le logo, les textes, l'interface et le logiciel sont la propriété de l'éditeur. Toute reproduction ou réutilisation sans
          autorisation écrite est interdite. Les données saisies par les utilisateurs restent leur propriété.
        </p>
      </Section>

      <Section title="Voir aussi">
        <ul>
          <li>
            <L href="/conditions-generales/">Conditions générales</L>
          </li>
          <li>
            <L href="/confidentialite/">Politique de confidentialité</L>
          </li>
          <li>
            <L href="/cookies/">Cookies et stockage local</L>
          </li>
        </ul>
      </Section>
    </LegalPage>
  );
}
