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
import { readBlockedVenues, setVenueBlocked } from "../lib/blocked-venues";

type Mode = "discover" | "events" | "venues" | "favorites";

export function LiveData({ mode, sectionTitle, showHeading = true }: { mode: Mode; sectionTitle?: string; showHeading?: boolean }) {
  const [events, setEvents] = useState<PreviewEvent[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [blockedKeys, setBlockedKeys] = useState<string[]>([]);
  const [liveCounts, setLiveCounts] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [followError, setFollowError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"events" | "venues">("events");
  const [visibleCount, setVisibleCount] = useState(40);
  const [eventType, setEventType] = useState("Tous");
  const [followedOnly, setFollowedOnly] = useState(false);
  const activeMode = mode === "discover" ? tab : mode;

  useEffect(() => {
    const refresh = () => { setFavorites(readFavorites()); setBlockedKeys(readBlockedVenues().map((venue) => venue.key)); };
    refresh();
    loadUpcomingFrance()
      .then(setEvents)
      .catch(() =>
        setError("Impossible de joindre les données d'événements. Réessaie un peu plus tard.")
      )
      .finally(() => setLoading(false));
    window.addEventListener("focus", refresh);
    window.addEventListener("poke-settings-changed", refresh);
    return () => { window.removeEventListener("focus", refresh); window.removeEventListener("poke-settings-changed", refresh); };
  }, []);

  const venues = useMemo(() => venuesFromEvents(events), [events]);

  useEffect(() => {
    if (venues.length === 0) return;
    const localKeys = readFavorites();
    void syncExistingLocalFollows(venues, localKeys.filter((key) => !readBlockedVenues().some((venue) => venue.key === key)));
  }, [venues]);

  const q = query.trim().toLowerCase();

  const filteredEvents = useMemo(
    () =>
      events
        .filter((event) =>
          !blockedKeys.includes(event.venueKey) &&
          (!q || [event.title, event.venueName, event.city, event.type, event.game]
            .join(" ")
            .toLowerCase()
            .includes(q)) &&
          (eventType === "Tous" || event.type === eventType) &&
          (!followedOnly || favorites.includes(event.venueKey))
        ),
    [events, q, eventType, followedOnly, favorites, blockedKeys]
  );

  const filteredVenues = useMemo(
    () =>
      venues.filter((venue) =>
        !blockedKeys.includes(venue.key) && (!q ||
        [venue.name, venue.city, venue.leagueId ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(q))
      ),
    [venues, q, blockedKeys]
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
      const detail = syncError instanceof Error ? ` (${syncError.message})` : "";
      setFollowError(
        `Boutique ${wasFollowed ? "retirée des favoris" : "ajoutée aux favoris"} sur cet appareil, mais la synchronisation serveur a échoué${detail}`
      );
    }
  }

  async function block(venue: PreviewVenue) {
    setFollowError("");
    const wasFollowed = favorites.includes(venue.key);
    if (wasFollowed) setFavorites(toggleFavorite(venue.key));
    setBlockedKeys(setVenueBlocked({ key: venue.key, name: venue.name, city: venue.city }, true).map((item) => item.key));
    if (wasFollowed) {
      try {
        await syncVenueFollow(venue, false);
      } catch {
        setFollowError(`La boutique ${venue.name} est masquée sur cet appareil, mais le retrait des alertes n'a pas pu être synchronisé. Réessaie quand le serveur est disponible.`);
      }
    }
  }

  if (loading) return <Loading />;
  if (error) return <div className="notice error">{error}</div>;

  const controls = mode === "discover" ? <div className="exploreTools">
    <label className="searchBox"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.2 4.2" /></svg><input aria-label="Rechercher un événement ou une boutique" value={query} onChange={(e) => { setQuery(e.target.value); setVisibleCount(40); }} placeholder="Événement, boutique, ville…" />{query && <button type="button" className="clearSearch" onClick={() => { setQuery(""); setVisibleCount(40); }} aria-label="Effacer la recherche">×</button>}</label>
    <div className="discoverTabs" role="tablist" aria-label="Résultats de recherche"><button type="button" role="tab" aria-selected={tab === "events"} className={tab === "events" ? "active" : ""} onClick={() => { setTab("events"); setVisibleCount(40); }}>Événements <span>{filteredEvents.length}</span></button><button type="button" role="tab" aria-selected={tab === "venues"} className={tab === "venues" ? "active" : ""} onClick={() => { setTab("venues"); setVisibleCount(40); }}>Boutiques <span>{filteredVenues.length}</span></button></div>
    {tab === "events" && <div className="filterBar" aria-label="Filtrer les événements">{["Tous", "Challenge", "Cup", "Avant-première", "Session Play", "Tournoi"].map((type) => <button key={type} type="button" className={eventType === type ? "filterChip active" : "filterChip"} aria-pressed={eventType === type} onClick={() => { setEventType(type); setVisibleCount(40); }}>{type}</button>)}<button type="button" className={followedOnly ? "filterChip favoriteFilter active" : "filterChip favoriteFilter"} aria-pressed={followedOnly} onClick={() => { setFollowedOnly((value) => !value); setVisibleCount(40); }}>★ Mes boutiques</button></div>}
  </div> : null;

  if (activeMode === "events") {
    return (
      <>
        {controls ?? <div className="searchBox">
          <span aria-hidden="true">⌕</span>
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
          <span aria-hidden="true">⌕</span>
          <input value={query} onChange={(e) => { setQuery(e.target.value); setVisibleCount(40); }} placeholder="Nom, ville ou League ID…" />
        </div>
      )}

      {followError && <div className="notice error">{followError}</div>}

      {showHeading && <div className="sectionHead">
        <h2>{sectionTitle ?? (activeMode === "favorites" ? "Mes boutiques" : "Boutiques avec des événements")}</h2>
        <span>{list.length}</span>
      </div>}

      {activeMode === "favorites" && list.length === 0 && (
        <div className="emptyState">
          <div>★</div>
          <h3>Aucune boutique suivie</h3>
          <p>Recherche une boutique dans Explorer, puis touche « Suivre ».</p>
          <Link className="secondaryButton" href="/explorer/">Explorer les boutiques →</Link>
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
                <button className={followed ? "starButton active" : "starButton"} onClick={() => void favorite(venue)} aria-label={followed ? `Ne plus suivre ${venue.name}` : `Suivre ${venue.name}`} aria-pressed={followed}><span aria-hidden="true">★</span> {followed ? "Suivie" : "Suivre"}</button>
              </div>
              <div className="venueMeta">{venue.leagueId && <span className="leagueId">League #{venue.leagueId}</span>}<span className="venueEvents"><strong>{eventCount}</strong> événement{eventCount > 1 ? "s" : ""} à venir</span></div>
              <div className="venueFoot">{venue.events[0] ? <span>Prochain · {venue.events[0].type} le {formatShort(venue.events[0].startsAt)}</span> : <span>Événements à venir</span>}<div className="venueFootActions"><button type="button" className="blockVenueButton" onClick={() => void block(venue)} aria-label={`Bloquer ${venue.name}`}>Bloquer</button><Link className="venueDetailLink" href={`/boutique/?key=${encodeURIComponent(venue.key)}`}>Voir la boutique <span aria-hidden="true">→</span></Link></div></div>
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
