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
};

export default nextConfig;
