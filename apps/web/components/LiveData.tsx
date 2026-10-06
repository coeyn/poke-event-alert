"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EventCard } from "./EventCard";
import { Loading } from "./Loading";
import {
  loadUpcomingFrance,
  readFavorites,
  toggleFavorite,
  venuesFromEvents,
  type PreviewEvent,
  type PreviewVenue
} from "../lib/preview";
import {
  syncExistingLocalFollows,
  syncVenueFollow
} from "../lib/follows";

type Mode = "events" | "venues" | "favorites";

export function LiveData({ mode }: { mode: Mode }) {
  const [events, setEvents] = useState<PreviewEvent[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [followError, setFollowError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setFavorites(readFavorites());
    loadUpcomingFrance()
      .then(setEvents)
      .catch(() =>
        setError("Impossible de joindre les données d'événements. Réessaie un peu plus tard.")
      )
      .finally(() => setLoading(false));
  }, []);

  const venues = useMemo(() => venuesFromEvents(events), [events]);

  useEffect(() => {
    if (venues.length === 0) return;
    const localKeys = readFavorites();
    void syncExistingLocalFollows(venues, localKeys);
  }, [venues]);

  const q = query.trim().toLowerCase();

  const filteredEvents = useMemo(
    () =>
      events
        .filter((event) =>
          !q ||
          [event.title, event.venueName, event.city, event.type, event.game]
            .join(" ")
            .toLowerCase()
            .includes(q)
        )
        .slice(0, 80),
    [events, q]
  );

  const filteredVenues = useMemo(
    () =>
      venues.filter((venue) =>
        !q ||
        [venue.name, venue.city, venue.leagueId ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(q)
      ),
    [venues, q]
  );

  const favoriteVenues = filteredVenues.filter((venue) => favorites.includes(venue.key));

  async function favorite(venue: PreviewVenue) {
    setFollowError("");
    const wasFollowed = favorites.includes(venue.key);
    setFavorites(toggleFavorite(venue.key));

    try {
      await syncVenueFollow(venue, !wasFollowed);
    } catch (syncError) {
      setFavorites(toggleFavorite(venue.key));
      setFollowError(
        syncError instanceof Error
          ? syncError.message
          : "Impossible de synchroniser cette boutique avec le serveur."
      );
    }
  }

  if (loading) return <Loading />;
  if (error) return <div className="notice error">{error}</div>;

  if (mode === "events") {
    return (
      <>
        <div className="searchBox">
          <span>⌕</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Boutique, ville, Challenge, Cup…" />
        </div>
        <div className="sectionHead">
          <h2>Prochains événements</h2>
          <span>{filteredEvents.length}{events.length > 80 && !q ? "+" : ""}</span>
        </div>
        <div className="eventList">
          {filteredEvents.map((event) => <EventCard key={event.id} event={event} />)}
        </div>
      </>
    );
  }

  const list = mode === "favorites" ? favoriteVenues : filteredVenues;

  return (
    <>
      {mode === "venues" && (
        <div className="searchBox">
          <span>⌕</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nom, ville ou League ID…" />
        </div>
      )}

      {followError && <div className="notice error">{followError}</div>}

      <div className="sectionHead">
        <h2>{mode === "favorites" ? "Mes boutiques" : "Boutiques avec des events"}</h2>
        <span>{list.length}</span>
      </div>

      {mode === "favorites" && list.length === 0 && (
        <div className="emptyState">
          <div>★</div>
          <h3>Aucune boutique suivie</h3>
          <p>Va dans « Boutiques » et ajoute celles que tu veux surveiller.</p>
        </div>
      )}

      <div className="venueGrid">
        {list.map((venue) => {
          const followed = favorites.includes(venue.key);
          return (
            <article className="venueCard" key={venue.key}>
              <div className="venueTop">
                <div>
                  <h3>{venue.name}</h3>
                  <p>{venue.city || venue.address || "France"}</p>
                </div>
                <button
                  className={followed ? "starButton active" : "starButton"}
                  onClick={() => void favorite(venue)}
                  aria-label={followed ? "Ne plus suivre" : "Suivre"}
                >
                  ★
                </button>
              </div>
              {venue.leagueId && <div className="leagueId">League #{venue.leagueId}</div>}
              <Link className="venueDetailLink" href={`/boutique/?key=${encodeURIComponent(venue.key)}`}>
                Voir la boutique →
              </Link>
              <div className="venueEvents">
                <strong>{venue.events.length}</strong>
                <span> événement{venue.events.length > 1 ? "s" : ""} à venir</span>
              </div>
              <div className="miniEvents">
                {venue.events.slice(0, 3).map((event) => (
                  <Link key={event.id} href={`/tournoi/?id=${encodeURIComponent(event.id)}`}>
                    <span>{event.type}</span>
                    <b>{formatShort(event.startsAt)}</b>
                  </Link>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function formatShort(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit"
  }).format(new Date(value));
}
