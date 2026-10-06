import type { PreviewEvent } from "./preview";
import { saveLocalProfileToFirebase } from "./firebase-profile";

export type LocalSettings = {
  challenge: boolean;
  cup: boolean;
  prerelease: boolean;
  other: boolean;
  discoveryRadiusKm: number;
  location: { latitude: number; longitude: number } | null;
};

const KEY = "poke-event-alert:preview-settings";

export const DEFAULT_SETTINGS: LocalSettings = {
  challenge: true,
  cup: true,
  prerelease: true,
  other: true,
  discoveryRadiusKm: 0,
  location: null
};

export function readLocalSettings(): LocalSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<LocalSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      discoveryRadiusKm: Number.isFinite(parsed.discoveryRadiusKm)
        ? Math.max(0, Math.min(200, Number(parsed.discoveryRadiusKm)))
        : 0,
      location: parsed.location &&
        Number.isFinite(parsed.location.latitude) &&
        Number.isFinite(parsed.location.longitude)
          ? parsed.location
          : null
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveLocalSettings(settings: LocalSettings) {
  localStorage.setItem(KEY, JSON.stringify(settings));
  window.dispatchEvent(new Event("poke-settings-changed"));
  void saveLocalProfileToFirebase().catch(() => undefined);
}

export function matchesEventType(type: string, settings: LocalSettings) {
  const normalized = type.toLowerCase();
  if (normalized.includes("challenge")) return settings.challenge;
  if (normalized.includes("cup")) return settings.cup;
  if (normalized.includes("avant") || normalized.includes("prerelease")) return settings.prerelease;
  return settings.other;
}

export function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const value = Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function isPersonalEvent(event: PreviewEvent, favorites: string[], settings: LocalSettings) {
  if (!matchesEventType(event.type, settings)) return false;
  if (favorites.includes(event.venueKey)) return true;
  if (!settings.location || !settings.discoveryRadiusKm || event.latitude == null || event.longitude == null) return false;
  return distanceKm(settings.location, { latitude: event.latitude, longitude: event.longitude }) <= settings.discoveryRadiusKm;
}
