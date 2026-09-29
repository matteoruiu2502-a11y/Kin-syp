# Kin-syp

**Application web en ligne : https://matteoruiu2502-a11y.github.io/Kin-syp/app/** — mise en ligne complète : voir [`docs/MISE-EN-LIGNE.md`](docs/MISE-EN-LIGNE.md)** (version web, app tablette, paiement, stores).

| Dossier | Contenu |
|---|---|
| [`mobile/`](mobile/README.md) | **KinéSyP** — application tablette de mesure d'amplitude et de bilans assistés par IA : vision (MediaPipe Pose), dictée vocale, bilan PDF, modes sport / pédiatrie / posturologie (React Native / Expo). Exemple de bilan : [`mobile/docs/exemple-bilan.pdf`](mobile/docs/exemple-bilan.pdf). |
| [`web/`](web/README.md) | **Version web** (React + Vite) de KinéSyP : même cœur de mesure, patient démo, import vidéo ou webcam, à tester dans le navigateur. |
| [`server/`](server/README.md) | **Service de comptes et d'abonnement** : comptes praticiens, 5 patients gratuits puis 50 €/mois (Stripe). Aucune donnée de santé côté serveur. |
| `app/` | Version web construite, publiée par GitHub Pages (généré par `web/`, `npm run site`). |
| [`biltov/`](biltov/README.md) | **Biltov** — landing page (Next.js, Tailwind, Framer Motion, React Three Fiber) de l'assistant IA vocal et de facturation pour les artisans du BTP. Publiée dans `/biltov/`. |
| `index.html` | Site vitrine Escal'hop! (projet existant, indépendant). |
