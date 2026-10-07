import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const app = getApps()[0] ?? initializeApp({ credential: applicationDefault() });
const database = getFirestore(app);
const profiles = [];
let page = await database.collection("publicProfiles").orderBy("__name__").limit(500).get();
while (!page.empty) {
  for (const profile of page.docs) {
    const playId = String(profile.data().playId ?? "").trim();
    if (playId) profiles.push({ uid: profile.id, playId, normalized: playId.toLowerCase() });
  }
  if (page.size < 500) break;
  page = await database.collection("publicProfiles").orderBy("__name__").startAfter(page.docs.at(-1)).limit(500).get();
}

const byPlayId = new Map();
for (const profile of profiles) {
  if (!/^[a-z0-9_-]{3,32}$/.test(profile.normalized)) {
    throw new Error(`Un profil contient un identifiant Play! invalide (uid ${profile.uid}). Corrige-le avant la migration.`);
  }
  const owners = byPlayId.get(profile.normalized) ?? [];
  owners.push(profile.uid);
  byPlayId.set(profile.normalized, owners);
}
const conflicts = [...byPlayId.values()].filter((owners) => owners.length > 1);
if (conflicts.length) {
  const owners = conflicts.flat().join(", ");
  throw new Error(`Identifiants Play! en doublon détectés. Résous les profils concernés avant de publier les règles: ${owners}`);
}

let claimed = 0;
for (let offset = 0; offset < profiles.length; offset += 400) {
  const chunk = profiles.slice(offset, offset + 400);
  const refs = chunk.map((profile) => database.collection("playIdRegistry").doc(profile.normalized));
  const current = await database.getAll(...refs);
  const batch = database.batch();
  for (let index = 0; index < chunk.length; index += 1) {
    const profile = chunk[index];
    const reservation = current[index];
    if (reservation.exists && reservation.data()?.uid !== profile.uid) {
      throw new Error(`Une réservation existante contredit le profil uid ${profile.uid}. Corrige-la avant la migration.`);
    }
    if (!reservation.exists) {
      batch.create(refs[index], { uid: profile.uid, playId: profile.normalized });
      claimed += 1;
    }
  }
  await batch.commit();
}
console.log(`Registre Play! vérifié : ${profiles.length} profil(s), ${claimed} réservation(s) ajoutée(s).`);
