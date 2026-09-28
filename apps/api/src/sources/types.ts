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
};

export interface EventSource {
  readonly name: string;
  fetchEvents(): Promise<SourceFetchResult>;
}
