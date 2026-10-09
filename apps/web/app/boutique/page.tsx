"use client";

import { useEffect, useState } from "react";
import { EventCard } from "../../components/EventCard";
import { Loading } from "../../components/Loading";
import { BackLink } from "../../components/BackLink";
import {
  loadUpcomingFrance,
  readFavorites,
  refreshVenueLive,
  toggleFavorite,
  venuesFromEvents,
  type PreviewVenue
} from "../../lib/preview";
import { syncVenueFollow } from "../../lib/follows";
import { readBlockedVenues, setVenueBlocked } from "../../lib/blocked-venues";

export default function BoutiquePage() {
  const [venue, setVenue] = useState<PreviewVenue | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followed, setFollowed] = useState(false);
  const [blocked, setBlocked] = useState(false);
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
        setLoading(false);

        if (!found) return;

        setFollowed(readFavorites().includes(found.key));
        setBlocked(readBlockedVenues().some((item) => item.key === found.key));
        setRefreshing(true);
        refreshVenueLive(found)
          .then((liveVenue) => setVenue(liveVenue))
          .catch(() => {
            // Keep the CDN snapshot if the NAS/API is unavailable.
          })
          .finally(() => setRefreshing(false));
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;

  if (!venue) {
    return (
      <section className="detailCard">
        <span className="eyebrow">Boutique</span>
        <h1>Boutique introuvable</h1>
        <p className="mutedText">Elle n'a peut-être aucun événement dans la fenêtre actuelle.</p>
        <BackLink className="secondaryButton" fallback="/boutiques/">← Retour</BackLink>
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
      const detail = error instanceof Error ? ` (${error.message})` : "";
      setFollowError(
        `Boutique ${nextFollowed ? "ajoutée aux favoris" : "retirée des favoris"} sur cet appareil, mais la synchronisation serveur a échoué${detail}`
      );
    }
  }

  async function block() {
    if (!venue) return;
    setFollowError("");
    const wasFollowed = followed;
    if (wasFollowed) { toggleFavorite(venue.key); setFollowed(false); }
    setVenueBlocked({ key: venue.key, name: venue.name, city: venue.city }, true);
    setBlocked(true);
    if (wasFollowed) {
      try {
        await syncVenueFollow(venue, false);
      } catch {
        setFollowError("Boutique masquée sur cet appareil. Le retrait des alertes n'a pas pu être synchronisé avec le serveur.");
      }
    }
  }

  return (
    <>
      <BackLink fallback="/boutiques/">← Retour</BackLink>

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

        {blocked ? <div className="blockedNotice"><p>Cette boutique est bloquée et ses événements sont masqués de ton accueil, d’Explorer et du calendrier.</p><button type="button" className="secondaryButton" onClick={() => { setVenueBlocked({ key: venue.key, name: venue.name, city: venue.city }, false); setBlocked(false); }}>Débloquer la boutique</button></div> : <><button className={followed ? "primaryButton followedButton" : "primaryButton"} onClick={() => void toggle()}>
          {followed ? "★ Boutique suivie" : "☆ Suivre cette boutique"}
        </button><button type="button" className="blockDetailButton" onClick={() => void block()}>Bloquer cette boutique</button></>}
      </section>

      {!blocked && <><div className="sectionHead detailEventsHead">
        <h2>Prochains événements</h2>
        <span>{refreshing ? "↻" : venue.events.length}</span>
      </div>

      <div className="eventList">
        {venue.events.map((event) => <EventCard key={event.id} event={event} />)}
      </div>
      </>}
    </>
  );
}
