"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EventCard } from "./EventCard";
import { Loading } from "./Loading";
import { loadUpcomingSnapshot, readFavorites, type PreviewEvent } from "../lib/preview";
import { isPersonalEvent, readLocalSettings, type LocalSettings } from "../lib/local-settings";

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function eventDay(event: PreviewEvent) {
  return dayKey(new Date(event.startsAt));
}

export function CalendarView() {
  const [events, setEvents] = useState<PreviewEvent[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [settings, setSettings] = useState<LocalSettings | null>(null);
  const [selectedDay, setSelectedDay] = useState(dayKey(new Date()));
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scope, setScope] = useState<{ start: string; end: string } | null>(null);

  useEffect(() => {
    setFavorites(readFavorites());
    setSettings(readLocalSettings());
    const requestedDay = new URLSearchParams(window.location.search).get("day");
    if (requestedDay && /^\d{4}-\d{2}-\d{2}$/.test(requestedDay)) {
      const requestedDate = new Date(`${requestedDay}T12:00:00`);
      if (!Number.isNaN(requestedDate.getTime())) { setSelectedDay(requestedDay); setMonth(new Date(requestedDate.getFullYear(), requestedDate.getMonth(), 1)); }
    }
    loadUpcomingSnapshot().then((snapshot) => { setEvents(snapshot.events); setScope(snapshot.scope); }).catch(() => setError("Le calendrier est momentanément indisponible.")).finally(() => setLoading(false));
    const refresh = () => { setFavorites(readFavorites()); setSettings(readLocalSettings()); };
    window.addEventListener("focus", refresh);
    window.addEventListener("poke-settings-changed", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("poke-settings-changed", refresh);
    };
  }, []);

  const visible = useMemo(() => settings ? events.filter((event) => isPersonalEvent(event, favorites, settings)) : [], [events, favorites, settings]);

  const byDay = useMemo(() => {
    const map = new Map<string, PreviewEvent[]>();
    for (const event of visible) {
      const key = eventDay(event);
      map.set(key, [...(map.get(key) ?? []), event]);
    }
    return map;
  }, [visible]);

  const firstWeekday = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: firstWeekday + daysInMonth }, (_, index) => index < firstWeekday ? null : index - firstWeekday + 1);
  const dayEvents = byDay.get(selectedDay) ?? [];
  const monthLabel = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(month);
  const monthCount = visible.filter((event) => { const date = new Date(event.startsAt); return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth(); }).length;
  const firstMonth = scope ? new Date(`${scope.start}T12:00:00`) : month;
  const lastMonth = scope ? new Date(`${scope.end}T12:00:00`) : month;
  const canGoBack = month.getFullYear() > firstMonth.getFullYear() || (month.getFullYear() === firstMonth.getFullYear() && month.getMonth() > firstMonth.getMonth());
  const canGoNext = month.getFullYear() < lastMonth.getFullYear() || (month.getFullYear() === lastMonth.getFullYear() && month.getMonth() < lastMonth.getMonth());

  function shiftMonth(delta: number) {
    const next = new Date(month.getFullYear(), month.getMonth() + delta, 1);
    setMonth(next);
    setSelectedDay(dayKey(next));
  }

  if (loading) return <Loading />;
  if (error) return <div className="notice error">{error}</div>;

  return <>
    <div className="calendarSummary">
      <div><strong>{favorites.length}</strong><span>boutique{favorites.length > 1 ? "s" : ""} suivie{favorites.length > 1 ? "s" : ""}</span></div>
      <div><strong>{monthCount}</strong><span>événement{monthCount > 1 ? "s" : ""} ce mois</span></div>
      <div><strong>{settings?.discoveryRadiusKm ? `${settings.discoveryRadiusKm} km` : "—"}</strong><span>rayon découverte</span></div>
    </div>
    {Boolean(settings?.discoveryRadiusKm) && !settings?.location && <div className="calendarCallout">Pour découvrir des événements proches, <Link href="/reglages/">ajoute ta position dans les réglages</Link>.</div>}
    <section className="calendarPanel" aria-label="Calendrier des événements">
      <div className="calendarToolbar">
        <div><span className="eyebrow">Agenda</span><h2>{monthLabel}</h2></div>
        <div className="calendarControls"><button type="button" onClick={() => shiftMonth(-1)} disabled={!canGoBack} aria-label="Mois précédent">‹</button><button type="button" onClick={() => shiftMonth(1)} disabled={!canGoNext} aria-label="Mois suivant">›</button></div>
      </div>
      <div className="calendarGrid weekdayRow">{["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="calendarGrid daysGrid">{cells.map((day, index) => {
        if (day === null) return <span key={`blank-${index}`} aria-hidden="true" />;
        const key = dayKey(new Date(month.getFullYear(), month.getMonth(), day));
        const matches = byDay.get(key) ?? [];
        const unavailable = Boolean(scope && (key < scope.start || key > scope.end));
        return <button key={key} type="button" disabled={unavailable} className={`calendarDay${selectedDay === key ? " selected" : ""}${key === dayKey(new Date()) ? " today" : ""}`} onClick={() => setSelectedDay(key)} aria-label={`${day} ${monthLabel}${unavailable ? ", hors période" : `, ${matches.length} événement${matches.length > 1 ? "s" : ""}`}`} aria-pressed={selectedDay === key}><span>{day}</span>{matches.length > 0 && <i aria-hidden="true" />}</button>;
      })}</div>
    </section>
    {scope && <p className="calendarScope">Événements publiés du {new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(firstMonth)} au {new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(lastMonth)}.</p>}
    <div className="sectionHead calendarEventsHead"><h2>{new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${selectedDay}T12:00:00`))}</h2><span>{dayEvents.length} événement{dayEvents.length > 1 ? "s" : ""}</span></div>
    {dayEvents.length ? <div className="eventList">{dayEvents.map((event) => <EventCard key={event.id} event={event} />)}</div> : <div className="emptyState"><div>○</div><h3>Rien de prévu ce jour</h3><p>{favorites.length ? "Choisis un autre jour ou élargis ton rayon de découverte." : "Commence par suivre des boutiques pour remplir ton calendrier."}</p>{!favorites.length && <Link className="secondaryButton" href="/explorer/">Découvrir des boutiques →</Link>}</div>}
  </>;
}
