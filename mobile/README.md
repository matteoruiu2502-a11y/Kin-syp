# KinéSyP — bilans articulaires assistés par IA

Application tablette (iPad / Android) pour masseurs-kinésithérapeutes.
Objectif : l'expérience **« zéro clic »** — la mesure démarre à l'ouverture,
les amplitudes sont capturées automatiquement et le bilan se rédige tout seul.

**Parcours complet en 3 clics :** ouvrir l'app (la caméra mesure déjà) →
**💾 Enregistrer** → **📄 Bilan** → **Exporter le PDF**.

## Fonctionnalités

### Module 1 — Mesure automatique par vision
| Fonction | Détail |
|---|---|
| Détection squelettique | MediaPipe Pose Landmarker *full* (33 repères), GPU, **100 % sur l'appareil**. |
| 10 articulations | Épaule (élévation), coude, hanche, genou (flexion), cheville (flexion dorsale / plantaire), gauche et droite, conventions goniométriques. |
| Zéro clic | L'articulation en mouvement est mise en avant automatiquement ; **max** et **min** capturés sans appui. Appui sur une valeur = verrouiller le focus. |
| Stabilité / fiabilité | Filtre *One Euro* ; alerte orange si le mouvement sort du plan de la caméra (écart 2D/3D > 20°), pics hors plan ignorés. |
| Compensations | Posture de référence capturée automatiquement, puis membre entouré en rouge + alerte si le tronc s'incline (> 10°) ou le bassin bascule (> 6°). |
| Mode fantôme | Le mouvement de la séance précédente est rejoué en transparence (squelette violet) et recalé sur le patient en direct pour comparer avant/après. |

### Module 2 — Assistant de bilan
| Fonction | Détail |
|---|---|
| Dictée vocale | Bouton micro (écran de mesure et bilan), reconnaissance native iOS/Android en français, **sur l'appareil** quand disponible (indicateur 🔒 / ⚠). |
| Structuration | « Flexion genou droit 90°, légère douleur en fin de course » → mesure {genou D, flexion, 90°} + douleur {légère, en fin de course}. Nombres en lettres, EVA, négations, contexte de douleur, observations libres. |
| Bilan PDF en 1 clic | En-tête praticien/patient, tableau des amplitudes **comparées aux normes selon l'âge et le sexe**, symétrie G/D, **graphiques d'évolution** par articulation, sport, posture, observations dictées, **photos** des mesures clés, signature. Généré sur l'appareil puis partagé (AirDrop, mail, DMP…). |

### Module 3 — Spécialisations
| Mode | Détail |
|---|---|
| 🏃 Sport | Asymétrie G/D en % et LSI (critère de reprise ≥ 90 %), comptage des répétitions, durée, vitesse angulaire max et moyenne. |
| 🧸 Pédiatrie | Étoile à attraper placée à l'amplitude cible (90 % de la norme de l'âge), fusée qui monte avec le mouvement, badges et vibration à chaque réussite. |
| 🧍 Posturologie | Détection automatique vue de face / profil. Face : épaules, bassin, tête, translation du tronc. Profil : antéposition de la tête, inclinaison du tronc, épaule et bassin vs fil à plomb. Lignes colorées à l'écran. |

### Comptes, recherche et abonnement
| Fonction | Détail |
|---|---|
| Compte praticien | Inscription / connexion par e-mail ; session dans le trousseau sécurisé ; données séparées par compte sur la tablette. |
| Recherche patients | Nom, prénom ou date de naissance ; sans accents ni casse, mots dans n'importe quel ordre. |
| Offre | 5 patients gratuits, puis abonnement **50 € / mois** (Stripe, via le serveur `../server`). Quota vérifié par le serveur. |

Configurer l'URL du serveur dans `app.json` → `expo.extra.apiUrl`. Vide =
mode démonstration (comptes locaux, paiement simulé).

## Architecture

```
mobile/
├── App.tsx                        # Store + navigation (mesure / patients / bilan)
├── pose-model.config.js           # Nom + URL du modèle (source unique)
├── plugins/withPoseModel.js       # Plugin Expo : embarque le modèle dans iOS/Android
├── scripts/fetch-pose-model.js    # Téléchargement du modèle (postinstall)
└── src/
    ├── core/                      # TypeScript pur, sans React Native → testé (Jest)
    │   ├── geometry.ts, joints.ts, landmarks.ts, oneEuroFilter.ts
    │   ├── jointAnalyzer.ts       # Mesures, pics, hors-plan, auto-focus
    │   ├── compensation.ts        # Compensations tronc / bassin
    │   ├── ghost.ts               # Enregistrement / recalage du fantôme
    │   ├── sport.ts               # LSI, répétitions, vitesse
    │   ├── pediatric.ts           # Position de la cible, progression
    │   ├── posture.ts             # Analyse posturale face / profil
    │   ├── dictation.ts, frenchNumbers.ts   # Structuration de la dictée
    │   ├── norms.ts               # Normes par âge et sexe (fichier unique, modifiable)
    │   ├── model.ts               # Patient, séance, historique
    │   └── report/                # HTML du bilan + graphiques SVG
    ├── data/                      # Persistance locale (expo-file-system) + store React
    ├── features/
    │   ├── measure/               # Caméra, HUD, overlays (squelette, fantôme, pédiatrie, posture)
    │   ├── dictation/             # Micro + reconnaissance vocale
    │   ├── session/               # Enregistrer une série, ajouter une note
    │   ├── report/                # Écran bilan + export PDF
    │   └── patients/              # Dossiers patients, réglages praticien
    └── ui/                        # Thème, boutons XXL, toasts
```

