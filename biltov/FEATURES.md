# Biltov — état des fonctionnalités

Biltov est un logiciel pour les artisans du bâtiment **en Belgique** (FR / NL / DE).
Ce fichier dit honnêtement ce qui fonctionne aujourd'hui.

- ✅ **Fait** : fonctionne dans l'application publiée.
- 🟡 **Partiel** : utilisable, avec une limite indiquée.
- ⏳ **Nécessite le serveur** : prévu, mais impossible sans backend (l'application est aujourd'hui 100 % dans le navigateur).

> Les données sont enregistrées **sur l'appareil** (IndexedDB), par compte. Une sauvegarde complète (JSON, photos comprises) s'exporte et se restaure dans *Paramètres → Sauvegarde*. La couche d'accès aux données (`lib/app/store.tsx`) est unique pour pouvoir brancher une base serveur plus tard sans toucher aux écrans.

## Fiscalité et règles belges

| Fonction | État | Détail |
|---|---|---|
| Numéro BCE / TVA (contrôle modulo 97) | ✅ | Saisie, formatage, TVA déduite du BCE |
| Taux 21 / 12 / 6 / 0 %, exonéré | ✅ | Moteur `lib/tax/belgium/vat.ts` |
| 6 % rénovation de logement privé de plus de 10 ans | ✅ | Selon l'année de première occupation ; mention exacte sur la facture |
| Exclusion des chaudières à combustible fossile du 6 % | ✅ | Date d'effet configurable, marquée « à vérifier » |
| Autoliquidation (cocontractant assujetti) | ✅ | Mention légale, grille 45 dans l'aide TVA |
| Régime de la franchise | ✅ | Mention, pas de TVA ; pas d'aide à la déclaration |
| Valeurs légales datées et sourcées | ✅ | `lib/tax/belgium/config.ts`, visibles dans *Paramètres → Valeurs légales* ; les valeurs non confirmées sont signalées « à vérifier » |
| Communication structurée +++…+++ | ✅ | Générée à l'émission de chaque facture |
| QR code de virement (EPC) | ✅ | Sur le PDF des factures |
| Facture Peppol BIS 3.0 (UBL) | 🟡 | Fichier UBL généré et contrôlé ; à déposer chez votre prestataire Peppol. ⏳ Transmission directe via un Access Point (interface `PeppolProvider` prête) |
| Relances B2C (Livre XIX CDE) | ✅ | 1er rappel gratuit, délai de 14 jours (envoi papier : 3e jour ouvrable), plafonds d'indemnité configurables |
| Relances B2B (loi du 2 août 2002) | ✅ | Intérêts au taux commercial + indemnité forfaitaire |
| Devis hors établissement (droit de rétractation) | ✅ | Mention ajoutée au devis |
| Obligation de retenue sous-traitants (art. 30bis ONSS, art. 403 CIR) | 🟡 | Calcul des montants à retenir après votre vérification ; ⏳ consultation automatique du service officiel |
| Import d'extraits bancaires CODA | ✅ | Rapprochement par communication structurée puis par montant |
| Aide à la déclaration TVA (grilles 00–03, 45, 49, 54, 56, 59, 64, 81, 82, 87) | 🟡 | Estimation à valider par le comptable ; pas de dépôt Intervat |
| Conservation des documents | 🟡 | Documents émis immuables, journal d'audit ; ⏳ archivage à valeur probante |

## Devis → facture

| Fonction | État |
|---|---|
| Dictée vocale FR / NL / DE → lignes de devis rapprochées du catalogue | ✅ (reconnaissance vocale du navigateur ; saisie clavier en secours) |
| Lots / sections, textes, options, remises ligne et globale | ✅ |
| Versions de devis, duplication, modèles réutilisables | ✅ |
| Avenants / travaux supplémentaires | ✅ |
| Signature du client sur l'appareil (« Lu et approuvé ») | ✅ |
| Acomptes, états d'avancement (situations), jalons, facture finale | ✅ |
| Retenue de garantie | ✅ |
| Pro forma, notes de crédit | ✅ |
| Numérotation continue sans trou, documents émis immuables | ✅ |
| PDF à vos couleurs, mentions légales, langue du client | ✅ |
| Envoi e-mail / WhatsApp / SMS / partage natif | 🟡 Le message s'ouvre prêt avec le PDF ; ⏳ envoi automatique depuis Biltov |
| Paiements (partiels), suivi des litiges | ✅ |
| Import d'un métré Excel / CSV dans un devis | ✅ |

## Catalogue

