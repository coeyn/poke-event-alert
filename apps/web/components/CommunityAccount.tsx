"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { firebaseAuth, firebaseConfigured } from "../lib/firebase";
import { getCommunityProfile, loadFriendLinks, removeFriendLink, respondFriendRequest, saveCommunityProfile, sendFriendRequest, type CommunityFriendLink, type CommunityProfile } from "../lib/community";

export function CommunityAccount() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [playId, setPlayId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [friendId, setFriendId] = useState("");
  const [links, setLinks] = useState<CommunityFriendLink[]>([]);
  const [people, setPeople] = useState<Record<string, CommunityProfile>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!firebaseAuth) return;
    return onAuthStateChanged(firebaseAuth, (next) => {
      setUser(next);
      setProfile(null);
      setLinks([]);
      if (next) void refresh(next);
    });
  }, []);

  async function refresh(current = user) {
    if (!current) return;
    try {
      const [ownProfile, friendLinks] = await Promise.all([getCommunityProfile(current.uid), loadFriendLinks(current.uid)]);
      setProfile(ownProfile);
      setPlayId(ownProfile?.playId ?? "");
      setDisplayName(ownProfile?.displayName ?? current.displayName ?? "");
      setLinks(friendLinks);
      const ids = [...new Set(friendLinks.flatMap((link) => link.members.filter((id) => id !== current.uid)))];
      const entries = await Promise.all(ids.map(async (id) => [id, await getCommunityProfile(id)] as const));
      setPeople(Object.fromEntries(entries.filter((entry): entry is readonly [string, CommunityProfile] => entry[1] !== null)));
    } catch {
      setMessage("Impossible de charger les fonctions communautaires. Vérifie les règles Firestore.");
    }
  }

  async function saveProfile() {
    if (!user) return;
    setBusy(true); setMessage("");
    try { await saveCommunityProfile(user, playId, displayName); await refresh(user); setMessage("Profil Play! enregistré."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Enregistrement impossible."); }
    finally { setBusy(false); }
  }

  async function addFriend() {
    if (!user) return;
    setBusy(true); setMessage("");
    try { await sendFriendRequest(user, friendId); setFriendId(""); await refresh(user); setMessage("Demande d’ami envoyée."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Demande impossible."); }
    finally { setBusy(false); }
  }

  async function changeLink(link: CommunityFriendLink, status: "accepted" | "removed") {
    setBusy(true); setMessage("");
    try {
      if (status === "removed") await removeFriendLink(link.id);
      else await respondFriendRequest(link.id, status);
      await refresh();
    } catch { setMessage("Action impossible. Vérifie les règles Firestore."); }
    finally { setBusy(false); }
  }

  if (!firebaseConfigured) return null;
  if (!user) return <section className="settingsCard"><h2>Profil Play! et amis</h2><p className="settingHint">Connecte-toi pour enregistrer ton identifiant Play! et retrouver tes amis aux événements.</p></section>;

  return <section className="settingsCard communityCard">
    <h2>Profil Play! et amis</h2>
    <p className="settingHint">Ton identifiant permet à tes amis de te retrouver. Seuls ton pseudo et ton identifiant Play! sont partagés avec les joueurs connectés.</p>
    <label className="communityField">Pseudo public<input value={displayName} maxLength={80} onChange={(event) => setDisplayName(event.target.value)} placeholder="Le nom affiché à tes amis" autoComplete="nickname" /></label>
    <label className="communityField">Identifiant Play! Pokémon<input value={playId} maxLength={32} onChange={(event) => setPlayId(event.target.value)} placeholder="Ton identifiant joueur" autoComplete="off" /></label>
    <button className="secondaryButton" type="button" onClick={() => void saveProfile()} disabled={busy}>{profile?.playId === playId.trim() ? "Mettre à jour mon profil" : "Enregistrer mon identifiant"}</button>
    <div className="communityFriendForm"><label className="communityField">Ajouter un ami avec son identifiant Play!<input value={friendId} maxLength={32} onChange={(event) => setFriendId(event.target.value)} placeholder="Identifiant Play! de ton ami" autoComplete="off" /></label><button className="secondaryButton" type="button" onClick={() => void addFriend()} disabled={busy || !friendId.trim()}>Envoyer la demande</button></div>
    <div className="communityPeople">
      <h3>Amis et demandes</h3>
      {!links.length && <p className="settingHint">Aucun ami ou demande pour le moment.</p>}
      {links.map((link) => {
        const otherUid = link.members.find((id) => id !== user.uid)!;
        const person = people[otherUid];
        const incoming = link.status === "pending" && link.requestedBy !== user.uid;
        return <div className="communityPerson" key={link.id}><span><strong>{person?.displayName ?? "Joueur"}</strong><small>{person?.playId ? `Play! · ${person.playId}` : link.status === "pending" ? "Demande en attente" : "Identifiant non renseigné"}</small></span><div>{incoming ? <><button type="button" className="textButton" disabled={busy} onClick={() => void changeLink(link, "accepted")}>Accepter</button><button type="button" className="textButton" disabled={busy} onClick={() => void changeLink(link, "removed")}>Refuser</button></> : <button type="button" className="textButton" disabled={busy} onClick={() => void changeLink(link, "removed")}>{link.status === "pending" ? "Annuler" : "Retirer"}</button>}</div></div>;
      })}
    </div>
    {message && <p className="settingHint" role="status">{message}</p>}
  </section>;
}
