"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EventCard } from "./EventCard";
import { Loading } from "./Loading";
import { loadUpcomingSnapshot, readFavorites, type PreviewEvent } from "../lib/preview";
import { isPersonalEvent, readLocalSettings, type LocalSettings } from "../lib/local-settings";
import { readBlockedVenues } from "../lib/blocked-venues";
import { EventTypeMark } from "./EventTypeMark";

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
  const countByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const event of personalEvents) {
      const key = dayKey(new Date(event.startsAt));
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [personalEvents]);

  if (loading) return <Loading />;
  if (error) return <div className="notice error">{error}</div>;

  return <>
    <div className="homeStatus" aria-label="Vue d'ensemble">
      <div><strong>{favorites.length}</strong><span>Boutique{favorites.length > 1 ? "s" : ""} suivie{favorites.length > 1 ? "s" : ""}</span></div>
      <div><strong>{personalEvents.length}</strong><span>Événement{personalEvents.length > 1 ? "s" : ""} pour toi</span></div>
      <div><strong>{recentEvents.length}</strong><span>Ajouté{recentEvents.length > 1 ? "s" : ""} cette semaine</span></div>
    </div>
    <div className="homeQuickActions"><Link href="/explorer/">⌕ <span>Rechercher un événement ou une boutique</span><span aria-hidden="true">→</span></Link><Link href="/reglages/">⚑ <span>Gérer mes alertes</span><span aria-hidden="true">→</span></Link></div>
    <div className="homeColumns">
      <div className="homePrimary">
        <section className="homeSection">
          <div className="sectionHead"><h2>Les 7 prochains jours</h2><Link className="sectionLink" href="/calendrier/">Calendrier complet →</Link></div>
          <div className="miniCalendar" aria-label="Calendrier des sept prochains jours">{days.map(({ key, date }, index) => <Link key={key} className={index === 0 ? "miniDay today" : "miniDay"} href={`/calendrier/?day=${key}`} aria-label={`${new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(date)}, ${countByDay.get(key) ?? 0} événement${(countByDay.get(key) ?? 0) > 1 ? "s" : ""} pour toi`}><span>{new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(date)}</span><strong>{date.getDate()}</strong><i className={countByDay.has(key) ? "hasEvents" : ""} aria-hidden="true" /></Link>)}</div>
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
          {recentEvents.length ? <div className="recentList">{recentEvents.slice(0, 5).map((event) => <Link key={event.id} href={`/tournoi/?id=${encodeURIComponent(event.id)}`}><EventTypeMark type={event.type} size="small" /><span className="recentBody"><span className="recentType">{event.type}</span><strong>{event.title === "Événement Play! Pokémon" ? event.venueName : event.title}</strong><small>{event.city || event.venueName} · le {new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(`${event.publishedAt?.slice(0, 10)}T12:00:00`))}</small></span></Link>)}</div> : <div className="emptyState"><h3>Aucune annonce récente</h3><p>Les nouvelles publications apparaîtront ici.</p></div>}
        </section>
      </aside>
    </div>
  </>;
}
