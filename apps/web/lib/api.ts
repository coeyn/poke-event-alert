export type Venue = {
  id: string;
  source: string;
  sourceVenueId?: string | null;
  leagueId?: string | null;
  name: string;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  sourceUrl?: string | null;
  upcomingEventCount?: number;
};

export type EventItem = {
  id: string;
  source: string;
  sourceEventId: string;
  title: string;
  eventType?: string | null;
  game?: string | null;
  admission?: string | null;
  startsAt: string;
  endsAt?: string | null;
  registrationUrl?: string | null;
  sourceUrl: string;
  status: "active" | "missing" | "cancelled";
  missingSince?: string | null;
  venue?: Venue | null;
};

export type Pagination = {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
};

export type Paginated<T> = {
  items: T[];
  pagination: Pagination;
};

export type Preferences = {
  userId: string;
  eventTypes: string[];
  newEventEnabled: boolean;
  eventUpdateEnabled: boolean;
  reminderEnabled: boolean;
  reminderHoursBefore: number;
  discoveryRadiusKm: number;
};

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:3001";

export const PUBLIC_API_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_API_URL
);

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers
    }
  });

  if (!response.ok) {
    let message = `Erreur API (${response.status})`;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) message = payload.error;
    } catch {
      // Ignore malformed error payloads.
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export function getEvents(params: URLSearchParams = new URLSearchParams()) {
  const query = params.toString();
  return request<Paginated<EventItem>>(`/events${query ? `?${query}` : ""}`);
}

export function getEvent(id: string) {
  return request<EventItem>(`/events/${encodeURIComponent(id)}`);
}

export function searchVenues(
  search: string,
  options: { countryCode?: string; limit?: number } = {}
) {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  if (options.countryCode) params.set("countryCode", options.countryCode);
  if (options.limit) params.set("limit", String(options.limit));
  return request<Paginated<Venue>>(`/venues?${params.toString()}`);
}

export function getVenue(id: string) {
  return request<Venue>(`/venues/${encodeURIComponent(id)}`);
}

export function getVenueEvents(id: string) {
  return request<Paginated<EventItem>>(
    `/venues/${encodeURIComponent(id)}/events`
  );
}

export async function getOrCreateUserId(): Promise<string> {
  const key = "poke-event-alert:user-id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;

  const user = await request<{ id: string }>("/users", {
    method: "POST",
    body: JSON.stringify({})
  });

  window.localStorage.setItem(key, user.id);
  return user.id;
}

export function getFollows(userId: string) {
  return request<{ items: Venue[] }>(
    `/users/${encodeURIComponent(userId)}/follows`
  );
}

export function followVenue(userId: string, venueId: string) {
  return request<{ followed: true }>(
    `/users/${encodeURIComponent(userId)}/follows/${encodeURIComponent(venueId)}`,
    { method: "POST" }
  );
}

export function unfollowVenue(userId: string, venueId: string) {
  return request<{ followed: false }>(
    `/users/${encodeURIComponent(userId)}/follows/${encodeURIComponent(venueId)}`,
    { method: "DELETE" }
  );
}

export function getPreferences(userId: string) {
  return request<Preferences>(
    `/users/${encodeURIComponent(userId)}/preferences`
  );
}

export function savePreferences(
  userId: string,
  preferences: Omit<Preferences, "userId"> & {
    location: { latitude: number; longitude: number } | null;
  }
) {
  return request<Preferences>(
    `/users/${encodeURIComponent(userId)}/preferences`,
    {
      method: "PUT",
      body: JSON.stringify(preferences)
    }
  );
}

export function formatEventDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
