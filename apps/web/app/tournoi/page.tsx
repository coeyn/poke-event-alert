"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  formatDate,
  formatAdmission,
  loadUpcomingFrance,
  readFavorites,
  toggleFavorite,
  type PreviewEvent
} from "../../lib/preview";
import { Loading } from "../../components/Loading";
import { previewIcsFilename, previewIcsHref } from "../../lib/ics";
import { syncVenueFollow } from "../../lib/follows";
import { readBlockedVenues, setVenueBlocked } from "../../lib/blocked-venues";
import { EventTypeMark } from "../../components/EventTypeMark";

export default function TournamentPage() {
  const [event, setEvent] = useState<PreviewEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [followed, setFollowed] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [followError, setFollowError] = useState("");

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) {
      setLoading(false);
      return;
    }

    loadUpcomingFrance()
      .then((events) => {
        const found = events.find((item) => item.id === id) ?? null;
        setEvent(found);
        if (found) { setFollowed(readFavorites().includes(found.venueKey)); setBlocked(readBlockedVenues().some((venue) => venue.key === found.venueKey)); }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;

  if (!event) {
    return (
      <section className="detailCard">
        <span className="eyebrow">Tournoi</span>
        <h1>Événement introuvable</h1>
        <p className="mutedText">Il n'est peut-être plus présent dans la fenêtre actuelle de la preview.</p>
        <Link className="secondaryButton" href="/explorer/">← Retour aux événements</Link>
      </section>
    );
  }

  async function toggle() {
    setFollowError("");
    const nextFavorites = toggleFavorite(event!.venueKey);
    const nextFollowed = nextFavorites.includes(event!.venueKey);
    setFollowed(nextFollowed);

    try {
      await syncVenueFollow(
        {
          key: event!.venueKey,
          name: event!.venueName,
          leagueId: event!.leagueId,
          city: event!.city,
          countryCode: event!.countryCode
        },
        nextFollowed
      );
    } catch (error) {
      const rolledBack = toggleFavorite(event!.venueKey);
      setFollowed(rolledBack.includes(event!.venueKey));
      setFollowError(
        error instanceof Error
          ? error.message
          : "Impossible de synchroniser la boutique avec le serveur."
      );
    }
  }

  async function block() {
    if (!event) return;
    setFollowError("");
    const wasFollowed = followed;
    if (wasFollowed) { toggleFavorite(event.venueKey); setFollowed(false); }
    setVenueBlocked({ key: event.venueKey, name: event.venueName, city: event.city }, true);
    setBlocked(true);
    if (wasFollowed) {
      try {
        await syncVenueFollow({ key: event.venueKey, name: event.venueName, leagueId: event.leagueId, city: event.city, countryCode: event.countryCode }, false);
      } catch {
        setFollowError("Boutique masquée sur cet appareil. Le retrait des alertes n'a pas pu être synchronisé avec le serveur.");
      }
    }
  }

  return (
    <>
      <Link className="backLink" href="/explorer/">← Retour aux événements</Link>

      <section className="detailCard">
        <div className="eventDetailVisual"><EventTypeMark type={event.type} game={event.game} size="large" /><span>{event.type}</span></div>
        <div className="chips">
          <span className="chip">{event.game}</span>
        </div>

        <h1>{event.title === "Événement Play! Pokémon" ? event.venueName : event.title}</h1>
        <p className="detailDate">{formatDate(event.startsAt)}</p>

        <div className="detailGrid">
          <div className="detailBlock">
            <span>Boutique / Ligue</span>
            <strong>{event.venueName}</strong>
            {event.leagueId && <small>League #{event.leagueId}</small>}
          </div>

          <div className="detailBlock">
            <span>Lieu</span>
            <strong>{event.city || "France"}</strong>
            {event.address && <small>{event.address}</small>}
          </div>
          <div className="detailBlock">
            <span>PAF</span>
            <strong>{formatAdmission(event.admission) ?? "Non communiqué"}</strong>
          </div>
        </div>

        {followError && <div className="notice error">{followError}</div>}

        {blocked ? <div className="blockedNotice"><p>Cette boutique est bloquée. Ses événements sont masqués des listes et du calendrier.</p><button type="button" className="secondaryButton" onClick={() => { setVenueBlocked({ key: event.venueKey, name: event.venueName, city: event.city }, false); setBlocked(false); }}>Débloquer la boutique</button></div> : <button className={followed ? "primaryButton followedButton" : "primaryButton"} onClick={() => void toggle()}>
          {followed ? "★ Boutique suivie" : "☆ Suivre cette boutique"}
        </button>}
        {!blocked && <button type="button" className="blockDetailButton" onClick={() => void block()}>Bloquer cette boutique</button>}

        <a
          className="secondaryButton"
          href={previewIcsHref(event)}
          download={previewIcsFilename(event)}
        >
          ＋ Ajouter au calendrier
        </a>

        <div className="sourceNotice">
          <strong>À propos du lien officiel</strong>
          <p>Certains anciens liens Pokémon fournis avec les événements renvoient aujourd'hui vers une erreur. Poké Event Alert affiche donc le détail ici plutôt que de t'envoyer vers une page cassée.</p>
        </div>
      </section>
    </>
  );
}
