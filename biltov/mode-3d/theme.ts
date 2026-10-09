// Couleurs de la scène, alignées sur le thème jour / nuit du site (variables CSS de globals.css).
// Une seule couleur de marque ; les couleurs vives sont réservées aux statuts (alerte, attention, ok).

export type Palette = {
  dark: boolean;
  background: string;
  ground: string;
  slab: string;
  floor: string;
  wall: string;
  partition: string;
  furniture: string;
  furnitureDark: string;
  box: string;
  asphalt: string;
  marking: string;
  van: string;
  glass: string;
  person: string;
  cloud: string;
  sign: string;
  brand: string;
  danger: string;
  warning: string;
  ok: string;
  soon: string;
};

const css = (name: string, fallback: string) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
};

export const isDarkTheme = () => document.documentElement.dataset.theme !== "light";

export function readPalette(): Palette {
  const dark = isDarkTheme();
  const status = { brand: css("--brand", "#1d4ed8"), danger: css("--danger", "#dc2626"), warning: css("--warning", "#ea580c"), ok: css("--success", "#16a34a") };
  return dark
    ? {
        dark,
        background: css("--bg", "#0b1220"),
        ground: "#131c2e",
        slab: "#1e293b",
        floor: "#273449",
        wall: "#334155",
        partition: "#2b3a52",
        furniture: "#475569",
        furnitureDark: "#1e293b",
        box: "#64748b",
        asphalt: "#0f1726",
        marking: "#94a3b8",
        van: "#cbd5e1",
        glass: "#1e3a8a",
        person: "#94a3b8",
        cloud: "#334155",
        sign: "#0f172a",
        soon: "#1f2937",
        ...status,
      }
    : {
        dark,
        background: css("--bg", "#f8fafc"),
        ground: "#e8edf3",
        slab: "#cbd5e1",
        floor: "#f1f5f9",
        wall: "#ffffff",
        partition: "#e2e8f0",
        furniture: "#94a3b8",
        furnitureDark: "#64748b",
        box: "#cbd5e1",
        asphalt: "#d5dbe3",
        marking: "#ffffff",
        van: "#ffffff",
        glass: "#bfdbfe",
        person: "#64748b",
        cloud: "#ffffff",
        sign: "#ffffff",
        soon: "#d1d5db",
        ...status,
      };
}
