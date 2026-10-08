// Base de connaissances Biltov — SOURCE UNIQUE DE VÉRITÉ.
// Décrit chaque fonctionnalité : à quoi elle sert, où la trouver, étapes, astuces, cas particuliers.
// Elle alimente : les pages /fonctionnalites/, le chat d'aide (prompt système et réponses hors ligne)
// et le fichier knowledge/biltov-features.md (généré par `npm run knowledge`).
// Ce fichier ne doit importer aucun module : il est aussi lu tel quel par le script de génération.

export type FeatureCategory = "demarrer" | "devis" | "chantier" | "argent" | "achats" | "equipe" | "compte";

export const CATEGORIES: { id: FeatureCategory; label: string; desc: string }[] = [
  { id: "demarrer", label: "Démarrer", desc: "Compte, essai gratuit, démonstration et premiers pas" },
  { id: "devis", label: "Devis & factures", desc: "De la dictée au devis signé, puis à la facture payée" },
  { id: "chantier", label: "Chantiers & terrain", desc: "Suivi des chantiers, planning, photos, espace ouvrier" },
  { id: "argent", label: "Argent & comptabilité", desc: "Encaissements, relances, banque, TVA et exports" },
  { id: "achats", label: "Achats, stock & sous-traitance", desc: "Fournisseurs, commandes, stock, sous-traitants" },
  { id: "equipe", label: "Équipe & accès", desc: "Utilisateurs, rôles, droits, pointage" },
  { id: "compte", label: "Réglages & compte", desc: "Paramètres, sauvegarde, abonnement, aide" },
];

/** Capture d'écran prise dans la démo (écran mobile) : page de l'espace artisan et action éventuelle. */
export type ShotAction = "auth" | "open-first-quote" | "open-send" | "open-voice" | "open-help" | "open-bouw-quote" | "open-team-roles" | "open-team-hours" | "open-job-materials" | "open-job-profit" | "open-job-photos" | "open-worker" | "open-backup" | "landing-pricing";
export type FeatureShot = { hash: string; action?: ShotAction; caption: string };

export type Feature = {
  slug: string;
  title: string;
  category: FeatureCategory;
  icon: string; // nom d'icône lucide-react
  tagline: string; // une phrase
  what: string; // ce que c'est, à quoi ça sert
  where: string; // où la trouver dans l'application
  steps: string[];
  tips: string[];
  notes: string[]; // cas particuliers, limites, erreurs courantes
  keywords: string[]; // mots que l'artisan peut employer (recherche du chat)
  shot?: FeatureShot;
};

