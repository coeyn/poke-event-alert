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
  admission?: string;
  registrationUrl?: string;
  raw: unknown;
};

export type SourceFetchScope = {
  countryCodes?: string[];
  startsFrom?: string;
  startsUntil?: string;
};

export type SourceFetchResult = {
  events: SourceEvent[];
  warnings: string[];
  pagesFetched: number;
  /**
   * True only when the adapter believes it consumed the full filtered result.
   * Missing-event detection MUST NOT run for an incomplete fetch.
   */
  complete: boolean;
  /**
   * Describes the subset queried from the upstream source so absence detection
   * never affects events outside that subset.
   */
  scope?: SourceFetchScope;
};

export interface EventSource {
  readonly name: string;
  fetchEvents(): Promise<SourceFetchResult>;
}
