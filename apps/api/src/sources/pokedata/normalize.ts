import { normalizePokeDataEvent as normalize } from "@poke-event-alert/pokedata-normalization";
import type { SourceEvent } from "../types.js";

export function normalizePokeDataEvent(input: unknown): SourceEvent | undefined {
  const event = normalize(input);
  if (!event) return undefined;
  const output: SourceEvent = {
    source: "pokedata",
    sourceEventId: event.id,
    sourceUrl: event.sourceUrl,
    title: event.title,
    startsAt: event.startsAt,
    raw: input
  };
  if (event.endsAt) output.endsAt = event.endsAt;
  if (event.venueName) output.venueName = event.venueName;
  if (event.venueId) output.sourceVenueId = event.venueId;
  if (event.leagueId) output.leagueId = event.leagueId;
  if (event.address) output.address = event.address;
  if (event.city) output.city = event.city;
  if (event.postalCode) output.postalCode = event.postalCode;
  if (event.countryCode) output.countryCode = event.countryCode;
  if (event.latitude !== undefined) output.latitude = event.latitude;
  if (event.longitude !== undefined) output.longitude = event.longitude;
  if (event.type) output.eventType = event.type;
  if (event.game) output.game = event.game;
  if (event.admission) output.admission = event.admission;
  if (event.registrationUrl) output.registrationUrl = event.registrationUrl;
  return output;
}