export const FEATURES: Feature[] = [
  // ── Démarrer ───────────────────────────────────────────────────────────────
  {
    slug: "compte-et-essai",
    title: "Créer son compte et essai gratuit",
    category: "demarrer",
    icon: "UserPlus",
    tagline: "5 jours d'essai complet, sans carte bancaire.",
    what: "Biltov s'utilise avec un compte (e-mail et mot de passe). L'essai gratuit de 5 jours démarre à la création du compte et donne accès à toutes les fonctionnalités, sans demander de carte bancaire.",
    where: "Bouton « Essai gratuit 5 jours » ou « Mon espace » en haut de la page d'accueil, puis écran de connexion de l'espace artisan.",
    steps: [
      "Cliquez sur « Essai gratuit 5 jours » sur la page d'accueil.",
      "Choisissez « Créer un compte », saisissez votre e-mail et un mot de passe d'au moins 8 caractères.",
      "Renseignez l'identité de votre entreprise : nom, numéro d'entreprise (BCE), métier.",
      "Vous arrivez dans votre espace : un bandeau indique les jours d'essai restants.",
    ],
    tips: ["Pour tester sans rien créer, ouvrez le mode démonstration (voir « Mode démonstration »).", "Complétez ensuite IBAN, adresse et assurance dans Paramètres → Entreprise pour émettre des factures conformes."],
    notes: [
      "Aujourd'hui, le compte et les données sont enregistrés sur l'appareil utilisé (navigateur). Un autre téléphone ne voit pas encore les mêmes données : la synchronisation en ligne est prévue.",
      "Mot de passe oublié : il n'existe pas encore de réinitialisation par e-mail, car le compte est local. Conservez votre mot de passe et faites des sauvegardes.",
      "Après l'essai : abonnement Biltov Pro à 99 € HTVA par mois (ou 948 € HTVA par an), résiliable à tout moment.",
    ],
    keywords: ["inscription", "créer compte", "essai", "gratuit", "carte bancaire", "connexion", "mot de passe", "login", "s'inscrire", "essai gratuit", "carte bancaire", "créer un compte", "s'inscrire"],
    shot: { hash: "", action: "auth", caption: "Création du compte : e-mail et mot de passe, sans carte." },
  },
  {
    slug: "mode-demonstration",
    title: "Mode démonstration",
    category: "demarrer",
    icon: "PlayCircle",
    tagline: "Testez tout avec une entreprise belge fictive.",
    what: "La démonstration ouvre un espace déjà rempli (entreprise, clients, chantiers, devis, factures, équipe) pour découvrir Biltov sans créer de compte. Les PDF portent la mention « DÉMONSTRATION ».",
    where: "Lien « Voir la démo » sur la page d'accueil, ou l'adresse /tableau-de-bord/#demo.",
    steps: ["Ouvrez la démonstration depuis la page d'accueil.", "Naviguez librement : tout est modifiable.", "Pour repartir de zéro, cliquez sur « Réinitialiser » dans le bandeau vert.", "Pour passer à votre vrai compte, cliquez sur « Créer mon vrai compte »."],
    tips: ["Dans la démo, les codes PIN de l'équipe sont : Karim 2222, Piotr 3333, Sophie (secrétaire) 4444, Marc (comptable) 5555."],
    notes: ["Les données de démonstration ne sont pas reprises dans votre vrai compte."],
    keywords: ["démo", "demo", "tester", "essayer", "exemple", "réinitialiser"],
    shot: { hash: "apercu", caption: "L'espace de démonstration, prêt à explorer." },
  },
  {
    slug: "decouvrir-et-aide",
    title: "Aide, chat et pages de découverte",
    category: "demarrer",
    icon: "LifeBuoy",
    tagline: "Une question ? Le chat d'aide répond à tout moment.",
    what: "Le bouton rond « Aide » en bas à droite ouvre un chat qui répond aux questions sur l'utilisation de Biltov. Les pages Fonctionnalités expliquent chaque outil en détail, avec captures et vidéos.",
    where: "Bouton « Aide » en bas à droite de toutes les pages. Depuis votre espace : menu « Découvrir Biltov », « Fonctionnalités » et « Aide ».",
    steps: ["Cliquez sur le bouton « Aide ».", "Posez votre question en une phrase (ex. « comment envoyer un devis par WhatsApp ? »).", "Suivez les étapes proposées ; ouvrez la page de la fonctionnalité si un lien est donné."],
    tips: ["Le chat d'aide explique comment utiliser Biltov ; pour créer un devis à la voix, utilisez la « Dictée vocale », qui est un outil distinct."],
    notes: ["Si l'assistant ne connaît pas la réponse, il le dit et vous propose de contacter le support plutôt que d'inventer."],
    keywords: ["aide", "support", "question", "chat", "assistance", "contact", "comment faire"],
    shot: { hash: "apercu", action: "open-help", caption: "Le chat d'aide, disponible sur toutes les pages." },
  },

  // ── Devis & factures ──────────────────────────────────────────────────────
  {
    slug: "dictee-vocale",
    title: "Dictée vocale en conversation",
    category: "devis",
    icon: "Mic",
    tagline: "Parlez comme sur WhatsApp : Biltov écrit le devis.",
    what: "Un écran de conversation pour créer un devis à la voix. Vous envoyez un message vocal décrivant le travail, Biltov le transcrit, pose les questions manquantes (client, prix, quantité) puis génère le devis avec vos prix du catalogue. Vous pouvez ensuite le corriger à la voix.",
    where: "Bouton « Dictée vocale » dans Chantiers, dans Devis & factures et dans la barre du haut de votre espace.",
    steps: [
      "Ouvrez « Dictée vocale ».",
      "Appuyez sur le micro (ou maintenez-le appuyé) et décrivez le travail : « Pour Mme Peeters, 24 m² de parquet chêne à 45 euros, 12 mètres de plinthes et 6 heures de main-d'œuvre ».",
      "Appuyez sur « Envoyer » : votre vocal apparaît avec sa transcription.",
      "Répondez aux questions de l'assistant s'il manque une information ou s'il hésite entre plusieurs articles (par exemple « Tube cuivre Ø15 ou Ø22 ? ») : touchez un bouton, ou répondez à la voix (« le 22 »).",
      "L'aperçu du devis s'affiche dans la conversation : appuyez sur « Ouvrir / Modifier » pour l'éditer, le télécharger en PDF ou l'envoyer.",
    ],
    tips: [
      "Corrigez à la voix : « change le prix de la peinture à 45 € », « ajoute 2 heures de main-d'œuvre », « supprime les plinthes », « mets 30 m² de parquet ».",
      "Sans prix dicté, Biltov reprend le prix de votre catalogue ; sinon il vous le demande.",
      "Chaque information va dans sa case : la quantité (« 12 mètres », « trois coudes »), l'unité, le prix (« à 45 euros », « 3 euros du mètre », « 55 euros de l'heure ») et le produit précis du catalogue (diamètre, dimension). Un nombre qui décrit le produit (« tuyau cuivre 22 », « radiateur 600 par 1000 ») reste dans son nom.",
      "Si vous ne dites pas la longueur d'un tuyau ou la surface d'un carrelage, Biltov vous la demande au lieu de supposer.",
      "La conversation est conservée tant que le devis n'est pas finalisé : vous pouvez la reprendre plus tard.",
    ],
    notes: [
      "Le navigateur demande l'autorisation d'utiliser le micro : acceptez-la. En cas de refus, réactivez-le dans les réglages du navigateur (Safari : Réglages → Safari → Micro) ou écrivez votre message.",
      "La transcription utilise la reconnaissance vocale du navigateur (Chrome, Edge, Safari). Dans les autres navigateurs, tapez le texte : l'analyse est identique.",
      "Une connexion internet est nécessaire pour la transcription dans la plupart des navigateurs.",
    ],
    keywords: ["dictée", "voix", "vocal", "micro", "parler", "dicter", "message vocal", "devis à la voix", "enregistrer", "créer un devis avec ma voix", "parler pour faire un devis", "micro qui ne marche pas", "dicter un devis"],
    shot: { hash: "chantiers", action: "open-voice", caption: "La dictée vocale : un vocal, et le devis se remplit." },
  },
  {
    slug: "devis",
    title: "Créer et modifier un devis",
    category: "devis",
    icon: "FileText",
    tagline: "Un éditeur complet, avec la TVA belge calculée pour vous.",
    what: "L'éditeur de devis permet d'ajouter des lignes (catalogue, texte libre, lots/sections), de modifier quantités, unités, prix, remises et TVA. Les totaux HTVA, TVA et TVAC se recalculent automatiquement, avec les mentions légales belges.",
    where: "Chantiers → ouvrir un chantier → « Nouveau devis », ou Devis & factures → onglet Devis → cliquer sur un devis.",
    steps: [
      "Ouvrez le chantier concerné et cliquez sur « Nouveau devis » (ou créez le chantier avec « Nouveau chantier »).",
      "Ajoutez des lignes : dictez, cherchez dans le catalogue, ou utilisez « Ligne », « Lot / section », « Texte ».",
      "Ajustez quantité, unité, prix unitaire, remise et nature des travaux ; la TVA conseillée s'applique toute seule.",
      "Réordonnez avec les flèches, supprimez avec la corbeille.",
      "Complétez acompte, validité, remise globale et texte affiché sur le document.",
      "Cliquez sur « PDF » pour l'aperçu, puis « Envoyer » ou « Faire signer ».",
    ],
    tips: [
      "Le devis s'enregistre automatiquement.",
      "« Calculateur » calcule surfaces, volumes, carrelage avec pertes, gazon… et ajoute la ligne.",
      "« Importer un métré » reprend un tableau Excel ou CSV.",
      "Sous chaque ligne : « Exécution » (vos ouvriers ou un sous-traitant), coût et marge de la ligne.",
    ],
    notes: [
      "Un devis signé n'est plus modifiable : créez une « Nouvelle version » ou un « Avenant » (menu « Plus »).",
      "Une ligne « à chiffrer » (en orange) n'a pas de prix : complétez-le avant d'envoyer.",
    ],
    keywords: ["devis", "offre", "lignes", "prix", "quantité", "tva", "remise", "pdf", "éditeur", "modifier devis", "totaux"],
    shot: { hash: "documents", action: "open-first-quote", caption: "L'éditeur de devis : lignes, TVA et totaux." },
  },
  {
    slug: "envoi-et-signature",
    title: "Envoyer et faire signer un devis",
    category: "devis",
    icon: "Send",
    tagline: "E-mail, WhatsApp, SMS, et signature sur l'écran.",
    what: "Envoyez le devis ou la facture en PDF par e-mail, WhatsApp, SMS ou partage du téléphone. Le client peut signer « Lu et approuvé » directement sur votre appareil.",
    where: "Dans l'éditeur du devis : boutons « Envoyer » et « Faire signer ».",
    steps: ["Ouvrez le devis.", "Cliquez sur « Envoyer » et choisissez le canal : le message s'ouvre prêt, PDF joint.", "Pour une signature sur place, cliquez sur « Faire signer », faites signer au doigt, validez."],
    tips: ["Après signature, le menu « Facturer » permet de créer acompte, situations ou facture finale."],
    notes: ["L'envoi part de votre messagerie ou de WhatsApp : Biltov prépare le message, vous appuyez sur « Envoyer ». L'envoi automatique depuis Biltov arrivera avec le serveur.", "Si le PDF ne s'ouvre pas, autorisez les fenêtres pop-up pour le site."],
    keywords: ["envoyer", "whatsapp", "email", "sms", "signature", "signer", "lu et approuvé", "partager", "faire signer", "signature du client", "envoyer par mail", "envoyer le devis"],
    shot: { hash: "documents", action: "open-send", caption: "Envoi par e-mail, WhatsApp ou SMS." },
  },
  {
    slug: "factures",
    title: "Factures, acomptes et situations",
    category: "devis",
    icon: "Receipt",
    tagline: "Du devis signé à la facture conforme, en deux clics.",
    what: "Transformez un devis signé en facture d'acompte, état d'avancement (situation), facture de jalon ou facture finale qui déduit ce qui a déjà été facturé. Les factures émises sont numérotées sans trou et ne sont plus modifiables.",
    where: "Devis signé → bouton « Facturer », ou Devis & factures → onglets À encaisser, Brouillons, Payées.",
    steps: ["Ouvrez le devis signé et cliquez sur « Facturer ».", "Choisissez acompte, situation, jalon, facture finale ou complète.", "Vérifiez le brouillon puis cliquez sur « Émettre ».", "Envoyez-la ; enregistrez les paiements avec « Paiement »."],
    tips: ["Chaque facture a une communication structurée belge (+++…+++) et un QR code de virement.", "Retenue de garantie : 5 % par défaut pour les clients professionnels (réglable)."],
    notes: ["Une facture émise ne se modifie plus : corrigez-la avec une « Note de crédit ».", "Les factures Peppol (UBL) se téléchargent avec le bouton « UBL » pour votre prestataire Peppol."],
    keywords: ["facture", "facturer", "acompte", "situation", "avancement", "note de crédit", "émettre", "peppol", "paiement", "communication structurée", "annuler une facture", "corriger une facture", "erreur dans la facture", "facture déjà envoyée", "avoir", "transformer un devis en facture", "facture finale", "facture de situation"],
    shot: { hash: "documents", caption: "Devis & factures : à encaisser, brouillons, payées." },
  },
  {
    slug: "catalogue",
    title: "Catalogue et ouvrages",
    category: "devis",
    icon: "Package",
    tagline: "Vos prix, retrouvés automatiquement à la dictée.",
    what: "Le catalogue contient vos articles (prix d'achat, marge, prix de vente, en FR/NL/DE) et vos ouvrages composés (ex. pose de faïence au m² = faïence + colle + joint + main-d'œuvre). Il s'importe depuis Excel ou CSV, y compris les tarifs grossistes.",
    where: "Menu « Catalogue ».",
    steps: ["Ouvrez Catalogue.", "Ajoutez un article ou cliquez sur « Importer Excel / CSV ».", "Associez les colonnes, vérifiez la simulation, validez.", "Utilisez « Hausse / baisse de prix » pour réviser les prix en masse."],
    tips: ["Les tarifs grossistes (prix brut − remise) sont pris en charge.", "Le profil d'import est mémorisé par fournisseur."],
    notes: ["Les anciens fichiers .xls ne sont pas lus : enregistrez-les en .xlsx ou CSV."],
    keywords: ["catalogue", "articles", "prix", "import", "excel", "csv", "ouvrage", "grossiste", "marge", "augmenter les prix", "baisser les prix", "hausse de prix", "pourcentage", "mes prix", "tarifs fournisseur", "grossiste", "liste de prix"],
    shot: { hash: "catalogue", caption: "Le catalogue : articles, ouvrages et prix." },
  },
  {
    slug: "sous-traitance-par-ligne",
    title: "Sous-traitance et marge par ligne",
    category: "devis",
    icon: "Handshake",
    tagline: "Chaque ligne : qui l'exécute, et avec quelle marge.",
    what: "Sur chaque ligne de devis, le menu « Exécution » indique si le travail est fait par vos ouvriers (« Notre société ») ou par un sous-traitant. Chaque ligne a son coût et sa marge : le prix de vente = coût × (1 + marge).",
    where: "Éditeur de devis, sous chaque ligne : « Exécution », « Coût », « Marge ».",
    steps: ["Ouvrez un devis.", "Sous une ligne, choisissez l'exécutant dans « Exécution » (ou « + Nouveau sous-traitant… »).", "La marge par défaut s'applique ; ajustez le coût ou la marge, le prix se recalcule."],
    tips: ["Marges par défaut réglables dans Paramètres → Devis & factures, et par sous-traitant dans sa fiche."],
    notes: ["Le coût et la marge ne figurent jamais sur le PDF du client."],
    keywords: ["sous-traitant", "sous traitance", "exécution", "marge", "coût", "prix de revient", "marge sur chaque ligne", "marge par ligne", "mettre ma marge", "coût de la ligne"],
    shot: { hash: "chantiers", action: "open-bouw-quote", caption: "Exécution, coût et marge sous chaque ligne." },
  },

  // ── Chantiers & terrain ───────────────────────────────────────────────────
  {
    slug: "chantiers",
    title: "Chantiers",
    category: "chantier",
    icon: "HardHat",
    tagline: "Tout le chantier au même endroit.",
    what: "La fiche chantier regroupe devis et factures, rentabilité, matériaux, heures, rapports, photos, dépenses, documents et discussion. La liste des chantiers suit le pipeline (devis envoyé, signé, en cours, terminé).",
    where: "Menu « Chantiers ».",
    steps: ["Cliquez sur « Nouveau chantier ».", "Choisissez le client (ou créez-le), donnez un nom, renseignez l'adresse et le type de travaux (pour la TVA).", "Ouvrez le chantier pour accéder à ses onglets."],
    tips: ["Le lien « Maps » / « Waze » ouvre l'itinéraire vers le chantier.", "Glissez les cartes du pipeline pour changer le statut."],
    notes: ["Un chantier qui contient des factures émises ne peut pas être supprimé : passez-le au statut « Terminé »."],
    keywords: ["chantier", "projet", "pipeline", "adresse", "client", "suivi"],
    shot: { hash: "chantiers", caption: "La liste des chantiers et leur avancement." },
  },
  {
    slug: "rentabilite",
    title: "Rentabilité du chantier",
    category: "chantier",
    icon: "TrendingUp",
    tagline: "Prévu contre réel, en temps réel.",
    what: "Compare le vendu (devis et avenants signés) aux coûts réels : matériaux, main-d'œuvre (heures × coût chargé), sous-traitance et matériel. Un tableau sépare ce qui est réalisé par vous et par chaque sous-traitant, avec marge et rentabilité.",
    where: "Chantier → onglet « Rentabilité ».",
    steps: ["Ouvrez le chantier.", "Cliquez sur « Rentabilité ».", "Lisez les postes : rouge = dépassement du prévu."],
    tips: ["Encodez les factures d'achat sur le chantier et pointez les heures pour un suivi juste."],
    notes: ["Visible uniquement par les utilisateurs autorisés (droit « Rentabilité »)."],
    keywords: ["rentabilité", "marge", "bénéfice", "coûts", "prévu", "réel", "perte", "gagne de l'argent", "gagner de l'argent", "bénéfice", "rentable", "perte", "marge réelle", "combien j'ai gagné", "coûts du chantier"],
    shot: { hash: "chantiers", action: "open-job-profit", caption: "Rentabilité : vendu, coûts et marge réelle." },
  },
  {
    slug: "materiaux-prevu-reel",
    title: "Matériaux prévu / réel",
    category: "chantier",
    icon: "PackageSearch",
    tagline: "Avez-vous acheté plus que prévu ?",
    what: "Compare, matériau par matériau, les quantités prévues au devis et celles réellement achetées (factures fournisseurs, bons de livraison, sorties de stock). Les dépassements sont en rouge, les économies en vert.",
    where: "Chantier → onglet « Matériaux prévu / réel ».",
    steps: ["Ouvrez le chantier puis l'onglet « Matériaux prévu / réel ».", "Choisissez le devis analysé et les sources.", "Ouvrez une ligne pour voir le détail des achats.", "Associez un achat « non prévu » à un matériau du devis si c'est le même produit sous un autre nom."],
    tips: ["Les fautes de frappe et différences de majuscules ou d'espaces sont rapprochées automatiquement.", "Les ouvrages sont dépliés en fournitures (faïence, colle, joint…)."],
    notes: ["Main-d'œuvre et lignes sous-traitées sont exclues de l'analyse."],
    keywords: ["matériaux", "quantités", "achats", "dépassement", "économie", "prévu", "réel"],
    shot: { hash: "chantiers", action: "open-job-materials", caption: "Matériaux : prévu au devis contre acheté." },
  },
  {
    slug: "planning",
    title: "Planning des équipes",
    category: "chantier",
    icon: "CalendarDays",
    tagline: "Qui travaille où, cette semaine.",
    what: "Planning semaine par ouvrier et par véhicule, avec glisser-déposer, détection des conflits, congés et météo défavorable pour les travaux extérieurs. Export .ics vers votre agenda.",
    where: "Menu « Planning ».",
    steps: ["Cliquez sur une case pour créer une intervention.", "Choisissez chantier, ouvriers, véhicule, horaires.", "Glissez un bloc pour le déplacer."],
    tips: ["Les ouvriers voient leur planning dans leur espace ouvrier."],
    notes: ["Un conflit (même ouvrier ou véhicule deux fois) est signalé en rouge."],
    keywords: ["planning", "agenda", "calendrier", "équipe", "intervention", "congé", "météo", "ics"],
    shot: { hash: "planning", caption: "Le planning de la semaine." },
  },
  {
    slug: "intemperies",
    title: "Intempéries et preuve météo",
    category: "chantier",
    icon: "CloudRain",
    tagline: "Chaque jour de pluie ou de gel, justifié et prêt pour le client ou l'assureur.",
    what: "Calendrier des jours où un chantier a été arrêté ou ralenti par la météo (pluie, orage, gel, neige, vent…), avec la preuve IRM jointe (capture, PDF ou lien), les heures perdues, les ouvriers concernés et un rapport PDF par chantier et période. Jours fériés belges, week-ends et congés du bâtiment affichés.",
    where: "Menu « Planning » → onglet « Intempéries ». Les compteurs apparaissent aussi sur la fiche chantier ; l'ouvrier déclare depuis son espace.",
    steps: [
      "Planning → Intempéries → « Déclarer une intempérie ».",
      "Touchez le chantier, puis le type (pluie, gel…), puis « Enregistrer ».",
      "Ouvrez « Durée, ouvriers, relevés, preuves et photos » pour joindre la capture ou le PDF de l'IRM, ou coller le lien.",
      "Exportez le rapport PDF ou la liste CSV de la période (filtrez par chantier si besoin).",
    ],
    tips: [
      "« Pré-remplir (indicatif) » propose les relevés Open-Meteo du jour ; la preuve officielle reste le document IRM joint.",
      "Après l'enregistrement, Biltov propose de décaler la date de fin prévue du chantier (jamais automatiquement).",
      "Chaque fichier joint garde une empreinte SHA-256 : on peut prouver qu'il n'a pas été modifié.",
    ],
    notes: [
      "Un jour sans preuve est marqué « à justifier » et rappelé sur le tableau de bord.",
      "Une intempérie validée par un administrateur ne peut plus être modifiée par l'ouvrier ; toute modification est historisée.",
      "Les preuves sont gardées sur l'appareil : faites une sauvegarde (Paramètres → Sauvegarde).",
      "Le rapport est une pièce justificative ; il ne remplace pas la déclaration de chômage temporaire à l'ONEM.",
      "Les congés du bâtiment proposés sont à vérifier chaque année dans Paramètres → Calendrier.",
    ],
    keywords: ["intempérie", "intempéries", "météo", "pluie", "gel", "neige", "vent", "orage", "IRM", "KMI", "preuve", "chômage temporaire", "retard", "pénalité", "jours fériés", "congés du bâtiment"],
  },
  {
    slug: "photos-rapports",
    title: "Photos, rapports et PV",
    category: "chantier",
    icon: "Camera",
    tagline: "Avant / pendant / après, et rapports signés.",
    what: "Photos horodatées et géolocalisées par phase, rapport photo PDF, rapports journaliers, bons d'intervention et procès-verbaux de réception signés sur place.",
    where: "Chantier → onglets « Photos » et « Rapports ».",
    steps: ["Ouvrez le chantier → Photos → choisissez la phase et ajoutez les photos.", "Rapports → « Nouveau rapport » → cochez la check-list, faites signer, exportez en PDF."],
    tips: ["La comparaison avant/après se fait en un glissement."],
    notes: ["La position GPS n'est enregistrée qu'avec votre accord."],
    keywords: ["photos", "rapport", "pv", "réception", "bon d'intervention", "signature", "pv de réception", "procès-verbal", "signer le pv", "réception des travaux", "rapport journalier", "bon d'intervention"],
    shot: { hash: "chantiers", action: "open-job-photos", caption: "Photos avant / après du chantier." },
  },
  {
    slug: "espace-ouvrier",
    title: "Espace ouvrier",
    category: "chantier",
    icon: "HardHat",
    tagline: "Le téléphone de l'ouvrier, sans aucun prix.",
    what: "Un espace simplifié pour vos ouvriers : leur planning, pointage avec GPS, missions, itinéraire, photos, rapports, tickets de caisse et demandes de congé. Aucun prix n'y apparaît.",
    where: "En haut à droite : icône utilisateur → « Utilisateur de l'équipe (code PIN) ».",
    steps: ["Créez l'ouvrier dans Équipe avec un code PIN.", "Sur le téléphone, choisissez son nom et tapez son code.", "Il pointe son arrivée et son départ, ajoute photos et rapports."],
    tips: ["Le retour au compte du patron demande le mot de passe du compte."],
    notes: [],
    keywords: ["ouvrier", "pointage", "pin", "espace ouvrier", "téléphone", "mission"],
    shot: { hash: "apercu", action: "open-worker", caption: "L'espace ouvrier : planning et pointage." },
  },
  {
    slug: "contrats-outils",
    title: "Contrats d'entretien et outils",
    category: "chantier",
    icon: "Repeat",
    tagline: "Les interventions récurrentes et le parc machines.",
    what: "Contrats d'entretien récurrents (tonte, chaudière…) qui génèrent facture et intervention à chaque échéance. Le parc d'outils suit l'affectation (dépôt, camionnette, ouvrier, chantier) et rappelle les entretiens.",
    where: "Menus « Contrats » et « Outils ».",
    steps: ["Contrats → « Contrat » → client, fréquence, prestations.", "À l'échéance, cliquez sur « Générer l'échéance ».", "Outils → « Outil / machine » → affectez, réaffectez, notez l'entretien."],
    tips: [],
    notes: [],
    keywords: ["contrat", "entretien", "récurrent", "abonnement client", "outils", "machines", "parc"],
    shot: { hash: "contrats", caption: "Contrats d'entretien récurrents." },
  },

  // ── Argent & comptabilité ─────────────────────────────────────────────────
  {
    slug: "argent-a-recevoir",
    title: "Argent à recevoir et relances",
    category: "argent",
    icon: "HandCoins",
    tagline: "Qui vous doit quoi, et qui relancer aujourd'hui.",
    what: "Le tableau de bord d'accueil montre les factures à encaisser par ancienneté, les relances à envoyer (règles belges B2C et B2B), le reste à facturer, la trésorerie sur 13 semaines et l'aide à la déclaration TVA.",
    where: "Menu « Argent à recevoir » (page d'accueil de l'espace).",
    steps: ["Ouvrez Argent à recevoir.", "Cliquez sur « Relancer » à côté d'une facture en retard.", "Choisissez le canal, envoyez."],
    tips: ["1er rappel gratuit pour les particuliers, puis frais et intérêts selon la loi."],
    notes: ["L'aide TVA est une estimation à valider par votre comptable."],
    keywords: ["argent", "encaisser", "impayé", "relance", "rappel", "retard", "trésorerie", "tva", "créances", "impayé", "impayées", "qui me doit", "doit de l'argent", "retard de paiement", "client qui ne paie pas", "pas payé", "encaissement", "créance", "relancer"],
    shot: { hash: "apercu", caption: "Argent à recevoir : créances et relances." },
  },
  {
    slug: "banque-coda",
    title: "Banque : extraits CODA et lettrage",
    category: "argent",
    icon: "Landmark",
    tagline: "Les paiements reconnus automatiquement.",
    what: "Importez vos extraits bancaires CODA : Biltov reconnaît les paiements (communication structurée, numéro de facture, montant) et les lettre avec vos factures et achats.",
    where: "Menu « Banque ».",
    steps: ["Téléchargez l'extrait CODA depuis votre banque en ligne.", "Banque → « Importer un extrait CODA ».", "Validez les correspondances proposées, ou lettrez à la main."],
    tips: ["Les paiements partiels et les surplus sont gérés."],
    notes: ["La synchronisation bancaire automatique (Ponto) nécessitera le serveur."],
    keywords: ["banque", "coda", "extrait", "lettrage", "paiement", "virement", "rapprochement", "rapprocher", "rapprochement", "lettrer", "paiements reçus", "relevé bancaire", "extrait de compte", "virements"],
    shot: { hash: "banque", caption: "La banque : mouvements à lettrer." },
  },
  {
    slug: "comptabilite",
    title: "Comptabilité et exports",
    category: "argent",
    icon: "Calculator",
    tagline: "Tout prêt pour votre comptable.",
    what: "Écritures en partie double (plan comptable PCMN), export WinBooks, factures UBL Peppol en ZIP (Yuki, Pennylane, Odoo, BOB50…), journaux de ventes, achats et paiements en CSV/Excel.",
    where: "Menu « Comptabilité », et Argent à recevoir → « Exports comptables ».",
    steps: ["Choisissez la période.", "Cliquez sur l'export souhaité (WinBooks, UBL, CSV).", "Envoyez le fichier à votre comptable."],
    tips: ["Les numéros de comptes sont modifiables dans « Plan comptable »."],
    notes: ["Faites valider le format WinBooks par un import test chez votre comptable."],
    keywords: ["comptabilité", "comptable", "export", "winbooks", "pcmn", "journal", "ubl", "yuki", "écritures", "envoyer à mon comptable", "fiduciaire", "expert-comptable", "export comptable", "déclaration tva"],
    shot: { hash: "comptabilite", caption: "Exports pour votre comptable." },
  },

  // ── Achats, stock & sous-traitance ────────────────────────────────────────
  {
    slug: "achats",
    title: "Achats, commandes et scan des factures",
    category: "achats",
    icon: "ShoppingCart",
    tagline: "Photographiez la facture, Biltov la lit.",
    what: "Factures fournisseurs, bons de commande et bons de livraison. Le scan OCR lit numéro, dates, montants HTVA/TVA, IBAN et communication. Les commandes se suivent jusqu'à la livraison et se comparent à la facture.",
    where: "Menu « Achats ».",
    steps: ["Achats → « Scanner » → prenez la photo de la facture.", "Vérifiez les champs lus, choisissez le chantier, enregistrez.", "Pour commander : depuis un devis signé, « Commander les fournitures »."],
    tips: [],
    notes: ["Le scan fonctionne sur les images ; les PDF et factures Peppol entrantes viendront plus tard."],
    keywords: ["achats", "fournisseur", "facture fournisseur", "scan", "ocr", "commande", "bon de livraison"],
    shot: { hash: "achats", caption: "Les achats : factures, commandes, livraisons." },
  },
  {
    slug: "sous-traitants",
    title: "Sous-traitants et obligation de retenue",
    category: "achats",
    icon: "ShieldCheck",
    tagline: "Attestations à jour et retenues 30bis calculées.",
    what: "Fiches sous-traitants (BCE, TVA, IBAN, adresse, marge par défaut), attestations datées avec alertes d'expiration et calcul des retenues ONSS/SPF (art. 30bis / 403 CIR) sur les factures.",
    where: "Menu « Sous-traitants ».",
    steps: ["Cliquez sur « Sous-traitant » pour en ajouter un.", "Ajoutez ses attestations et leur date de validité.", "Le jour du paiement, consultez le service officiel et encodez le résultat."],
    tips: [],
    notes: ["La consultation automatique du service officiel n'est pas encore disponible."],
    keywords: ["sous-traitant", "30bis", "retenue", "attestation", "onss", "inasti"],
    shot: { hash: "sous-traitants", caption: "Sous-traitants et attestations." },
  },
  {
    slug: "stock-flotte",
    title: "Stock et véhicules",
    category: "achats",
    icon: "Boxes",
    tagline: "Dépôt, camionnettes et entretiens.",
    what: "Stock multi-emplacements (dépôt, camionnettes) avec transferts, inventaire et minimum. Les véhicules suivent contrôle technique, entretiens et frais imputés aux chantiers.",
    where: "Menus « Stock » et « Flotte ».",
    steps: ["Stock → créez votre dépôt, puis ajoutez des mouvements.", "Flotte → ajoutez un véhicule et ses échéances."],
    tips: [],
    notes: [],
    keywords: ["stock", "dépôt", "inventaire", "camionnette", "véhicule", "flotte"],
    shot: { hash: "stock", caption: "Le stock du dépôt et des camionnettes." },
  },

  // ── Équipe & accès ─────────────────────────────────────────────────────────
  {
    slug: "roles-et-acces",
    title: "Utilisateurs, rôles et droits d'accès",
    category: "equipe",
    icon: "Users",
    tagline: "Chacun voit uniquement ce qui le concerne.",
    what: "Le titulaire du compte est le super admin, unique et non transférable. Il crée les utilisateurs (administrateur, employé, secrétaire, comptable, ouvrier) et choisit pour chaque module : aucun accès, lecture ou modification. Les menus interdits sont masqués et toute modification non autorisée est refusée.",
    where: "Menu « Équipe » → onglets « Utilisateurs » et « Rôles et accès » (super admin uniquement).",
    steps: ["Équipe → « Nouvel utilisateur » : nom, rôle, code PIN.", "Rôles et accès : choisissez un rôle et réglez chaque module.", "Dans la fiche d'une personne, activez « Accès personnalisés » pour une exception."],
    tips: ["« Rétablir les droits par défaut » remet un rôle à zéro."],
    notes: ["Aujourd'hui, les droits sont contrôlés sur l'appareil de l'entreprise ; ils passeront côté serveur avec les comptes en ligne."],
    keywords: ["utilisateur", "rôle", "droits", "accès", "permission", "admin", "secrétaire", "comptable", "employé", "code pin", "empêcher de voir les prix", "cacher les prix", "voir les prix", "interdire", "droits d'accès", "autoriser", "secrétaire", "nouvel utilisateur", "ajouter un utilisateur", "ajouter un ouvrier", "ajouter un employé", "qui peut voir"],
    shot: { hash: "equipe", action: "open-team-roles", caption: "Rôles et accès, module par module." },
  },
  {
    slug: "pointage",
    title: "Pointage des heures et notes de frais",
    category: "equipe",
    icon: "Clock",
    tagline: "Les heures par chantier, prêtes pour le secrétariat social.",
    what: "Les heures pointées par les ouvriers (ou encodées au bureau) alimentent la rentabilité et s'exportent pour le secrétariat social. Les notes de frais se valident et se marquent remboursées.",
    where: "Équipe → « Heures de la semaine » et « Notes de frais ».",
    steps: ["Équipe → Heures de la semaine.", "« Encoder des heures » ou consultez les pointages.", "« Export pour le secrétariat social »."],
    tips: [],
    notes: ["Biltov ne calcule pas les salaires."],
    keywords: ["pointage", "heures", "frais", "ticket", "secrétariat social", "salaire"],
    shot: { hash: "equipe", action: "open-team-hours", caption: "Les heures de la semaine." },
  },

  // ── Réglages & compte ──────────────────────────────────────────────────────
  {
    slug: "parametres",
    title: "Paramètres de l'entreprise",
    category: "compte",
    icon: "Settings",
    tagline: "Identité, numérotation, relances, couleurs.",
    what: "Identité de l'entreprise (BCE, TVA, IBAN, assurance), couleurs et logo des documents, numérotation, conditions générales, modèles de relances, listes de prix et marges par défaut.",
    where: "Menu « Paramètres ».",
    steps: ["Paramètres → Entreprise : complétez l'identité.", "Devis & factures : préfixes, acompte, validité, marges.", "Relances : adaptez les textes."],
    tips: [],
    notes: ["Seuls les utilisateurs autorisés voient les Paramètres."],
    keywords: ["paramètres", "réglages", "entreprise", "logo", "couleurs", "numérotation", "iban", "bce", "iban", "changer l'iban", "adresse de l'entreprise", "logo", "numéro de tva", "coordonnées de l'entreprise", "mentions sur les factures", "numérotation"],
    shot: { hash: "parametres", caption: "Les paramètres de l'entreprise." },
  },
  {
    slug: "sauvegarde",
    title: "Sauvegarde et données",
    category: "compte",
    icon: "HardDriveDownload",
    tagline: "Vos données, sur votre appareil, sauvegardables.",
    what: "Les données sont enregistrées dans le navigateur de l'appareil. Une sauvegarde complète (photos comprises) se télécharge et se restaure en un clic.",
    where: "Paramètres → « Sauvegarde ».",
    steps: ["Paramètres → Sauvegarde → « Télécharger la sauvegarde ».", "Pour restaurer (changement d'appareil) : rubrique « Restaurer » → « Choisir le fichier »."],
    tips: ["Faites une sauvegarde chaque semaine, surtout avant de changer d'appareil."],
    notes: ["Vider les données du navigateur efface Biltov sur cet appareil : gardez une sauvegarde."],
    keywords: ["sauvegarde", "backup", "données", "restaurer", "perte", "changer de téléphone", "changer de téléphone", "nouveau téléphone", "retrouver mes chantiers", "perdu mes données", "transférer mes données"],
    shot: { hash: "parametres", action: "open-backup", caption: "Sauvegarde et restauration." },
  },
  {
    slug: "abonnement",
    title: "Abonnement et tarif",
    category: "compte",
    icon: "CreditCard",
    tagline: "99 € HTVA par mois, tout inclus.",
    what: "Biltov Pro coûte 99 € HTVA par mois ou 948 € HTVA par an, sans engagement. Le paiement se fait par Stripe, avec prélèvement automatique.",
    where: "Bandeau d'essai dans votre espace → « S'abonner », ou section Tarif de la page d'accueil.",
    steps: ["Cliquez sur « S'abonner ».", "Payez sur la page sécurisée Stripe.", "Vous revenez dans votre espace, abonnement actif."],
    tips: [],
    notes: ["Après l'essai, vos données restent exportables même sans abonnement."],
    keywords: ["prix", "tarif", "abonnement", "payer", "stripe", "résilier", "facture biltov", "combien ça coûte", "coût", "prix de biltov", "payer biltov", "résilier", "mensuel", "99 euros"],
    shot: { hash: "", action: "landing-pricing", caption: "Biltov Pro : 99 € HTVA par mois." },
  },
  {
    slug: "application-mobile",
    title: "Installer Biltov sur le téléphone",
    category: "compte",
    icon: "Smartphone",
    tagline: "Une icône sur l'écran d'accueil, même hors ligne.",
    what: "Biltov s'installe comme une application depuis le navigateur et fonctionne hors ligne pour consulter et saisir.",
    where: "Dans votre espace, menu du navigateur.",
    steps: ["iPhone (Safari) : bouton Partager → « Sur l'écran d'accueil ».", "Android (Chrome) : menu ⋮ → « Installer l'application »."],
    tips: [],
    notes: ["Si une nouvelle version ne s'affiche pas, rechargez la page (Ctrl+Maj+R sur ordinateur)."],
    keywords: ["installer", "application", "iphone", "android", "écran d'accueil", "hors ligne", "mise à jour"],
    shot: { hash: "apercu", caption: "Biltov sur l'écran du téléphone." },
  },
  {
    slug: "langues-theme",
    title: "Langues, mode jour / nuit",
    category: "compte",
    icon: "Languages",
    tagline: "Français, néerlandais, allemand. Jour ou nuit.",
    what: "L'espace artisan s'affiche en FR, NL ou DE. Chaque client reçoit ses documents dans sa langue. Le mode jour / nuit suit l'appareil ou votre choix.",
    where: "Boutons FR/NL/DE et lune/soleil en haut de l'écran.",
    steps: ["Cliquez sur FR, NL ou DE.", "Cliquez sur la lune ou le soleil pour changer de mode."],
    tips: ["La langue des documents se règle dans la fiche du client."],
    notes: [],
    keywords: ["langue", "néerlandais", "allemand", "traduction", "mode nuit", "thème", "sombre", "clair", "mettre en néerlandais", "passer en néerlandais", "en allemand", "en français", "traduire"],
    shot: { hash: "planning", caption: "Interface claire et lisible, de jour comme de nuit." },
  },
];

