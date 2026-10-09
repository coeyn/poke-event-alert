"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Loading } from "./Loading";
import { EventTypeMark } from "./EventTypeMark";
import {
  formatAdmission,
  loadUpcomingSnapshot,
  readFavorites,
  toggleFavorite,
  venuesFromEvents,
  type PreviewEvent,
  type PreviewVenue
} from "../lib/preview";
import { DEFAULT_SETTINGS, isPersonalEvent, matchesEventType, readLocalSettings, type LocalSettings } from "../lib/local-settings";
import { eventCategory } from "../lib/event-category";
import { readBlockedVenues } from "../lib/blocked-venues";
import { syncVenueFollow } from "../lib/follows";

const FEATURED_VENUE_KEY = "poke-event-alert:featured-venue";
const RECENT_DAYS = 7;
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const UPCOMING_CATEGORY_PRIORITY = ["cup", "challenge", "prerelease", "session"] as const;

function recentCutoff() {
  const date = new Date();
  date.setDate(date.getDate() - RECENT_DAYS);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function displayTitle(event: PreviewEvent) {
  return event.title === "Événement Play! Pokémon" ? event.venueName : event.title;
}

function eventDate(event: PreviewEvent) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(event.allDay ? {} : { hour: "2-digit", minute: "2-digit" })
  }).format(new Date(event.startsAt));
}

function pokemonArtwork(event: PreviewEvent) {
  const game = event.game.toUpperCase();
  if (game === "VGC") return "lucario";
  if (game === "GO") return "pikachu";
  if (game === "JCC") return event.type === "Avant-première" ? "mew" : "gengar";
  return "pikachu";
}

function eventDayLabel(event: PreviewEvent) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const eventDay = new Date(event.startsAt);
  const sameDay = (left: Date, right: Date) => left.toDateString() === right.toDateString();
  if (sameDay(eventDay, today)) return "Aujourd’hui";
  if (sameDay(eventDay, tomorrow)) return "Demain";
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(eventDay);
}

function eventPrice(event: PreviewEvent) {
  const admission = event.admission?.trim().toLocaleLowerCase("fr-FR") ?? "";
  if (/^(gratuit|free)$/.test(admission)) return 0;
  const amount = admission.match(/\d+(?:[.,]\d+)?/);
  return amount ? Number(amount[0].replace(",", ".")) : Number.POSITIVE_INFINITY;
}

function ShopIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 10v10h16V10M3 10l2-6h14l2 6M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M9 20v-6h6v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function BrandMark() {
  return <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <circle cx="24" cy="24" r="21" fill="#F8FBFF" stroke="#1769D2" strokeWidth="2.5" />
    <path d="M4.4 19.5h39.2a21 21 0 0 1 0 9H4.4a21 21 0 0 1 0-9Z" fill="#14243D" />
    <path d="M5.3 19.5A21 21 0 0 1 42.7 19.5H5.3Z" fill="#E33C4C" />
    <circle cx="24" cy="24" r="6.5" fill="#F8FBFF" stroke="#14243D" strokeWidth="2.5" />
    <circle cx="24" cy="24" r="2.5" fill="#1769D2" />
  </svg>;
}

