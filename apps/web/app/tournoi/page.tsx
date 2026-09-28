"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  formatDate,
  loadUpcomingFrance,
  readFavorites,
  toggleFavorite,
  type PreviewEvent
} from "../../lib/preview";
import { Loading } from "../../components/Loading";

export default function TournamentPage() {
  const [event, setEvent] = useState<PreviewEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [followed, setFollowed] = useState(false);

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
        if (found) setFollowed(readFavorites().includes(found.venueKey));
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
        <Link className="secondaryButton" href="/">← Retour aux événements</Link>
      </section>
    );
  }

  function toggle() {
    const favorites = toggleFavorite(event!.venueKey);
    setFollowed(favorites.includes(event!.venueKey));
  }

  return (
    <>
      <Link className="backLink" href="/">← Retour aux événements</Link>

      <section className="detailCard">
        <div className="chips">
          <span className="chip">{event.game}</span>
          <span className="chip soft">{event.type}</span>
        </div>

        <h1>{event.title}</h1>
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
        </div>

        <button className={followed ? "primaryButton followedButton" : "primaryButton"} onClick={toggle}>
          {followed ? "★ Boutique suivie" : "☆ Suivre cette boutique"}
        </button>

        <div className="sourceNotice">
          <strong>À propos du lien officiel</strong>
          <p>Certains anciens liens Pokémon fournis avec les événements renvoient aujourd'hui vers une erreur. Poké Event Alert affiche donc le détail ici plutôt que de t'envoyer vers une page cassée.</p>
        </div>
      </section>
    </>
  );
}
