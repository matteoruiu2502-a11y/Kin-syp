// Vidéos du site, déclarées dans content/videos.json (aucun code à écrire pour en ajouter une).
import config from "../content/videos.json";

export type Video = {
  id: string;
  title: string;
  description: string;
  file: string; // dans public/videos/ ; vide = emplacement « vidéo à venir »
  poster: string;
  duration?: string;
  orientation: "portrait" | "landscape";
  pages: string[];
};

export const VIDEOS: Video[] = (config.videos as Video[]).map((v) => ({ ...v, orientation: v.orientation === "landscape" ? "landscape" : "portrait" }));

/** Vidéos à afficher sur une page : « accueil », « fonctionnalites » ou « fonctionnalites/<slug> ». */
export const videosFor = (page: string) => VIDEOS.filter((v) => v.pages.includes(page));

const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
export const videoUrl = (file: string) => (file ? `${base}/videos/${file}` : "");