/** Problèmes courants (FAQ du support). */
export const TROUBLESHOOTING: { q: string; a: string }[] = [
  { q: "Le micro ne fonctionne pas", a: "Autorisez le micro quand le navigateur le demande. Sur iPhone : Réglages → Safari → Micro → Autoriser. Sur Chrome : icône cadenas à gauche de l'adresse → Micro → Autoriser. Sinon, écrivez votre message : l'analyse est la même." },
  { q: "Je ne vois pas la dernière version du site", a: "Rechargez la page en forçant (Ctrl+Maj+R sur ordinateur). Sur téléphone, fermez l'application installée et rouvrez-la." },
  { q: "Mes données ont disparu", a: "Les données sont sur l'appareil et dans le navigateur utilisés. Vérifiez que vous êtes sur le même appareil, le même navigateur et le même compte. Si les données du navigateur ont été effacées, restaurez votre dernière sauvegarde (Paramètres → Sauvegarde)." },
  { q: "Le PDF ne s'ouvre pas", a: "Autorisez les fenêtres pop-up pour le site, ou utilisez le bouton de téléchargement." },
  { q: "Je ne peux pas modifier un devis ou une facture", a: "Un devis signé ou une facture émise est verrouillé. Créez une nouvelle version, un avenant ou une note de crédit. Vérifiez aussi vos droits : un message « Action refusée » signifie que votre rôle ne permet pas la modification." },
  { q: "J'ai oublié mon mot de passe", a: "Le compte est enregistré sur l'appareil : il n'y a pas encore de réinitialisation par e-mail. Contactez le support." },
  { q: "Un menu a disparu", a: "Les menus dépendent de vos droits et des modules activés (menu Modules). Demandez au super admin de vérifier vos accès." },
];

