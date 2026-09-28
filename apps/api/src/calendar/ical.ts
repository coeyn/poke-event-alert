export type CalendarEvent = {
  uid: string;
  title: string;
  startsAt: string;
  endsAt?: string | null;
  venueName?: string | null;
  address?: string | null;
  city?: string | null;
  sourceUrl?: string | null;
  description?: string | null;
};

function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function utcStamp(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid calendar date");

  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function defaultEnd(startsAt: string) {
  const start = new Date(startsAt);
  return new Date(start.getTime() + 2 * 60 * 60 * 1000).toISOString();
}

export function createIcs(event: CalendarEvent) {
  const location = [event.venueName, event.address, event.city]
    .filter(Boolean)
    .join(" — ");

  const description = [
    event.description,
    event.sourceUrl ? `Source : ${event.sourceUrl}` : null
  ]
    .filter(Boolean)
    .join("\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Poké Event Alert//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeText(event.uid)}`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${utcStamp(event.startsAt)}`,
    `DTEND:${utcStamp(event.endsAt ?? defaultEnd(event.startsAt))}`,
    `SUMMARY:${escapeText(event.title)}`,
    location ? `LOCATION:${escapeText(location)}` : null,
    description ? `DESCRIPTION:${escapeText(description)}` : null,
    event.sourceUrl ? `URL:${event.sourceUrl}` : null,
    "END:VEVENT",
    "END:VCALENDAR"
  ].filter((line): line is string => Boolean(line));

  return lines.join("\r\n") + "\r\n";
}
