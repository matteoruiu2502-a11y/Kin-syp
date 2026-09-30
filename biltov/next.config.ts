import type { NextConfig } from "next";

// Export statique : le site se sert depuis n'importe quel hébergement de fichiers.
// NEXT_PUBLIC_BASE_PATH permet de le publier dans un sous-dossier (ex. /Kin-syp/biltov).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  // Date de publication affichée en pied de page : permet de vérifier qu'on voit la dernière version.
  env: { NEXT_PUBLIC_BUILD: new Date().toISOString().slice(0, 16).replace("T", " ") },
};

export default nextConfig;
