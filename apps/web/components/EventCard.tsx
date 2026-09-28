import Link from "next/link";
import { formatDate, type PreviewEvent } from "../lib/preview";

export function EventCard({ event }: { event: PreviewEvent }) {
  return (
    <Link className="eventCard" href={`/tournoi/?id=${encodeURIComponent(event.id)}`}>
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
      <span className="arrowLink" aria-hidden="true">›</span>
    </Link>
  );
}
