export type SourceEvent = {
  source: string;
  sourceEventId: string;
  sourceUrl: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  venueName?: string;
  sourceVenueId?: string;
  leagueId?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  eventType?: string;
  game?: string;
  registrationUrl?: string;
  raw: unknown;
};

export type SourceFetchResult = {
  events: SourceEvent[];
  warnings: string[];
  pagesFetched: number;
  /**
   * True only when the adapter believes it consumed the full source result.
   * Missing-event detection MUST NOT run for an incomplete fetch.
   */
  complete: boolean;
};

export interface EventSource {
  readonly name: string;
  fetchEvents(): Promise<SourceFetchResult>;
}
