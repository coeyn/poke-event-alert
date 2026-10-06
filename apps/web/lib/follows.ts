import {
  PUBLIC_API_CONFIGURED,
  followVenue,
  getFollows,
  getOrCreateUserId,
  searchVenues,
  unfollowVenue,
  type Venue
} from "./api";

export type FollowableVenue = {
  key: string;
  name: string;
  leagueId?: string | null;
  city?: string | null;
  countryCode?: string | null;
};

function normalized(value?: string | null) {
  return (value ?? "").trim().toLocaleLowerCase("fr-FR");
}

async function resolveBackendVenue(venue: FollowableVenue): Promise<Venue | null> {
  if (!PUBLIC_API_CONFIGURED) return null;

  const search = venue.leagueId ?? venue.name;
  const result = await searchVenues(search, {
    countryCode: venue.countryCode ?? "FR",
    limit: 25
  });

  if (venue.leagueId) {
    const exactLeague = result.items.find(
      (item) => item.leagueId === venue.leagueId
    );
    if (exactLeague) return exactLeague;
  }

  const exactNameCity = result.items.find(
    (item) =>
      normalized(item.name) === normalized(venue.name) &&
      normalized(item.city) === normalized(venue.city)
  );
  if (exactNameCity) return exactNameCity;

  return (
    result.items.find((item) => normalized(item.name) === normalized(venue.name)) ??
    null
  );
}

export async function syncVenueFollow(
  venue: FollowableVenue,
  followed: boolean
): Promise<void> {
  if (!PUBLIC_API_CONFIGURED) return;

  const backendVenue = await resolveBackendVenue(venue);
  if (!backendVenue) {
    throw new Error(`Boutique introuvable côté serveur : ${venue.name}`);
  }

  const userId = await getOrCreateUserId();

  if (followed) {
    await followVenue(userId, backendVenue.id);
  } else {
    await unfollowVenue(userId, backendVenue.id);
  }
}

export async function syncExistingLocalFollows(
  venues: FollowableVenue[],
  localKeys: string[]
): Promise<void> {
  if (!PUBLIC_API_CONFIGURED || localKeys.length === 0) return;

  const wanted = venues.filter((venue) => localKeys.includes(venue.key));
  await Promise.allSettled(wanted.map((venue) => syncVenueFollow(venue, true)));
}

export async function getRemoteFollowKeys(
  venues: FollowableVenue[]
): Promise<string[]> {
  if (!PUBLIC_API_CONFIGURED) return [];

  const userId = await getOrCreateUserId();
  const remote = await getFollows(userId);

  return venues
    .filter((venue) =>
      remote.items.some((item) => {
        if (venue.leagueId && item.leagueId) {
          return venue.leagueId === item.leagueId;
        }

        return (
          normalized(venue.name) === normalized(item.name) &&
          normalized(venue.city) === normalized(item.city)
        );
      })
    )
    .map((venue) => venue.key);
}
