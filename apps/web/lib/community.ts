import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { firestore } from "./firebase";

export type CommunityProfile = { uid: string; playId: string; displayName: string };
export type CommunityFriendLink = { id: string; members: string[]; requestedBy: string; status: "pending" | "accepted" | "declined" };
export type EventAttendee = { uid: string; playId: string; displayName: string };

function db() {
  if (!firestore) throw new Error("Firebase n’est pas configuré sur ce site.");
  return firestore;
}

function linkId(a: string, b: string) { return [a, b].sort().join("__"); }

export async function saveCommunityProfile(user: User, playId: string, displayName: string) {
  const cleanId = playId.trim();
  if (cleanId && !/^[\w-]{3,32}$/.test(cleanId)) throw new Error("L’identifiant Play! doit contenir 3 à 32 lettres, chiffres, tirets ou underscores.");
  const cleanName = displayName.trim();
  if (!cleanName || cleanName.length > 80) throw new Error("Choisis un pseudo de 1 à 80 caractères.");
  if (cleanId) {
    const matches = await getDocs(query(collection(db(), "publicProfiles"), where("playId", "==", cleanId), limit(2)));
    if (matches.docs.some((profile) => profile.id !== user.uid)) throw new Error("Cet identifiant Play! est déjà associé à un compte.");
  }
  const ref = doc(db(), "publicProfiles", user.uid);
  await setDoc(ref, { playId: cleanId, displayName: cleanName, updatedAt: serverTimestamp() }, { merge: true });
}

export async function getCommunityProfile(uid: string): Promise<CommunityProfile | null> {
  const snapshot = await getDoc(doc(db(), "publicProfiles", uid));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return { uid, playId: typeof data.playId === "string" ? data.playId : "", displayName: typeof data.displayName === "string" ? data.displayName : "Joueur" };
}

export async function sendFriendRequest(user: User, playId: string) {
  const matches = await getDocs(query(collection(db(), "publicProfiles"), where("playId", "==", playId.trim()), limit(2)));
  const target = matches.docs.find((profile) => profile.id !== user.uid);
  if (!target) throw new Error("Aucun joueur trouvé avec cet identifiant Play!.");
  const ref = doc(db(), "friendLinks", linkId(user.uid, target.id));
  const existing = await getDoc(ref);
  if (existing.exists()) {
    const state = existing.data().status;
    throw new Error(state === "accepted" ? "Vous êtes déjà amis." : "Une demande existe déjà entre ces deux comptes.");
  }
  await setDoc(ref, { members: [user.uid, target.id].sort(), requestedBy: user.uid, status: "pending", updatedAt: serverTimestamp() });
}

export async function loadFriendLinks(uid: string): Promise<CommunityFriendLink[]> {
  const snapshot = await getDocs(query(collection(db(), "friendLinks"), where("members", "array-contains", uid)));
  return snapshot.docs.map((item) => ({ id: item.id, members: item.data().members as string[], requestedBy: item.data().requestedBy as string, status: item.data().status as CommunityFriendLink["status"] }));
}

export async function respondFriendRequest(id: string, status: "accepted" | "declined") {
  await updateDoc(doc(db(), "friendLinks", id), { status, updatedAt: serverTimestamp() });
}

export async function removeFriendLink(id: string) { await deleteDoc(doc(db(), "friendLinks", id)); }

export async function loadEventAttendees(eventId: string, visibleUids: string[]): Promise<EventAttendee[]> {
  const database = db();
  const snapshots = await Promise.all([...new Set(visibleUids)].map((uid) => getDoc(doc(database, "eventAttendance", encodeURIComponent(eventId), "attendees", uid))));
  return snapshots.filter((snapshot) => snapshot.exists()).map((snapshot) => ({ uid: snapshot.id, playId: String(snapshot.data().playId ?? ""), displayName: String(snapshot.data().displayName ?? "Joueur") }));
}

export async function setEventAttendance(user: User, eventId: string, attending: boolean) {
  const ref = doc(db(), "eventAttendance", encodeURIComponent(eventId), "attendees", user.uid);
  if (!attending) return deleteDoc(ref);
  const profile = await getCommunityProfile(user.uid);
  if (!profile?.playId) throw new Error("Ajoute ton identifiant Play! dans Compte avant de confirmer ta présence.");
  await setDoc(ref, { uid: user.uid, playId: profile.playId, displayName: profile.displayName, createdAt: serverTimestamp() });
}
