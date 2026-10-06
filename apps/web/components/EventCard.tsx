import Link from "next/link";
import { type PreviewEvent } from "../lib/preview";

export function EventCard({ event }: { event: PreviewEvent }) {
  const date = new Date(event.startsAt);
  const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(date);
  const genericTitle = event.title === "Événement Play! Pokémon";
  return (
    <Link className="eventCard" href={`/tournoi/?id=${encodeURIComponent(event.id)}`}>
      <div className="eventDate">
        <span>{new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(date)}</span>
        <b>{date.getDate()}</b>
      </div>
      <div className="eventBody">
        <div className="chips">
          <span className="chip typeChip">{event.type}</span>
          <span className="chip soft">{event.game}</span>
        </div>
        <h3>{genericTitle ? `${event.type} · ${event.venueName}` : event.title}</h3>
        <p className="meta">{!genericTitle && <><span className="venueName">{event.venueName}</span><span aria-hidden="true">·</span></>}{event.city || event.address || "France"}<span aria-hidden="true">·</span><strong>{time}</strong></p>
      </div>
      <span className="arrowLink" aria-hidden="true">↗</span>
    </Link>
  );
}
