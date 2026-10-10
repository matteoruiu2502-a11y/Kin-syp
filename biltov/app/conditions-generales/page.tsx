import type { Metadata } from "next";
import { F, L, LegalPage, Section } from "@/components/LegalPage";
import { GRACE_DAYS, TRIAL } from "@/lib/plans";

export const metadata: Metadata = { title: "Conditions générales — Biltov" };

export default function ConditionsGenerales() {
  return (
    <LegalPage
      title="Conditions générales d'utilisation et de vente"
      intro={
        <p>
          Les présentes conditions régissent l'utilisation de Biltov, logiciel en ligne de devis, de facturation et de gestion de chantiers édité par{" "}
          <F k="company" /> (BCE <F k="bce" />
          ), ci-après « l'éditeur ». Biltov s'adresse aux professionnels (entreprises et indépendants) ; il n'est pas destiné aux consommateurs.
        </p>
      }
    >
      <Section title="1. Acceptation">
        <p>
          La création d'un compte vaut acceptation des présentes conditions et de la <L href="/confidentialite/">politique de confidentialité</L>. L'éditeur
          peut modifier ces conditions ; les utilisateurs sont prévenus au moins 30 jours avant l'entrée en vigueur d'une modification importante et
          peuvent résilier leur abonnement avant cette date.
        </p>
      </Section>

      <Section title="2. Compte">
        <ul>
          <li>Le compte est créé avec une adresse e-mail valide et un mot de passe personnel, que l'utilisateur garde confidentiel.</li>
          <li>Le titulaire du compte est responsable des accès qu'il accorde aux membres de son équipe et de l'usage qu'ils en font.</li>
          <li>Les informations de l'entreprise (nom, numéro d'entreprise, TVA, adresse) doivent être exactes : elles figurent sur les documents émis.</li>
        </ul>
      </Section>

      <Section title="3. Essai gratuit et forfaits">
        <ul>
          <li>
            Chaque nouvelle entreprise bénéficie d'un essai gratuit de {TRIAL.days} jours, sans engagement et sans moyen de paiement.
          </li>
          <li>
            Les forfaits, leurs prix (hors TVA), leurs modules et leurs limites sont décrits sur la page <L href="/tarifs/">Tarifs</L>. Le prix applicable
            est celui affiché au moment de la souscription.
          </li>
          <li>L'abonnement est mensuel ou annuel, payable d'avance, et se renouvelle automatiquement pour la même durée.</li>
          <li>
            Le paiement est traité par Stripe. En cas d'échec de paiement, l'accès est maintenu pendant un délai de grâce de {GRACE_DAYS} jours, puis
            l'espace passe en lecture seule jusqu'à régularisation. Les données ne sont pas supprimées.
          </li>
          <li>Un changement de forfait en cours de période est calculé au prorata.</li>
        </ul>
      </Section>

      <Section title="4. Résiliation">
        <ul>
          <li>
            L'utilisateur peut résilier à tout moment depuis son espace. La résiliation prend effet à la fin de la période déjà payée, sans
            remboursement de la période entamée.
          </li>
          <li>
            Avant la fin de son accès, l'utilisateur peut exporter ses données (Paramètres → Sauvegarde). Les données sont supprimées au plus tard 90
            jours après la fin de l'abonnement, sauf demande de suppression anticipée.
          </li>
          <li>L'éditeur peut suspendre ou fermer un compte en cas de manquement grave aux présentes conditions, après mise en demeure restée sans effet.</li>
        </ul>
      </Section>

      <Section title="5. Responsabilités de l'utilisateur">
        <ul>
          <li>
            Biltov aide à établir des devis, factures et déclarations conformes à la réglementation belge (TVA, Peppol), mais l'utilisateur reste seul
            responsable du contenu de ses documents, des taux de TVA appliqués et de ses obligations fiscales, comptables et sociales.
          </li>
          <li>Les suggestions automatiques (dictée vocale, assistant, calculs, lecture de tickets) doivent être vérifiées avant l'envoi d'un document.</li>
          <li>L'utilisateur ne doit pas utiliser Biltov à des fins illicites ni tenter d'en contourner les limites techniques ou les forfaits.</li>
        </ul>
      </Section>

      <Section title="6. Disponibilité et sauvegardes">
        <p>
          L'éditeur met tout en œuvre pour assurer le bon fonctionnement de Biltov, sans garantir une disponibilité ininterrompue (maintenance, panne d'un
          prestataire, connexion de l'utilisateur). Les données sont enregistrées en ligne et une copie reste sur l'appareil, ce qui permet de travailler
          hors ligne. L'utilisateur est invité à exporter régulièrement une sauvegarde.
        </p>
      </Section>

      <Section title="7. Données personnelles traitées pour le compte de l'utilisateur">
        <p>
          Pour les données de ses propres clients, salariés et sous-traitants qu'il saisit dans Biltov, l'utilisateur est responsable du traitement et
          l'éditeur agit en tant que sous-traitant au sens de l'article 28 du RGPD. À ce titre, l'éditeur :
        </p>
        <ul>
          <li>ne traite ces données que pour fournir le service, selon les instructions de l'utilisateur ;</li>
          <li>veille à la confidentialité de ces données et à la sécurité de leur hébergement ;</li>
          <li>
            recourt aux sous-traitants ultérieurs listés dans la <L href="/confidentialite/">politique de confidentialité</L> et informe l'utilisateur de
            tout changement ;
          </li>
          <li>aide l'utilisateur à répondre aux demandes des personnes concernées et l'informe sans délai de toute violation de données ;</li>
          <li>supprime ou restitue les données à la fin du contrat, comme prévu à l'article 4.</li>
        </ul>
      </Section>

      <Section title="8. Limitation de responsabilité">
        <p>
          Sauf faute grave ou intentionnelle, la responsabilité de l'éditeur est limitée aux dommages directs et plafonnée au montant payé par
          l'utilisateur au cours des 12 derniers mois. L'éditeur n'est pas responsable des dommages indirects (perte de chiffre d'affaires, de clientèle ou
          de données non sauvegardées), ni des erreurs résultant d'informations inexactes saisies par l'utilisateur.
        </p>
      </Section>

      <Section title="9. Propriété intellectuelle">
        <p>
          Biltov reste la propriété de l'éditeur. L'abonnement donne un droit d'utilisation personnel et non exclusif pour la durée du contrat. Les données
          saisies restent la propriété de l'utilisateur.
        </p>
      </Section>

      <Section title="10. Droit applicable et litiges">
        <p>
          Les présentes conditions sont soumises au droit belge. En cas de litige, les parties cherchent d'abord une solution amiable. À défaut, les
          tribunaux de l'arrondissement judiciaire de <F k="court" /> sont seuls compétents.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          <F k="company" />, <F k="address" /> — <F k="email" />
        </p>
      </Section>
    </LegalPage>
  );
}
