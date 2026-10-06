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
import { loadLiveVenueCounts } from "../lib/venue-counts";

type Mode = "discover" | "events" | "venues" | "favorites";

export function LiveData({ mode }: { mode: Mode }) {
  const [events, setEvents] = useState<PreviewEvent[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [liveCounts, setLiveCounts] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [followError, setFollowError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"events" | "venues">("events");
  const [visibleCount, setVisibleCount] = useState(40);
  const activeMode = mode === "discover" ? tab : mode;

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
        ),
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

  const favoriteVenues = useMemo(
    () => filteredVenues.filter((venue) => favorites.includes(venue.key)),
    [filteredVenues, favorites]
  );

  useEffect(() => {
    if (activeMode === "events" || venues.length === 0) return;

    const targets =
      activeMode === "favorites"
        ? favoriteVenues.slice(0, 100)
        : q
          ? filteredVenues.slice(0, 100)
          : [];

    if (targets.length === 0) return;

    let cancelled = false;
    const delay = activeMode === "venues" ? 300 : 0;
    const timer = window.setTimeout(() => {
      void loadLiveVenueCounts(targets)
        .then((counts) => {
          if (!cancelled) {
            setLiveCounts((current) => ({ ...current, ...counts }));
          }
        })
        .catch(() => {
          // Keep the CDN snapshot counts when the NAS/API is unavailable.
        });
    }, delay);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeMode, q, venues.length, filteredVenues, favoriteVenues]);

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

  const controls = mode === "discover" ? <>
    <label className="searchBox"><span aria-hidden="true">⌕</span><input aria-label="Rechercher un événement ou une boutique" value={query} onChange={(e) => { setQuery(e.target.value); setVisibleCount(40); }} placeholder="Événement, boutique, ville…" /></label>
    <div className="discoverTabs" role="tablist" aria-label="Résultats de recherche"><button type="button" role="tab" aria-selected={tab === "events"} className={tab === "events" ? "active" : ""} onClick={() => { setTab("events"); setVisibleCount(40); }}>Événements <span>{filteredEvents.length}</span></button><button type="button" role="tab" aria-selected={tab === "venues"} className={tab === "venues" ? "active" : ""} onClick={() => { setTab("venues"); setVisibleCount(40); }}>Boutiques <span>{filteredVenues.length}</span></button></div>
  </> : null;

  if (activeMode === "events") {
    return (
      <>
        {controls ?? <div className="searchBox">
          <span>⌕</span>
          <input value={query} onChange={(e) => { setQuery(e.target.value); setVisibleCount(40); }} placeholder="Boutique, ville, Challenge, Cup…" />
        </div>}
        <div className="sectionHead">
          <h2>Prochains événements</h2>
          <span>{filteredEvents.length}</span>
        </div>
        <div className="eventList">
          {filteredEvents.slice(0, visibleCount).map((event) => <EventCard key={event.id} event={event} />)}
        </div>
        {visibleCount < filteredEvents.length && <button className="loadMoreButton" type="button" onClick={() => setVisibleCount((count) => count + 40)}>Voir plus d'événements</button>}
        {filteredEvents.length === 0 && <div className="emptyState"><h3>Aucun événement trouvé</h3><p>Essaie une autre recherche.</p></div>}
      </>
    );
  }

  const list = activeMode === "favorites" ? favoriteVenues : filteredVenues;

  return (
    <>
      {controls}
      {mode === "venues" && (
        <div className="searchBox">
          <span>⌕</span>
          <input value={query} onChange={(e) => { setQuery(e.target.value); setVisibleCount(40); }} placeholder="Nom, ville ou League ID…" />
        </div>
      )}

      {followError && <div className="notice error">{followError}</div>}

      <div className="sectionHead">
        <h2>{activeMode === "favorites" ? "Mes boutiques" : "Boutiques avec des événements"}</h2>
        <span>{list.length}</span>
      </div>

      {activeMode === "favorites" && list.length === 0 && (
        <div className="emptyState">
          <div>★</div>
          <h3>Aucune boutique suivie</h3>
          <p>Va dans « Boutiques » et ajoute celles que tu veux surveiller.</p>
        </div>
      )}
      {activeMode === "venues" && list.length === 0 && <div className="emptyState"><h3>Aucune boutique trouvée</h3><p>Essaie un autre nom ou une autre ville.</p></div>}

      <div className="venueGrid">
        {(activeMode === "favorites" ? list : list.slice(0, visibleCount)).map((venue) => {
          const followed = favorites.includes(venue.key);
          const eventCount = liveCounts[venue.key] ?? venue.events.length;
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
                <strong>{eventCount}</strong>
                <span> événement{eventCount > 1 ? "s" : ""} à venir</span>
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
      {activeMode === "venues" && visibleCount < list.length && <button className="loadMoreButton" type="button" onClick={() => setVisibleCount((count) => count + 40)}>Voir plus de boutiques</button>}
    </>
  );
}

function formatShort(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit"
  }).format(new Date(value));
}
