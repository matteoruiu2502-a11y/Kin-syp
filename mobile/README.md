# KinéSyP — mesure d'amplitude articulaire assistée par IA

Application tablette (iPad / Android) pour masseurs-kinésithérapeutes.
Objectif : l'expérience **« zéro clic »** — la mesure démarre à l'ouverture,
l'amplitude est capturée automatiquement, le bilan se rédige tout seul.

> **État : MVP du module 1** — caméra + MediaPipe Pose (33 repères) en local,
> angles du coude et du genou (G/D) affichés en direct.

## Ce que fait le MVP

| Fonction | Détail |
|---|---|
| Détection squelettique | MediaPipe Pose Landmarker *full*, GPU, 100 % sur l'appareil (aucune image envoyée). |
| Angles en direct | Flexion coude G/D et genou G/D, convention goniométrique (0° = extension complète). Angle géant de l'articulation active, lisible à 2 m. |
| Zéro clic | L'articulation qui bouge est mise en avant automatiquement ; **flexion max** et **meilleure extension** capturées sans appui. Appui sur une carte = verrouiller le focus. |
| Stabilité | Filtre *One Euro* : valeur stable au repos, sans latence en mouvement. |
| Fiabilité | Alerte orange si le mouvement sort du plan de la caméra (écart angle 2D / 3D > 20°) ; les pics mesurés hors plan sont ignorés. |
| Compensations (aperçu module 1.3) | Posture de référence capturée automatiquement, puis alerte rouge + entourage des repères si le tronc s'incline (> 10°) ou si le bassin bascule (> 6°, vue de face). |
| Ergonomie cabinet | Boutons ≥ 72 pt, thème sombre contrasté, écran maintenu allumé (trépied), portrait et paysage. |

## Architecture

```
mobile/
├── App.tsx                        # Permission caméra → écran de mesure
├── pose-model.config.js           # Nom + URL du modèle (source unique)
├── plugins/withPoseModel.js       # Plugin Expo : embarque le modèle dans iOS/Android
├── scripts/fetch-pose-model.js    # Téléchargement du modèle (postinstall)
└── src/
    ├── core/                      # TypeScript pur, sans React Native → testable
    │   ├── landmarks.ts           # 33 repères BlazePose + squelette affiché
    │   ├── geometry.ts            # Angles 2D/3D, inclinaisons
    │   ├── joints.ts              # Définition coude/genou, convention de flexion
    │   ├── oneEuroFilter.ts       # Lissage adaptatif
    │   ├── jointAnalyzer.ts       # Mesures, pics, hors-plan, auto-focus
    │   ├── compensation.ts        # Détection de compensations tronc/bassin
    │   └── __tests__/             # Tests Jest (pose synthétique)
    ├── features/measure/          # Écran de mesure
    │   ├── usePoseAnalysis.ts     # Pont MediaPipe → core (coordonnées écran)
    │   ├── MeasureScreen.tsx      # Caméra + HUD
    │   ├── SkeletonOverlay.tsx    # Squelette, arcs d'angle, cercles rouges (SVG)
    │   ├── HeroReadout.tsx        # Angle géant de l'articulation active
    │   ├── JointCards.tsx         # 4 cartes coude/genou (tap = verrou)
    │   └── AlertBanner.tsx
    └── ui/                        # Thème et composants réutilisables
```

**Pipeline par image :** Vision Camera → *frame processor* natif MediaPipe
(GPU) → 33 repères normalisés → conversion en coordonnées écran (rotation,
miroir, recadrage) → `JointAnalyzer` + `CompensationDetector` → rendu SVG.
Les angles sont calculés dans l'espace écran : la conversion étant conforme
(rotation + échelle uniforme + miroir), l'angle affiché correspond exactement
à l'image vue par le praticien.

### Stack

- **Expo SDK 57 / React Native 0.86** (TypeScript), build de développement.
- **react-native-vision-camera 4.7** + **react-native-worklets-core** : flux caméra.
- **react-native-mediapipe 0.6** : MediaPipe Tasks Pose Landmarker natif (iOS/Android).
  Vision Camera est volontairement épinglée en v4 : la v5 (Nitro) n'est pas
  compatible avec cette bibliothèque.
- **react-native-svg** : superposition du squelette.

## Démarrer

Prérequis : Node 20+, Xcode (iPad) ou Android Studio, ou un compte EAS.

```bash
cd mobile
npm install            # télécharge aussi le modèle (~9 Mo) dans assets/models/
npm run ios            # ou: npm run android  (build de développement natif)
```

Expo Go **ne suffit pas** (modules natifs caméra + MediaPipe). Sans Mac :
`npx eas-cli@latest build --profile development --platform ios`.

Si le modèle manque : `npm run fetch-model`.

### Vérifications

```bash
npm test               # tests unitaires du cœur de mesure
npm run typecheck
```

## Utilisation (tablette sur trépied, ~2 m)

1. Ouvrir l'app → le patient entier dans le cadre. Rester immobile ~0,5 s
   (calibrage de la posture de référence).
2. Le patient effectue le mouvement : l'articulation qui bouge s'affiche en
   grand, avec son maximum et sa meilleure extension.
3. **↺ Nouvelle mesure** : remet à zéro les extrêmes et recalibre la posture.

Pour une mesure fiable, placer la caméra **perpendiculaire au plan du
mouvement** (vue de profil pour la flexion du coude/genou). L'alerte orange
signale une mauvaise orientation.

## Limites connues du MVP

- Angle projeté 2D : ne distingue pas encore le recurvatum / l'hyperextension
  (valeur plancher 0°).
- Références d'amplitude adulte uniques (coude 145°, genou 140°) : les normes
  par âge/sexe arrivent avec le module Bilan.
- Validé par tests unitaires et compilation iOS/Android ; la précision
  clinique doit être validée sur appareil face à un goniomètre.

## Feuille de route

- **Module 1** — ✅ caméra + angles coude/genou · ✅ compensations (base)
  · ⏳ épaule, hanche, cheville, rachis · ⏳ mode fantôme avant/après
  (enregistrement des repères de séance et superposition).
- **Module 2** — dictée vocale (Speech-to-Text natif / Whisper local),
  structuration des notes, bilan PDF en 1 clic (graphiques, normes, captures).
- **Module 3** — sport (asymétrie G/D %, vitesse d'exécution — la vitesse
  angulaire est déjà calculée), pédiatrie (interface ludique), posturologie.
- **Données** — stockage chiffré local, export RGPD, aucune donnée de santé
  hors appareil sans consentement explicite.