export function HomeDashboard() {
  const [events, setEvents] = useState<PreviewEvent[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [blockedKeys, setBlockedKeys] = useState<string[]>([]);
  const [settings, setSettings] = useState<LocalSettings | null>(null);
  const [featuredKey, setFeaturedKey] = useState("");
  const [followError, setFollowError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const refresh = () => {
      setFavorites(readFavorites());
      setBlockedKeys(readBlockedVenues().map((venue) => venue.key));
      setSettings(readLocalSettings());
      setFeaturedKey(localStorage.getItem(FEATURED_VENUE_KEY) ?? "");
    };
    refresh();
    loadUpcomingSnapshot()
      .then((snapshot) => setEvents(snapshot.events))
      .catch(() => setError("Impossible de charger les événements pour le moment."))
      .finally(() => setLoading(false));
    window.addEventListener("focus", refresh);
    window.addEventListener("poke-settings-changed", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("poke-settings-changed", refresh);
    };
  }, []);

  const visibleEvents = useMemo(
    () => events.filter((event) => !blockedKeys.includes(event.venueKey)),
    [events, blockedKeys]
  );
  const venues = useMemo(() => venuesFromEvents(visibleEvents), [visibleEvents]);
  const upcomingEvents = useMemo(() => {
    const hasDiscoveryArea = Boolean(settings?.location && settings.discoveryRadiusKm > 0);
    const eligible = visibleEvents.filter((event) =>
      (!settings || matchesEventType(event.type, settings)) &&
      (!hasDiscoveryArea || isPersonalEvent(event, favorites, settings ?? DEFAULT_SETTINGS))
    );
    return UPCOMING_CATEGORY_PRIORITY.flatMap((category) => {
      const candidates = eligible
        .filter((event) => {
          const type = eventCategory(event.type);
          return category === "session" ? type === "session" || type === "friendly" : type === category;
        })
      const personalCandidates = candidates.filter((event) => isPersonalEvent(event, favorites, settings ?? DEFAULT_SETTINGS));
      const preferred = personalCandidates.length ? personalCandidates : candidates;
      preferred.sort((a, b) => eventPrice(a) - eventPrice(b) || a.startsAt.localeCompare(b.startsAt));
      return preferred.slice(0, 1);
    });
  }, [visibleEvents, settings, favorites]);
  const shops = useMemo(
    () => favorites
      .map((key) => venues.find((venue) => venue.key === key))
      .filter((venue): venue is PreviewVenue => Boolean(venue)),
    [favorites, venues]
  );
  const featuredVenue = venues.find((venue) => venue.key === featuredKey)
    ?? shops[0]
    ?? venues[0]
    ?? null;

  useEffect(() => {
    if (!venues.length || venues.some((venue) => venue.key === featuredKey)) return;
    const initial = venues.find((venue) => favorites.includes(venue.key)) ?? venues[0];
    setFeaturedKey(initial.key);
    localStorage.setItem(FEATURED_VENUE_KEY, initial.key);
  }, [venues, favorites, featuredKey]);

  const recentFeaturedEvents = useMemo(() => {
    if (!featuredVenue) return [];
    const cutoff = recentCutoff();
    return featuredVenue.events
      .filter((event) => event.publishedAt && event.publishedAt.slice(0, 10) >= cutoff)
      .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
      .slice(0, 3);
  }, [featuredVenue]);

  const hasRecentEvents = (venue: PreviewVenue) => {
    const cutoff = recentCutoff();
    return venue.events.some((event) => event.publishedAt && event.publishedAt.slice(0, 10) >= cutoff);
  };

  function changeFeaturedVenue() {
    if (!venues.length) return;
    const index = venues.findIndex((venue) => venue.key === featuredVenue?.key);
    const next = venues[(index + 1) % venues.length];
    setFeaturedKey(next.key);
    localStorage.setItem(FEATURED_VENUE_KEY, next.key);
  }

  async function toggleFeaturedFollow(venue: PreviewVenue) {
    setFollowError("");
    const wasFollowed = favorites.includes(venue.key);
    const next = toggleFavorite(venue.key);
    setFavorites(next);
    try {
      await syncVenueFollow(venue, !wasFollowed);
    } catch (followFailure) {
      const detail = followFailure instanceof Error ? ` (${followFailure.message})` : "";
      setFollowError(`Boutique ${wasFollowed ? "retirée des favoris" : "ajoutée aux favoris"} sur cet appareil, mais la synchronisation serveur a échoué${detail}`);
    }
  }

  if (loading) return <Loading />;
  if (error) return <div className="notice error">{error}</div>;

  return <div className="homeDashboard">
    <header className="homeBrand" aria-label="Poké Event Alert">
      <span className="homeBrandMark"><BrandMark /></span>
      <span className="homeBrandText"><h1>Poké <em>Event</em> Alert</h1><small>Les événements Play! Pokémon près de chez toi</small></span>
      <span className="homeBrandSignal" aria-hidden="true"><i /></span>
    </header>

    <section className="homeSection homeFollowed" aria-labelledby="home-followed-heading">
      <div className="sectionHead"><h2 id="home-followed-heading">Boutiques suivies</h2><Link className="sectionLink" href="/mes-boutiques/">Tout voir →</Link></div>
      {shops.length ? <div className="followedShopList">
        {shops.slice(0, 6).map((venue) => <Link className="followedShop" key={venue.key} href={`/boutique/?key=${encodeURIComponent(venue.key)}`}>
          <span className="followedShopIcon"><ShopIcon /></span>
          <span className="followedShopName"><strong>{venue.name}</strong><small>{venue.city || "France"}</small></span>
          {hasRecentEvents(venue) && <span className="venueNewDot" role="img" aria-label="Nouveaux événements ajoutés cette semaine" title="Nouveaux événements cette semaine" />}
          <span className="followedShopArrow" aria-hidden="true">›</span>
        </Link>)}
      </div> : <div className="homeEmptyFollow"><span>Tu ne suis pas encore de boutique.</span><Link href="/boutiques/">Découvrir les boutiques →</Link></div>}
    </section>

    <section className="homeSection homeUpcoming" aria-labelledby="home-upcoming-heading">
      <div className="sectionHead"><h2 id="home-upcoming-heading">À venir</h2><Link className="sectionLink" href="/calendrier/">Calendrier →</Link></div>
      {upcomingEvents.length ? <div className="homeUpcomingGrid">
        {upcomingEvents.map((event, index) => <Link className="homeEventCard" key={event.id} href={`/tournoi/?id=${encodeURIComponent(event.id)}`}>
          <span className="homeEventArtwork">
            <Image src={`${BASE_PATH}/pokemon/${pokemonArtwork(event)}.png`} alt="" width={480} height={240} unoptimized loading={index === 0 ? "eager" : "lazy"} />
            <span className="homeEventDay">{eventDayLabel(event)}</span>
          </span>
          <span className="homeEventTop"><span className="homeEventType">{event.type} · {event.game}</span><EventTypeMark type={event.type} game={event.game} size="small" /></span>
          <strong className="homeEventTitle">{displayTitle(event)}</strong>
          <span className="homeEventDate">{eventDate(event)}</span>
          <span className="homeEventVenue">{event.venueName} · {event.city || "France"}</span>
          {formatAdmission(event.admission) && <span className="homeEventPrice">{formatAdmission(event.admission)}</span>}
        </Link>)}
      </div> : <div className="homeEmptyFollow"><span>Aucun événement à venir dans les données.</span><Link href="/explorer/">Explorer les événements →</Link></div>}
    </section>

    <section className="homeSection homeSpotlight" aria-labelledby="home-spotlight-heading">
      <div className="sectionHead"><h2 id="home-spotlight-heading">Boutique mise en avant</h2>{venues.length > 1 && <button className="spotlightChange" type="button" onClick={changeFeaturedVenue}>Changer ↻</button>}</div>
      {featuredVenue ? <div className="spotlightCard">
        <div className="spotlightShopHead">
          <span className="spotlightShopIcon"><ShopIcon /></span>
          <div className="spotlightShopIdentity"><span className="spotlightEyebrow">À découvrir · Play! Pokémon</span><h3>{featuredVenue.name}</h3><p>{[featuredVenue.address, featuredVenue.city].filter(Boolean).join(" · ") || "Adresse non renseignée"}</p></div>
          <button className={favorites.includes(featuredVenue.key) ? "spotlightFollow followed" : "spotlightFollow"} type="button" onClick={() => void toggleFeaturedFollow(featuredVenue)}>{favorites.includes(featuredVenue.key) ? "✓ Suivie" : "+ Suivre"}</button>
        </div>
        {followError && <p className="spotlightError" role="status">{followError}</p>}
        <div className="spotlightEventsHead"><strong>Événements récents</strong><Link href={`/boutique/?key=${encodeURIComponent(featuredVenue.key)}`}>Voir la boutique →</Link></div>
        {recentFeaturedEvents.length ? <div className="spotlightEventList">
          {recentFeaturedEvents.map((event) => <Link className="spotlightEvent" key={event.id} href={`/tournoi/?id=${encodeURIComponent(event.id)}`}>
            <EventTypeMark type={event.type} game={event.game} size="small" />
            <span className="spotlightEventCopy"><strong>{displayTitle(event)}</strong><small>{event.type} · {eventDate(event)}</small></span>
            {formatAdmission(event.admission) && <span className="homeEventPrice">{formatAdmission(event.admission)}</span>}
            <span className="spotlightEventArrow" aria-hidden="true">›</span>
          </Link>)}
        </div> : <p className="spotlightNoEvents">Pas de nouvel événement publié cette semaine. <Link href={`/boutique/?key=${encodeURIComponent(featuredVenue.key)}`}>Voir tous les événements</Link></p>}
      </div> : <div className="homeEmptyFollow"><span>Aucune boutique disponible pour le moment.</span><Link href="/boutiques/">Trouver une boutique →</Link></div>}
    </section>
  </div>;
}
