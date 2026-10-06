import type { PreviewEvent } from "../lib/preview";
import { EVENT_CATEGORIES, eventCategoryCounts } from "../lib/event-category";

export function CalendarTypeBadges({ events, expanded = false }: { events: PreviewEvent[]; expanded?: boolean }) {
  if (!events.length) return null;
  const counts = eventCategoryCounts(events);
  return <span className={expanded ? "calendarTypeBadges expanded" : "calendarTypeBadges"} aria-hidden={expanded ? undefined : true}>
    {EVENT_CATEGORIES.filter(({ key }) => counts[key] > 0).map(({ key, short, label }) =>
      <span key={key} className={`calendarTypeBadge ${key}`}>{expanded ? label : short}<b>{counts[key]}</b></span>
    )}
  </span>;
}

export function CalendarTypeLegend() {
  return <div className="calendarTypeLegend" aria-label="Légende des événements">
    {EVENT_CATEGORIES.map(({ key, label, short }) => <span key={key}><i className={`calendarLegendSwatch ${key}`} aria-hidden="true" /><strong>{short}</strong> {label}</span>)}
  </div>;
}
