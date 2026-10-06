import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { DEFAULT_SETTINGS, type LocalSettings } from "./local-settings";
import { firebaseAuth, firestore } from "./firebase";
import type { BlockedVenue } from "./blocked-venues";

const FAVORITES_KEY = "poke-event-alert:preview-favorites";
const BLOCKED_KEY = "poke-event-alert:blocked-venues";
const SETTINGS_KEY = "poke-event-alert:preview-settings";

type CloudSettings = Pick<LocalSettings, "challenge" | "cup" | "prerelease" | "other" | "discoveryRadiusKm">;

function readJson<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "null") as T ?? fallback;
  } catch {
    return fallback;
  }
}

function readCloudSettings(): CloudSettings {
  const settings = readJson<Partial<LocalSettings>>(SETTINGS_KEY, {});
  return {
    challenge: settings.challenge ?? DEFAULT_SETTINGS.challenge,
    cup: settings.cup ?? DEFAULT_SETTINGS.cup,
    prerelease: settings.prerelease ?? DEFAULT_SETTINGS.prerelease,
    other: settings.other ?? DEFAULT_SETTINGS.other,
    discoveryRadiusKm: settings.discoveryRadiusKm ?? DEFAULT_SETTINGS.discoveryRadiusKm
  };
}

function profileRef(user: User) {
  if (!firestore) throw new Error("Firebase n'est pas configuré.");
  return doc(firestore, "users", user.uid);
}

export async function saveLocalProfileToFirebase(user?: User) {
  if (!firestore || !firebaseAuth || typeof window === "undefined") return;
  await firebaseAuth.authStateReady();
  const currentUser = user ?? firebaseAuth.currentUser;
  if (!currentUser) return;

  await setDoc(profileRef(currentUser), {
    followedVenueKeys: readJson<string[]>(FAVORITES_KEY, []).filter((key) => typeof key === "string"),
    blockedVenues: readJson<BlockedVenue[]>(BLOCKED_KEY, []).filter((venue) =>
      typeof venue?.key === "string" && typeof venue.name === "string" && typeof venue.city === "string"
    ),
    settings: readCloudSettings(),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export async function restoreFirebaseProfile(user: User) {
  if (!firestore || typeof window === "undefined") return;
  const reference = profileRef(user);
  const snapshot = await getDoc(reference);
  if (!snapshot.exists()) {
    await saveLocalProfileToFirebase(user);
    return;
  }

  const profile = snapshot.data();
  const followed = Array.isArray(profile.followedVenueKeys)
    ? profile.followedVenueKeys.filter((key): key is string => typeof key === "string")
    : [];
  const blocked = Array.isArray(profile.blockedVenues)
    ? profile.blockedVenues.filter((venue): venue is BlockedVenue =>
        typeof venue?.key === "string" && typeof venue.name === "string" && typeof venue.city === "string"
      )
    : [];
  const cloudSettings = profile.settings && typeof profile.settings === "object" ? profile.settings as Partial<CloudSettings> : {};
  const localSettings = readJson<Partial<LocalSettings>>(SETTINGS_KEY, {});

  window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(followed));
  window.localStorage.setItem(BLOCKED_KEY, JSON.stringify(blocked));
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({
    ...DEFAULT_SETTINGS,
    ...localSettings,
    ...cloudSettings,
    // La position est volontairement propre à chaque appareil.
    location: localSettings.location ?? null
  }));
  window.dispatchEvent(new Event("poke-settings-changed"));
}
