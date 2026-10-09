import type { Metadata } from "next";
import { F, L, LegalPage, Section } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Politique de confidentialité — Biltov" };

export default function Confidentialite() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      intro={
        <p>
          Cette page explique quelles données personnelles Biltov traite, pourquoi, où elles sont conservées et quels sont vos droits, conformément au
          Règlement général sur la protection des données (RGPD) et à la loi belge du 30 juillet 2018.
        </p>
      }
    >
      <Section title="Responsable du traitement">
        <p>
          <F k="company" />, <F k="address" />, BCE <F k="bce" />. Contact pour toute question sur vos données : <F k="email" />.
        </p>
        <p>
          Pour les données de leurs clients, salariés et sous-traitants qu'ils saisissent dans Biltov, nos utilisateurs sont eux-mêmes responsables du
          traitement ; nous agissons alors comme sous-traitant (voir l'article 7 des <L href="/conditions-generales/">conditions générales</L>).
        </p>
      </Section>

      <Section title="Données traitées">
        <ul>
          <li>Compte : adresse e-mail, mot de passe (enregistré sous forme hachée, jamais lisible), date de création.</li>
          <li>Entreprise : nom, numéro d'entreprise, TVA, adresse, coordonnées bancaires, logo.</li>
          <li>
            Contenu saisi : clients, chantiers et adresses de chantier, devis, factures, achats, membres de l'équipe, pointages, photos, documents et
            enregistrements vocaux.
          </li>
          <li>Abonnement : forfait, statut de paiement et historique de facturation (les données de carte bancaire sont traitées uniquement par Stripe).</li>
        </ul>
        <p>Biltov n'utilise aucun outil de mesure d'audience, de publicité ou de suivi.</p>
      </Section>

      <Section title="Finalités et bases légales">
        <ul>
          <li>Fournir le service, enregistrer et synchroniser vos données entre vos appareils : exécution du contrat.</li>
          <li>Facturer l'abonnement et tenir la comptabilité : exécution du contrat et obligation légale.</li>
          <li>Assurer la sécurité du service et prévenir les abus : intérêt légitime.</li>
          <li>Répondre à vos demandes d'assistance : exécution du contrat.</li>
        </ul>
      </Section>

      <Section title="Prestataires (sous-traitants)">
        <ul>
          <li>
            Supabase, Inc. : comptes, base de données et fichiers (région : <F k="dataRegion" />
            ).
          </li>
          <li>GitHub, Inc. (Microsoft) : hébergement des pages du site.</li>
          <li>Stripe Payments Europe, Ltd. : paiement des abonnements.</li>
          <li>Cloudflare, Inc. : serveur de gestion des abonnements et des envois Peppol.</li>
          <li>Anthropic : assistant et dictée vocale, uniquement pour le texte que vous lui soumettez, lorsque la fonction est activée.</li>
          <li>Open-Meteo : prévisions météo, à partir de la position des chantiers (aucune donnée nominative).</li>
          <li>Google Maps : carte affichée sur la fiche d'un chantier, à partir de son adresse.</li>
        </ul>
        <p>
          Certains de ces prestataires sont établis hors de l'Union européenne (notamment aux États-Unis). Les transferts sont encadrés par le cadre de
          protection des données UE–États-Unis (Data Privacy Framework) ou par les clauses contractuelles types de la Commission européenne.
        </p>
      </Section>

      <Section title="Durée de conservation">
        <ul>
          <li>Données du compte et contenu saisi : pendant toute la durée de l'abonnement, puis au plus 90 jours après sa fin.</li>
          <li>Factures d'abonnement : 7 ans, conformément aux obligations comptables belges.</li>
          <li>
            Vos propres factures émises dans Biltov doivent également être conservées 7 ans : pensez à les exporter avant la fermeture de votre compte.
          </li>
        </ul>
      </Section>

      <Section title="Sécurité">
        <p>
          Les échanges sont chiffrés (HTTPS). Chaque compte n'a accès qu'à ses propres données, grâce à des règles d'accès appliquées par la base de
          données elle-même. Les mots de passe ne sont jamais enregistrés en clair. Une copie de vos données est conservée sur vos appareils pour permettre le
          travail hors ligne : protégez l'accès à vos appareils.
        </p>
      </Section>

      <Section title="Vos droits">
        <p>
          Vous pouvez demander l'accès à vos données, leur rectification, leur suppression, leur portabilité, la limitation du traitement ou vous y
          opposer, en écrivant à <F k="email" />. Nous répondons dans un délai d'un mois. Vous pouvez aussi exporter vous-même vos données
          (Paramètres → Sauvegarde).
        </p>
        <p>
          Vous avez le droit d'introduire une réclamation auprès de l'Autorité de protection des données, rue de la Presse 35, 1000 Bruxelles —{" "}
          <a href="https://www.autoriteprotectiondonnees.be" className="text-cyan hover:underline" target="_blank" rel="noopener noreferrer">
            www.autoriteprotectiondonnees.be
          </a>
          .
        </p>
      </Section>

      <Section title="Cookies">
        <p>
          Voir la page <L href="/cookies/">Cookies et stockage local</L>.
        </p>
      </Section>
    </LegalPage>
  );
}
