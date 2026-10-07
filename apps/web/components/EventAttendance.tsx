"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { firebaseAuth, firebaseConfigured } from "../lib/firebase";
import { getCommunityProfile, loadEventAttendees, loadFriendLinks, setEventAttendance, type EventAttendee } from "../lib/community";

export function EventAttendance({ eventId }: { eventId: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [hasPlayId, setHasPlayId] = useState(false);
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [attending, setAttending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async (current: User) => {
    const [profile, links] = await Promise.all([getCommunityProfile(current.uid), loadFriendLinks(current.uid)]);
    setHasPlayId(Boolean(profile?.playId));
    const visibleUids = [current.uid, ...links.filter((link) => link.status === "accepted").flatMap((link) => link.members.filter((id) => id !== current.uid))];
    const list = await loadEventAttendees(eventId, [...new Set(visibleUids)]);
    setAttendees(list);
    setAttending(list.some((attendee) => attendee.uid === current.uid));
  }, [eventId]);

  useEffect(() => {
    if (!firebaseAuth) return;
    return onAuthStateChanged(firebaseAuth, (next) => {
      setUser(next);
      if (!next) { setAttendees([]); setAttending(false); return; }
      void refresh(next).catch(() => setMessage("Impossible de charger les présences. Vérifie les règles Firestore."));
    });
  }, [refresh]);

  async function toggleAttendance() {
    if (!user) return;
    setBusy(true); setMessage("");
    try { await setEventAttendance(user, eventId, !attending); await refresh(user); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Impossible de modifier ta présence."); }
    finally { setBusy(false); }
  }

  return <section className="attendanceCard">
    <div className="attendanceHeader"><div><h2>Qui vient ?</h2><p>{attendees.length ? `${attendees.length} joueur${attendees.length > 1 ? "s" : ""} parmi toi et tes amis` : "Retrouve tes amis à cet événement."}</p></div><span className="attendanceCount">{attendees.length}</span></div>
    {!firebaseConfigured ? <p className="settingHint">La connexion Firebase est nécessaire pour gérer les présences.</p> : !user ? <p className="settingHint">Connecte-toi dans <Link href="/mes-boutiques/">Compte</Link> pour indiquer ta présence et voir celle de tes amis.</p> : <>
      {hasPlayId ? <button className={attending ? "attendanceButton attending" : "attendanceButton"} type="button" onClick={() => void toggleAttendance()} disabled={busy}>{busy ? "Mise à jour…" : attending ? "✓ Tu viens · Annuler" : "Je viens à cet événement"}</button> : <p className="settingHint">Ajoute d’abord ton identifiant Play! dans <Link href="/mes-boutiques/">Compte</Link> pour confirmer ta présence.</p>}
      {attendees.length > 0 && <div className="attendeeList">{attendees.map((attendee) => <div className="attendeeRow" key={attendee.uid}><span className="attendeeAvatar" aria-hidden="true">{attendee.displayName.slice(0, 1).toUpperCase()}</span><span><strong>{attendee.displayName}{attendee.uid === user.uid ? " (toi)" : ""}</strong><small>Play! · {attendee.playId}</small></span></div>)}</div>}
    </>}
    {message && <p className="settingHint" role="status">{message}</p>}
  </section>;
}
