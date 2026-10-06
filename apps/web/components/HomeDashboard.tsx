"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EventCard } from "./EventCard";
import { Loading } from "./Loading";
import { loadUpcomingSnapshot, readFavorites, type PreviewEvent } from "../lib/preview";
import { isPersonalEvent, readLocalSettings, type LocalSettings } from "../lib/local-settings";
import { readBlockedVenues } from "../lib/blocked-venues";
import { EventTypeMark } from "./EventTypeMark";
import { CalendarTypeBadges } from "./CalendarTypeBadges";
import { eventCategorySummary } from "../lib/event-category";

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function HomeDashboard() {
  const [events, setEvents] = useState<PreviewEvent[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [blockedKeys, setBlockedKeys] = useState<string[]>([]);
  const [settings, setSettings] = useState<LocalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const refresh = () => { setFavorites(readFavorites()); setBlockedKeys(readBlockedVenues().map((venue) => venue.key)); setSettings(readLocalSettings()); };
    refresh();
    loadUpcomingSnapshot().then((snapshot) => setEvents(snapshot.events)).catch(() => setError("Impossible de charger les événements pour le moment.")).finally(() => setLoading(false));
    window.addEventListener("focus", refresh);
    window.addEventListener("poke-settings-changed", refresh);
    return () => { window.removeEventListener("focus", refresh); window.removeEventListener("poke-settings-changed", refresh); };
  }, []);

  const today = useMemo(() => new Date(), []);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + index);
    return { key: dayKey(date), date };
  }), [today]);
  const visibleEvents = useMemo(() => events.filter((event) => !blockedKeys.includes(event.venueKey)), [events, blockedKeys]);
  const personalEvents = useMemo(() => settings ? visibleEvents.filter((event) => isPersonalEvent(event, favorites, settings)) : [], [visibleEvents, favorites, settings]);
  const upcoming = personalEvents.length ? personalEvents : visibleEvents;
  const recentSource = personalEvents.length ? personalEvents : visibleEvents;
  const recentCutoff = useMemo(() => dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7)), [today]);
  const recentEvents = useMemo(() => recentSource.filter((event) => event.publishedAt && event.publishedAt.slice(0, 10) >= recentCutoff).sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")), [recentSource, recentCutoff]);
  const eventsByDay = useMemo(() => {
    const map = new Map<string, PreviewEvent[]>();
    for (const event of personalEvents) {
      const key = dayKey(new Date(event.startsAt));
      map.set(key, [...(map.get(key) ?? []), event]);
    }
    return map;
  }, [personalEvents]);

  if (loading) return <Loading />;
  if (error) return <div className="notice error">{error}</div>;

  return <>
    <div className="homeColumns">
      <div className="homePrimary">
        <section className="homeSection">
          <div className="sectionHead"><h2>Les 7 prochains jours</h2><Link className="sectionLink" href="/calendrier/">Calendrier complet →</Link></div>
          <div className="miniCalendar" aria-label="Calendrier des sept prochains jours">{days.map(({ key, date }, index) => {
            const matches = eventsByDay.get(key) ?? [];
            return <Link key={key} className={index === 0 ? "miniDay today" : "miniDay"} href={`/calendrier/?day=${key}`} aria-label={`${new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(date)}, ${matches.length} événement${matches.length > 1 ? "s" : ""} pour toi${matches.length ? ` : ${eventCategorySummary(matches)}` : ""}`}><span>{new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(date)}</span><strong>{date.getDate()}</strong><CalendarTypeBadges events={matches} /></Link>;
          })}</div>
          {!personalEvents.length && <p className="homeHint">Suis une boutique ou ajoute un rayon de découverte pour remplir ton calendrier. <Link href="/explorer/">Trouver une boutique →</Link></p>}
        </section>
        <section className="homeSection">
          <div className="sectionHead"><h2>{personalEvents.length ? "À venir pour toi" : "Prochains événements en France"}</h2><Link className="sectionLink" href="/explorer/">Tout explorer →</Link></div>
          {upcoming.length ? <div className="eventList">{upcoming.slice(0, 4).map((event) => <EventCard key={event.id} event={event} />)}</div> : <div className="emptyState"><h3>Aucun événement à venir</h3><p>Reviens bientôt pour découvrir les prochaines annonces.</p></div>}
        </section>
      </div>
      <aside className="homeSecondary">
        <section className="homeSection">
          <div className="sectionHead"><h2>Ajoutés récemment</h2><span>{personalEvents.length ? "Pour toi · 7 jours" : "France · 7 jours"}</span></div>
          {recentEvents.length ? <div className="recentList">{recentEvents.slice(0, 5).map((event) => <Link key={event.id} href={`/tournoi/?id=${encodeURIComponent(event.id)}`}><EventTypeMark type={event.type} game={event.game} size="small" /><span className="recentBody"><span className="recentType">{event.type}</span><strong>{event.title === "Événement Play! Pokémon" ? event.venueName : event.title}</strong><small>{event.city || event.venueName} · le {new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(`${event.publishedAt?.slice(0, 10)}T12:00:00`))}</small></span></Link>)}</div> : <div className="emptyState"><h3>Aucune annonce récente</h3><p>Les nouvelles publications apparaîtront ici.</p></div>}
        </section>
      </aside>
    </div>
  </>;
}