const STOP = new Set(["comment", "pour", "dans", "avec", "une", "des", "les", "est", "pas", "que", "qui", "quoi", "mon", "mes", "son", "ses", "sur", "faire", "peux", "peut", "veux", "biltov", "the", "fait", "fais", "plus", "tout", "tous", "cette", "ces", "quel", "quelle", "ou", "oui", "non", "chez", "sans", "aussi", "alors", "puis", "voir", "avoir", "etre", "ça", "ca", "ici"]);
const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, " ");
/** Racine grossière d'un mot français : « relancer », « relances » → « relanc ». */
const stem = (w: string) => w.replace(/(ements?|ations?|euses?|eurs?|ees?|er|ez|ent|es|s|e|x)$/, "");
const tokens = (s: string) =>
  normalize(s)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map(stem)
    .filter((w) => w.length > 2);

/** À une faute de frappe près (mots d'au moins 5 lettres). */
function close(a: string, b: string) {
  if (a === b) return true;
  if (a.length < 5 || b.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let diff = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) (i++, j++);
    else {
      if (++diff > 1) return false;
      if (a.length > b.length) i++;
      else if (a.length < b.length) j++;
      else (i++, j++);
    }
  }
  return diff + (a.length - i) + (b.length - j) <= 1;
}

type Doc = { f: Feature; kw: Set<string>; phrases: string[][]; title: Set<string>; body: Set<string> };
let docs: Doc[] | null = null;
let df: Map<string, number> | null = null;
function index() {
  if (docs && df) return { docs, df };
  docs = FEATURES.map((f) => ({
    f,
    kw: new Set(f.keywords.flatMap(tokens)),
    phrases: f.keywords.map(tokens).filter((p) => p.length > 1),
    title: new Set(tokens(f.title)),
    body: new Set(tokens([f.tagline, f.what, f.where, ...f.steps, ...f.tips].join(" "))),
  }));
  df = new Map();
  for (const d of docs) for (const w of new Set([...d.kw, ...d.title, ...d.body])) df.set(w, (df.get(w) ?? 0) + 1);
  return { docs, df };
}

