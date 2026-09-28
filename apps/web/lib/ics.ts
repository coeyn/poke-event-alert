import type { PreviewEvent } from "./preview";

function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function utcStamp(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

export function createPreviewIcs(event: PreviewEvent) {
  const start = new Date(event.startsAt);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const location = [event.venueName, event.address, event.city]
    .filter(Boolean)
    .join(" — ");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Poké Event Alert//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeText(event.id)}@poke-event-alert`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${utcStamp(start)}`,
    `DTEND:${utcStamp(end)}`,
    `SUMMARY:${escapeText(event.title)}`,
    location ? `LOCATION:${escapeText(location)}` : null,
    `DESCRIPTION:${escapeText(`${event.type} — ${event.game}\n${event.venueName}`)}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ]
    .filter((line): line is string => Boolean(line))
    .join("\r\n") + "\r\n";
}

export function previewIcsHref(event: PreviewEvent) {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(createPreviewIcs(event))}`;
}

export function previewIcsFilename(event: PreviewEvent) {
  const safe = event.title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 60);

  return `${safe || "evenement-pokemon"}.ics`;
}