| Fonction | État |
|---|---|
| Articles FR / NL / DE, familles, unités, prix d'achat, marge, prix de vente | ✅ |
| Ouvrages composés (nomenclature), ouvrages liés suggérés | ✅ |
| Import Excel (.xlsx) / CSV : association des colonnes, simulation, rapport d'erreurs, doublons | ✅ (.xls ancien format refusé avec explication) |
| Profil d'import mémorisé par fournisseur, historique des prix | ✅ |
| Hausse / baisse de prix en masse, listes de prix clients | ✅ |
| Catalogue de départ par métier | ✅ |

## Clients & CRM

| Fonction | État |
|---|---|
| Fiches (particulier, assujetti, franchise, pouvoir public, étranger), langue, adresses de chantier | ✅ |
| Import clients Excel / CSV | ✅ |
| Pipeline des chantiers (glisser-déposer), probabilité, commercial | ✅ |
| Solde client, historique des documents | ✅ |
| Consentement marketing (RGPD) | ✅ |
| Rendez-vous / visites / métrés | ✅ (planning) ; ⏳ prise de rendez-vous en ligne par le client |

## Chantiers & terrain

| Fonction | État |
|---|---|
| Fiche chantier : devis, factures, rentabilité prévu / réel | ✅ |
| Photos avant / pendant / après horodatées, comparaison, rapport photo PDF | ✅ |
| Tickets de caisse lus par OCR (dans le navigateur) | ✅ |
| Planning semaine par ouvrier, conflits, congés, export .ics | ✅ |
| Météo défavorable pour les travaux extérieurs (Open-Meteo) | ✅ |
| Pointage des heures, export pour le secrétariat social | ✅ (pas de calcul de salaire) |
| Rapports journaliers, bons d'intervention, PV de réception signés, PDF | ✅ |
| Espace ouvrier (PIN, sans aucun prix) : planning, pointage, photos, rapports, tickets, congés | ✅ |
| Discussion par chantier, coffre-fort de documents | ✅ (sur l'appareil) ; ⏳ partage en temps réel entre téléphones |
| Application installable (PWA), fonctionnement hors ligne | ✅ |

## Achats, sous-traitance, stock, flotte

| Fonction | État |
|---|---|
| Fournisseurs et sous-traitants (BCE contrôlé) | ✅ |
| Bons de commande numérotés, reprise des fournitures du devis signé | ✅ |
| Factures fournisseurs, échéances, statut payé | ✅ ; ⏳ réception Peppol entrante |
| Réception en stock | ✅ |
| Stock multi-emplacements (dépôt, camionnettes), transferts, inventaire, minimum | ✅ |
| Véhicules : contrôle technique, entretien, frais imputés aux chantiers | ✅ |

## Pilotage

| Fonction | État |
|---|---|
| Accueil « Argent à recevoir » : ancienneté des créances, relances à envoyer, reste à facturer, devis pondérés, encaissements | ✅ |
| Prévision de trésorerie sur 13 semaines | ✅ |
| Journaux des ventes, des achats et des paiements (CSV belge, Excel) | ✅ ; ⏳ connecteurs directs Winbooks / BOB / Exact |
| Rôles (patron, secrétariat, comptable, ouvrier) | 🟡 Restreint l'affichage sur l'appareil ; ⏳ comptes séparés et droits côté serveur |
| Journal d'audit | ✅ |

## Modules complémentaires (inspirés d'Odoo / Vertuoza)

Activables dans *Modules* : SAV / helpdesk, location de matériel, maintenance de l'outillage, notes de frais, congés, recrutement, base de connaissances, enquêtes de satisfaction, campagnes (e-mail / SMS / WhatsApp, consentement RGPD), réseau de sous-traitants, fabrication en atelier (consommation des composants en stock), mini-site vitrine (page HTML à héberger). ✅

⏳ Nécessitent le serveur : formulaire public relié à Biltov, envois groupés automatiques, prise de rendez-vous en ligne.

## Hors périmètre (volontairement)

- Calcul des salaires (reste chez le secrétariat social).
- E-commerce et caisse (POS).
- Pages légales du site (mentions légales, CGV / CGU, confidentialité, cookies, DPA) : à rédiger séparément.

## Interface

- Espace artisan entièrement traduit en français, néerlandais et allemand (`lib/app/tr-dict.ts`, contrôlé par un test).
- Page d'accueil en français, néerlandais et allemand.
- Mode démonstration sans compte ni numéro d'entreprise : `/tableau-de-bord/#demo`.

## Tests

`npm test` : moteur TVA et identifiants belges, opérations devis / factures, UBL Peppol, import catalogue, relances, CODA, finances (encours, trésorerie, TVA, retenue), planning, couverture des traductions.
