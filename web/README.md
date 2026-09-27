# KinéSyP — version web

Version navigateur (React + Vite) de l'application tablette, pour découvrir
et tester toutes les fonctions sans installer d'application. Elle utilise
**exactement le même cœur de mesure** que l'app mobile (`../mobile/src/core`).

## Sources d'image

| Source | Détail |
|---|---|
| **Patient démo** | Mannequin simulé qui enchaîne flexions de genou D puis G, coude D (avec compensation du tronc à la 3e répétition) et élévation d'épaule D. Scénarios « Posture (face) » et « Posture (profil) ». Fonctionne partout. |
| **Vidéo** | Importez une vidéo d'un patient (de profil de préférence) : MediaPipe Pose l'analyse dans le navigateur. |
| **Caméra** | Webcam en direct, analysée par MediaPipe Pose (WebAssembly + GPU), sans envoi d'image. |

Tout le reste est identique à la tablette : 10 articulations, capture
automatique des amplitudes, compensations, mode fantôme, modes Sport /
Pédiatrie / Posturo, dictée structurée, bilan PDF avec normes par âge et
sexe, graphiques d'évolution et captures annotées. Un patient d'exemple avec
deux séances antérieures est pré-chargé (historique et fantôme disponibles
tout de suite).

## Lancer en local (caméra, micro et impression PDF actifs)

```bash
cd web
npm install        # copie le runtime MediaPipe et télécharge le modèle (~6 Mo)
npm run dev        # http://localhost:5173
```

Chrome ou Edge recommandés (la dictée utilise la reconnaissance vocale du
navigateur). `npm run build` produit `dist/`, à servir en HTTPS pour la caméra.

## Version hébergée (page claude.ai)

`npm run build && npm run artifact` assemble `artifact/` (page + bundle +
runtime MediaPipe + modèle encodé en base64, ce type d'hébergement ne servant
pas les fichiers `.task`). Dans cette page intégrée, le navigateur bloque la
caméra, le micro et l'impression : utilisez le patient démo ou une vidéo,
saisissez les observations au clavier ; l'aperçu du bilan est le PDF exact.

## Comptes et abonnement

Chaque kiné crée son compte (e-mail + mot de passe) et retrouve ses propres
patients. Offre : **5 patients gratuits, puis 50 € / mois** (paywall à la
création du 6e). Avec `VITE_API_URL` pointant vers le serveur (`../server`),
comptes et paiement Stripe sont réels ; sans, un mode démonstration local
simule le paiement (signalé à l'écran). La page Patients a une barre de
recherche (nom, prénom, date de naissance ; sans accents, mots dans le désordre).

## Données

Stockées uniquement dans ce navigateur (localStorage) ; « Patients →
Réinitialiser les données de démonstration » remet l'exemple à zéro.