**Pipeline par image :** Vision Camera → *frame processor* natif MediaPipe
(GPU) → 33 repères → coordonnées écran (rotation, miroir, recadrage) →
`JointAnalyzer`, `CompensationDetector`, `RepetitionTracker`,
`PostureSmoother`, `GhostRecorder` → rendu SVG. La conversion étant conforme,
l'angle affiché correspond exactement à l'image vue par le praticien.

**Séance :** une séance = un patient + un jour. Chaque « Enregistrer » y ajoute
les articulations mobilisées (amplitude parcourue ≥ 10°, meilleure valeur
conservée), une photo, le squelette pour le fantôme et, selon le mode,
les résultats sport ou posture.

**Données (RGPD) :** tout reste dans le dossier documents de l'app
(`kinesyp/`) : patients, séances JSON, photos réduites à 1024 px, fantômes.
Aucun serveur. Le PDF n'est transmis que par le partage explicite du praticien.

### Stack
- Expo SDK 57 / React Native 0.86 (TypeScript), build de développement.
- react-native-vision-camera 4.7 + react-native-worklets-core + react-native-mediapipe 0.6
  (Vision Camera épinglée en v4 : la v5 n'est pas compatible avec react-native-mediapipe).
- react-native-svg (overlays), expo-speech-recognition (dictée), expo-print + expo-sharing (PDF),
  expo-file-system, expo-image-manipulator, expo-haptics, expo-keep-awake.

## Démarrer

Prérequis : Node 20+, Xcode (iPad) ou Android Studio, ou un compte EAS.

```bash
cd mobile
npm install            # télécharge aussi le modèle (~9 Mo) dans assets/models/
npm run ios            # ou: npm run android  (build de développement natif)
```

Expo Go **ne suffit pas** (modules natifs). Sans Mac :
`npx eas-cli@latest build --profile development --platform ios`.
Si le modèle manque : `npm run fetch-model`.

```bash
npm test               # 75 tests du cœur (mesure, sport, posture, dictée, bilan…)
npm run typecheck
```

## Utilisation (tablette sur trépied, ~2 m)

1. Premier lancement : **👤 Choisir un patient** → créer (nom, date de
   naissance, sexe — utilisés pour les normes). Le patient reste sélectionné.
2. Choisir le mode en haut à gauche (Standard, Sport, Pédiatrie, Posturo).
3. Le patient reste immobile ~0,5 s (calibrage), puis fait le mouvement.
   Caméra **perpendiculaire au plan du mouvement** (profil pour une flexion).
4. **💾 Enregistrer** → amplitudes + photo + squelette ajoutés à la séance.
   Dicter à tout moment avec 🎙.
5. **📄 Bilan** → relire, compléter les observations → **Exporter le PDF**.
6. À la séance suivante, **👻 Fantôme** superpose le mouvement précédent.

## Limites connues

- **Validé ici par tests unitaires, compilation iOS/Android et génération
  native ; pas encore testé sur tablette.** La précision clinique doit être
  validée face à un goniomètre avant usage en bilan.
- **Normes indicatives** (`src/core/norms.ts`) : ordres de grandeur AAOS /
  Kapandji modulés par âge et sexe selon les tendances de la littérature ;
  à valider ou remplacer par le référentiel du cabinet.
- Mesure 2D : pas de recurvatum / hyperextension (plancher 0°) pour coude
  et genou ; rotations et prono-supination non mesurables par la caméra
  (à dicter).
- Mode fantôme = squelette, pas vidéo : `react-native-mediapipe` ne permet
  pas d'enregistrer la vidéo pendant l'analyse, et le squelette ne contient
  aucune image identifiante du patient.
- Les photos ne contiennent pas les annotations d'angle (légende texte à la place).
- Si l'appareil ne propose pas la reconnaissance vocale hors ligne, la dictée
  utilise le service du système (Apple / Google) : l'indicateur ⚠ le signale.
- Pas de chiffrement applicatif en plus de celui de l'OS ; pas de sauvegarde
  / synchronisation entre appareils.
- Un logiciel produisant des mesures utilisées pour un diagnostic peut relever
  du règlement européen sur les dispositifs médicaux (MDR) : à qualifier
  avant diffusion.