/** Fonctionnalités les plus proches d'une question (mots rares pesés, expressions entières, fautes de frappe). */
export function searchKnowledge(query: string, limit = 3): Feature[] {
  const q = [...new Set(tokens(query))];
  if (!q.length) return [];
  const { docs: ds, df: freq } = index();
  const idf = (w: string) => Math.log(1 + ds.length / (freq.get(w) ?? 0.5));
  const has = (set: Set<string>, w: string) => set.has(w) || [...set].some((x) => close(x, w));
  const scored = ds
    .map((d) => {
      let score = 0;
      let strong = 0; // mots trouvés dans les mots-clés ou le titre
      for (const w of q) {
        const weight = idf(w);
        if (has(d.kw, w)) (score += 4 * weight, strong++);
        else if (has(d.title, w)) (score += 3 * weight, strong++);
        else if (has(d.body, w)) score += 1 * weight;
      }
      // une expression entière (« code pin », « note de crédit ») pèse davantage
      for (const p of d.phrases) if (p.every((w) => q.includes(w))) score += 6 * p.length;
      return { f: d.f, score, strong };
    })
    .filter((x) => x.strong > 0 && x.score >= 5)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.f);
}

/** Base complète en Markdown : fichier knowledge/biltov-features.md et prompt système du chat. */
export function knowledgeMarkdown(): string {
  const out: string[] = ["# Biltov — base de connaissances des fonctionnalités", "", "Biltov : logiciel de devis et facturation à la voix pour les artisans du bâtiment en Belgique (FR / NL / DE).", ""];
  for (const c of CATEGORIES) {
    out.push(`## ${c.label}`, "", c.desc, "");
    for (const f of FEATURES.filter((x) => x.category === c.id)) {
      out.push(`### ${f.title}`, "", `Page : /fonctionnalites/${f.slug}/`, "", f.what, "", `**Où :** ${f.where}`, "", "**Étapes :**", ...f.steps.map((s, i) => `${i + 1}. ${s}`), "");
      if (f.tips.length) out.push("**Astuces :**", ...f.tips.map((s) => `- ${s}`), "");
      if (f.notes.length) out.push("**Cas particuliers :**", ...f.notes.map((s) => `- ${s}`), "");
    }
  }
  out.push("## Problèmes courants", "");
  for (const t of TROUBLESHOOTING) out.push(`### ${t.q}`, "", t.a, "");
  return out.join("\n");
}
