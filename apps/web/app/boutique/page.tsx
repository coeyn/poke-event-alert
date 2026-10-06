"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EventCard } from "../../components/EventCard";
import { Loading } from "../../components/Loading";
import {
  loadUpcomingFrance,
  readFavorites,
  toggleFavorite,
  venuesFromEvents,
  type PreviewVenue
} from "../../lib/preview";
import { syncVenueFollow } from "../../lib/follows";

export default function BoutiquePage() {
  const [venue, setVenue] = useState<PreviewVenue | null>(null);
  const [loading, setLoading] = useState(true);
  const [followed, setFollowed] = useState(false);
  const [followError, setFollowError] = useState("");

  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get("key");
    if (!key) {
      setLoading(false);
      return;
    }

    loadUpcomingFrance()
      .then((events) => {
        const found = venuesFromEvents(events).find((item) => item.key === key) ?? null;
        setVenue(found);
        if (found) setFollowed(readFavorites().includes(found.key));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;

  if (!venue) {
    return (
      <section className="detailCard">
        <span className="eyebrow">Boutique</span>
        <h1>Boutique introuvable</h1>
        <p className="mutedText">Elle n'a peut-être aucun événement dans la fenêtre actuelle.</p>
        <Link className="secondaryButton" href="/boutiques/">← Retour aux boutiques</Link>
      </section>
    );
  }

  async function toggle() {
    setFollowError("");
    const nextFavorites = toggleFavorite(venue!.key);
    const nextFollowed = nextFavorites.includes(venue!.key);
    setFollowed(nextFollowed);

    try {
      await syncVenueFollow(venue!, nextFollowed);
    } catch (error) {
      const rolledBack = toggleFavorite(venue!.key);
      setFollowed(rolledBack.includes(venue!.key));
      setFollowError(
        error instanceof Error
          ? error.message
          : "Impossible de synchroniser la boutique avec le serveur."
      );
    }
  }

  return (
    <>
      <Link className="backLink" href="/boutiques/">← Retour aux boutiques</Link>

      <section className="detailCard venueDetail">
        <span className="eyebrow">Boutique / Ligue</span>
        <h1>{venue.name}</h1>
        <p className="detailDate">{venue.city || venue.address || "France"}</p>

        <div className="detailGrid">
          <div className="detailBlock">
            <span>League ID</span>
            <strong>{venue.leagueId ? `#${venue.leagueId}` : "Non renseigné"}</strong>
          </div>
          <div className="detailBlock">
            <span>Adresse</span>
            <strong>{venue.address || venue.city || "Non renseignée"}</strong>
          </div>
        </div>

        {followError && <div className="notice error">{followError}</div>}

        <button className={followed ? "primaryButton followedButton" : "primaryButton"} onClick={() => void toggle()}>
          {followed ? "★ Boutique suivie" : "☆ Suivre cette boutique"}
        </button>
      </section>

      <div className="sectionHead detailEventsHead">
        <h2>Prochains événements</h2>
        <span>{venue.events.length}</span>
      </div>

      <div className="eventList">
        {venue.events.map((event) => <EventCard key={event.id} event={event} />)}
      </div>
    </>
  );
}
