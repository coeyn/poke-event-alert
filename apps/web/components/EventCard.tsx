import { formatDate, type PreviewEvent } from "../lib/preview";

export function EventCard({ event }: { event: PreviewEvent }) {
  return (
    <article className="eventCard">
      <div className="eventDate">
        <b>{new Date(event.startsAt).getDate()}</b>
        <span>{new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(new Date(event.startsAt))}</span>
      </div>
      <div className="eventBody">
        <div className="chips">
          <span className="chip">{event.game}</span>
          <span className="chip soft">{event.type}</span>
        </div>
        <h3>{event.title}</h3>
        <p className="venueName">{event.venueName}</p>
        <p className="meta">{event.city || event.address || "France"} · {formatDate(event.startsAt)}</p>
      </div>
      <a className="arrowLink" href={event.sourceUrl} target="_blank" rel="noreferrer" aria-label="Voir la source officielle">↗</a>
    </article>
  );
}
