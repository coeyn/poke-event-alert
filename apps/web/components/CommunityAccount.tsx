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
  const [profileMessage, setProfileMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseAuth) return;
    return onAuthStateChanged(firebaseAuth, (next) => {
      setUser(next);
      setProfile(null);
      setLinks([]);
      if (next) void refresh(next);
      else setLoading(false);
    });
  }, []);

  async function refresh(current = user) {
    if (!current) return;
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile() {
    if (!user) return;
    setBusy(true); setProfileMessage("");
    try { await saveCommunityProfile(user, playId, displayName); await refresh(user); setProfileMessage("Profil joueur enregistré."); }
    catch (error) { setProfileMessage(error instanceof Error ? error.message : "Enregistrement impossible."); }
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
  if (!user) return <section className="communityPanel communitySignIn"><span className="communityEyebrow">Communauté</span><h2>Profil joueur et amis</h2><p>Connecte-toi pour renseigner ton identifiant Play!, ajouter tes amis et voir les joueurs présents aux événements.</p></section>;

  const incomingRequests = links.filter((link) => link.status === "pending" && link.requestedBy !== user.uid);
  const outgoingRequests = links.filter((link) => link.status === "pending" && link.requestedBy === user.uid);
  const friends = links.filter((link) => link.status === "accepted");
  const profileChanged = Boolean(profile) && (profile?.playId !== playId.trim() || profile?.displayName !== displayName.trim());

  return <div className="communityWorkspace">
    <section className="communityPanel profilePanel">
      <div className="communityPanelHead"><span className="communityPanelIcon" aria-hidden="true">♙</span><div><span className="communityEyebrow">Ton espace joueur</span><h2>Mon profil Play!</h2></div></div>
      <p className="communityDescription">Ces informations permettent à tes amis de te retrouver. Seuls ton pseudo et ton identifiant Play! sont visibles par les joueurs connectés.</p>
      <div className="communityProfileGrid">
        <label className="communityField">Pseudo public<input value={displayName} maxLength={80} onChange={(event) => setDisplayName(event.target.value)} placeholder="Ex. Coeyn" autoComplete="nickname" /></label>
        <label className="communityField">Identifiant joueur<input value={playId} maxLength={32} onChange={(event) => setPlayId(event.target.value)} placeholder="Ton identifiant Play! Pokémon" autoComplete="off" /></label>
      </div>
      <div className="communityProfileFoot"><span className={profile?.playId ? "profileSaved" : "profileIncomplete"}>{profile?.playId ? `Profil actif · ${profile.playId}` : "Identifiant à renseigner"}</span><button className="secondaryButton" type="button" onClick={() => void saveProfile()} disabled={busy || (!profileChanged && Boolean(profile))}>{busy ? "Enregistrement…" : profile ? "Enregistrer les modifications" : "Créer mon profil joueur"}</button></div>
      {profileMessage && <p className="communityMessage" role="status">{profileMessage}</p>}
    </section>

    <section className="communityPanel friendsPanel">
      <div className="communitySectionHead"><div><span className="communityEyebrow">Retrouve ton groupe</span><h2>Mes amis</h2></div><span className="friendCount">{friends.length}</span></div>
      <p className="communityDescription">Ajoute un joueur avec son identifiant Play! pour voir s’il vient aux mêmes événements que toi.</p>
      <form className="friendSearchForm" onSubmit={(event) => { event.preventDefault(); void addFriend(); }}>
        <label className="communityField"><span>Identifiant Play! de ton ami</span><input value={friendId} maxLength={32} onChange={(event) => setFriendId(event.target.value)} placeholder="Saisis son identifiant" autoComplete="off" /></label>
        <button className="primaryButton" type="submit" disabled={busy || !friendId.trim()}>Ajouter</button>
      </form>

      {loading ? <p className="communityEmpty">Chargement de tes amis…</p> : <>
        {incomingRequests.length > 0 && <div className="friendGroup"><h3>Demandes reçues <span>{incomingRequests.length}</span></h3>{incomingRequests.map((link) => <FriendRow key={link.id} link={link} userId={user.uid} person={people[link.members.find((id) => id !== user.uid)!]} busy={busy} onAction={changeLink} />)}</div>}
        {friends.length > 0 && <div className="friendGroup"><h3>Amis <span>{friends.length}</span></h3>{friends.map((link) => <FriendRow key={link.id} link={link} userId={user.uid} person={people[link.members.find((id) => id !== user.uid)!]} busy={busy} onAction={changeLink} />)}</div>}
        {outgoingRequests.length > 0 && <div className="friendGroup"><h3>Demandes envoyées <span>{outgoingRequests.length}</span></h3>{outgoingRequests.map((link) => <FriendRow key={link.id} link={link} userId={user.uid} person={people[link.members.find((id) => id !== user.uid)!]} busy={busy} onAction={changeLink} />)}</div>}
        {!links.length && <div className="communityEmpty"><span aria-hidden="true">＋</span><strong>Ton groupe commence ici</strong><p>Ajoute tes amis pour repérer les événements auxquels vous participez ensemble.</p></div>}
      </>}
      {message && <p className="communityMessage" role="status">{message}</p>}
    </section>
  </div>;
}

function FriendRow({ link, userId, person, busy, onAction }: { link: CommunityFriendLink; userId: string; person?: CommunityProfile; busy: boolean; onAction: (link: CommunityFriendLink, status: "accepted" | "removed") => void }) {
  const incoming = link.status === "pending" && link.requestedBy !== userId;
  return <div className="friendRow"><span className="friendAvatar" aria-hidden="true">{(person?.displayName ?? "J").slice(0, 1).toUpperCase()}</span><span className="friendIdentity"><strong>{person?.displayName ?? "Joueur Play!"}</strong><small>{person?.playId ? `ID Play! · ${person.playId}` : "Identifiant non renseigné"}</small></span>{link.status === "accepted" ? <button type="button" className="friendRemove" disabled={busy} onClick={() => onAction(link, "removed")}>Retirer</button> : incoming ? <div className="friendActions"><button type="button" className="friendAccept" disabled={busy} onClick={() => onAction(link, "accepted")}>Accepter</button><button type="button" className="friendRemove" disabled={busy} onClick={() => onAction(link, "removed")}>Refuser</button></div> : <><span className="friendPending">En attente</span><button type="button" className="friendRemove" disabled={busy} onClick={() => onAction(link, "removed")}>Annuler</button></> }</div>;
}
