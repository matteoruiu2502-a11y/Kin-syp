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
| Banque : extraits CODA, lettrage (#banque) | ✅ | Mouvements conservés, doublons ignorés, communication structurée validée (modulo 97), lettrage automatique (communication, n° de facture), proposition par montant, partiels et surplus, paiements fournisseurs, lettrage manuel multi-factures, annulation. ⏳ Synchronisation Ponto (interface prête, nécessite le serveur) |
| Parcs & jardins (TVA) | 🟡 | Entretien de jardin à 21 %, aménagement exclu du 6 % (autoliquidation si client assujetti) — règles marquées « à valider par le comptable » |
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
| Planning semaine par ouvrier **et par véhicule**, glisser-déposer, conflits, congés, export .ics (planning et agenda de l'ouvrier) | ✅ ; ⏳ flux .ics abonnable (URL publique, nécessite le serveur) |
| Calendrier des **intempéries** (mois / semaine / liste) : jours fériés belges, week-ends, congés du bâtiment configurables, fiche en 3 gestes, preuve IRM (fichier avec empreinte SHA-256 ou lien), pré-remplissage indicatif Open-Meteo, heures perdues, statut à justifier / justifié / validé (admin), journal des modifications, rapport PDF et CSV, déclaration par l'ouvrier, décalage proposé de la fin du chantier | ✅ ; preuves stockées sur l'appareil (incluses dans la sauvegarde) |
| **Gantt de tous les chantiers** : états (à venir, en cours, à risque, en retard, terminé), avancement, chevauchements, conflits de ressources (ouvrier ou véhicule sur deux chantiers, ou en congé) avec bandeau cliquable, charge hebdomadaire nécessaires / disponibles, filtres (statut, responsable, client, commune, corps de métier), zoom jour → trimestre, fonds fériés / congés / intempéries, glisser-déposer avec annulation, « À planifier », export PDF A3 et image | ✅ |
| Gantt par chantier (phases, tâches, dépendances, chemin critique, prévu / réel) | ⏳ étape 3 |
| Pointage et photos géolocalisés (GPS de l'appareil, avec accord), itinéraire Google Maps / Waze, carte du chantier | ✅ |
| Ordres de mission dans l'espace ouvrier | ✅ |
| Rentabilité en temps réel (#chantier/<id>/rentabilite) : vendu (devis + avenants), facturé, matières, main-d'œuvre, sous-traitance, matériel, engagé, marge réelle contre prévue | ✅ |
| Parc d'outils et machines (#outils) : affectation dépôt / camionnette / ouvrier / chantier, historique, rappels d'entretien | ✅ |
| Contrats d'entretien récurrents (#contrats) : facture et intervention générées à chaque échéance | ✅ |
| Exécution ligne par ligne (notre société ou un sous-traitant), marge propre à chaque ligne (PU = coût × (1 + marge)), marges par défaut nos ouvriers / sous-traitance / par sous-traitant | ✅ |
| Rentabilité ventilée : réalisé par nous / par chaque sous-traitant (CA, coûts prévus et réels, marge, %), sous-total sous-traitance et total | ✅ |
| Matériaux prévu (devis, ouvrages dépliés en fournitures) contre réel (factures fournisseurs, bons de livraison, sorties de stock) : regroupement par description normalisée, fautes de frappe rapprochées, association manuelle mémorisée, dépassements en rouge, économies en vert | ✅ |
| Calculateur de quantités (surfaces, volumes, tonnages, carrelage avec perte et boîtes, gazon, linéaires) dans les devis | ✅ |
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

## Achats, sous-traitants et grossistes (ajouts)

| Fonction | État |
|---|---|
| Sous-traitants (#sous-traitants) : BCE, TVA, IBAN, attestations datées (RC, ONSS, SPF…) avec pièces jointes, alertes d'expiration, historique des consultations 30bis appliquées aux factures non payées | ✅ ; ⏳ consultation automatique du service officiel |
| Retenue de garantie (5 % par défaut) sur les états d'avancement et factures finales des clients professionnels | ✅ |
| Scan OCR des factures fournisseurs et bons de livraison (image) : n°, dates, bases HTVA par taux, TVAC, IBAN, BCE, communication | ✅ (dans le navigateur) ; ⏳ PDF et factures Peppol entrantes |
| Commandes : brouillon → commandé → en préparation → livré sur chantier → vérifié ; comparaison commande / bons de livraison / facture (quantités et prix) | ✅ |
| Devis signé → bons de commande fournisseurs (un par fournisseur, composants d'ouvrage) | ✅ |
| Tarifs grossistes (Cebeo, Facq, BigMat…) : prix net ou brut − remise, index de recherche pour les gros catalogues utilisés par la dictée | ✅ |

## Pilotage

| Fonction | État |
|---|---|
| Accueil « Argent à recevoir » : ancienneté des créances, relances à envoyer, reste à facturer, devis pondérés, encaissements | ✅ |
| Prévision de trésorerie sur 13 semaines | ✅ |
| Journaux des ventes, des achats et des paiements (CSV belge, Excel) | ✅ |
| Comptabilité (#comptabilite) : écritures en partie double PCMN (700000, 400000, 451000, 600000/604000, 411000, 440000 — modifiables), export WinBooks ACT.DBF + CSF.DBF, UBL Peppol des ventes en ZIP (Yuki, Pennylane, Odoo, BOB50…), retenues 30bis à verser | 🟡 Format WinBooks à valider par un import test ; ⏳ connecteurs directs |
| Super admin unique (titulaire du compte, non supprimable, non transférable) et utilisateurs : administrateur, employé, secrétaire, comptable, ouvrier | ✅ Connexion par code PIN sur l'appareil, retour au super admin par mot de passe |
| Droits par module (aucun / lecture / modification) : défauts par rôle modifiables, exceptions par personne ; menus masqués et toute écriture non autorisée refusée par le magasin de données | 🟡 Contrôlé dans l'application ; ⏳ comptes sur chaque téléphone et contrôle côté serveur (Supabase) |
| Journal d'audit | ✅ |

## Modules complémentaires (inspirés d'Odoo / Vertuoza)

Activables dans *Modules* : SAV / helpdesk, location de matériel, maintenance de l'outillage, notes de frais, congés, recrutement, base de connaissances, enquêtes de satisfaction, campagnes (e-mail / SMS / WhatsApp, consentement RGPD), réseau de sous-traitants, fabrication en atelier (consommation des composants en stock), mini-site vitrine (page HTML à héberger). ✅

⏳ Nécessitent le serveur : formulaire public relié à Biltov, envois groupés automatiques, prise de rendez-vous en ligne.

## Hors périmètre (volontairement)

- Calcul des salaires (reste chez le secrétariat social).
- E-commerce et caisse (POS).
- Pages légales du site (mentions légales, CGV / CGU, confidentialité, cookies, DPA) : à rédiger séparément.

## Aide, découverte et dictée en conversation

| Fonction | État |
|---|---|
| Chat d'aide flottant sur toutes les pages (plein écran sur mobile), réponses en continu à partir de la base de connaissances, limite anti-abus | ✅ en mode local (base d'aide) ; 🟡 IA générative dès que la fonction serveur Supabase et la clé API sont configurées |
| Pages Fonctionnalités : page d'ensemble filtrable + une page par fonctionnalité (étapes, astuces, capture dans un cadre iPhone, vidéos) | ✅ |
| Vidéos (accueil et pages concernées) déclarées dans `content/videos.json` | ✅ |
| Dictée vocale en conversation : vocal façon WhatsApp, transcription, questions sur les informations manquantes, création du devis, corrections vocales, aperçu et ouverture dans l'éditeur, conversation conservée tant que le devis est en brouillon | ✅ (transcription par le navigateur : Chrome, Edge, Safari) ; 🟡 interprétation par IA avec la fonction serveur |
| Dictée précise : quantité, unité, prix et produit dans les bonnes cases (diamètres et dimensions distingués, nombres en toutes lettres, « heures de travail » = main-d'œuvre), choix proposé entre plusieurs articles du catalogue, quantité demandée quand elle manque | ✅ |
| Espace connecté : liens « Découvrir Biltov », « Fonctionnalités », « Aide » ; pages publiques accessibles une fois connecté | ✅ |
| Mobile : aucun débordement de 320 à 768 px (audit automatique), champs en 16 px, `100dvh`, marges sûres iPhone | ✅ |

## Interface

- Mode jour / nuit sur tout le site (suit l'appareil par défaut, choix mémorisé). ✅
- Essai gratuit de 5 jours dès la création du compte, sans carte ; ensuite abonnement 99 € HTVA / mois via Stripe. 🟡 Contrôle dans le navigateur ; ⏳ vérification côté serveur.

- Espace artisan entièrement traduit en français, néerlandais et allemand (`lib/app/tr-dict.ts`, contrôlé par un test).
- Page d'accueil en français, néerlandais et allemand.
- Mode démonstration sans compte ni numéro d'entreprise : `/tableau-de-bord/#demo`.

## Tests

`npm test` : moteur TVA et identifiants belges, opérations devis / factures, UBL Peppol, import catalogue, relances, CODA, finances (encours, trésorerie, TVA, retenue), planning, couverture des traductions.
