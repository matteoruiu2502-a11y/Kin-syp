// Géolocalisation (pointage, photos) et liens d'itinéraire, sans clé d'API.

import type { Geo } from "./types";

/** Position actuelle de l'appareil, ou null si refusée / indisponible (jamais bloquant). */
export function currentGeo(timeoutMs = 8000): Promise<Geo | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    const timer = setTimeout(() => resolve(null), timeoutMs + 500);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(timer);
        resolve({ lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6, accuracy: Math.round(p.coords.accuracy) });
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}

export const mapsRoute = (address: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
export const wazeRoute = (address: string) => `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
export const mapsEmbed = (address: string) => `https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
export const geoLink = (g: Geo) => `https://www.google.com/maps/search/?api=1&query=${g.lat},${g.lng}`;

/** Distance en mètres entre deux points (formule de haversine). */
export function distanceM(a: Pick<Geo, "lat" | "lng">, b: Pick<Geo, "lat" | "lng">) {
  const R = 6371e3;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}
