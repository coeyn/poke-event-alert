import { expect, test } from "@playwright/test";

const daysFromNow = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(13, 0, 0, 0);
  return date.toISOString();
};

const fixture = {
  generatedAt: new Date().toISOString(),
  scope: { country: "FR", start: "2026-01-01", end: "2027-12-31", days: 30 },
  count: 7,
  events: [
    { id: "e2e-challenge", title: "League Challenge de test", type: "Challenge", game: "JCC", admission: "8€", startsAt: daysFromNow(5), sourceUrl: "https://play.pokemon.com/", venueKey: "league:1001", venueName: "Boutique Démo", leagueId: "1001", city: "Rennes", address: "1 rue Test", countryCode: "FR" },
    { id: "e2e-cup", title: "League Cup de test", type: "Cup", game: "JCC", admission: "0", startsAt: daysFromNow(12), sourceUrl: "https://play.pokemon.com/", venueKey: "league:1001", venueName: "Boutique Démo", leagueId: "1001", city: "Rennes", address: "1 rue Test", countryCode: "FR" },
    { id: "e2e-cup-expensive", title: "League Cup chère", type: "Cup", game: "JCC", admission: "12€", startsAt: daysFromNow(2), sourceUrl: "https://play.pokemon.com/", venueKey: "league:1001", venueName: "Boutique Démo", leagueId: "1001", city: "Rennes", address: "1 rue Test", countryCode: "FR" },
    { id: "e2e-challenge-cheap", title: "League Challenge moins chère", type: "Challenge", game: "JCC", admission: "5€", startsAt: daysFromNow(10), sourceUrl: "https://play.pokemon.com/", venueKey: "league:1001", venueName: "Boutique Démo", leagueId: "1001", city: "Rennes", address: "1 rue Test", countryCode: "FR" },
    { id: "e2e-prerelease", title: "Avant-première de test", type: "Avant-première", game: "JCC", admission: "10€", startsAt: daysFromNow(7), sourceUrl: "https://play.pokemon.com/", venueKey: "league:1001", venueName: "Boutique Démo", leagueId: "1001", city: "Rennes", address: "1 rue Test", countryCode: "FR" },
    { id: "e2e-session", title: "Session Play gratuite", type: "Session Play", game: "JCC", admission: "Gratuit", startsAt: daysFromNow(8), sourceUrl: "https://play.pokemon.com/", venueKey: "league:1001", venueName: "Boutique Démo", leagueId: "1001", city: "Rennes", address: "1 rue Test", countryCode: "FR" },
    { id: "e2e-session-paid", title: "Session Play payante", type: "Session Play", game: "JCC", admission: "4€", startsAt: daysFromNow(4), sourceUrl: "https://play.pokemon.com/", venueKey: "league:1001", venueName: "Boutique Démo", leagueId: "1001", city: "Rennes", address: "1 rue Test", countryCode: "FR", latitude: 48.11, longitude: -1.68 }
  ]
};

test.beforeEach(async ({ page }) => {
  await page.route("**/data/events.json", (route) => route.fulfill({ json: fixture }));
  await page.route("http://127.0.0.1:3999/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/users" && request.method() === "POST") return route.fulfill({ json: { id: "e2e-user" } });
    if (url.pathname === "/venues" && request.method() === "GET") return route.fulfill({ json: { items: [{ id: "venue-1", source: "pokedata", leagueId: "1001", name: "Boutique Démo", city: "Rennes", countryCode: "FR" }], pagination: { limit: 25, offset: 0, total: 1, hasMore: false } } });
    if (url.pathname.includes("/follows/")) return route.fulfill({ json: { followed: request.method() === "POST" } });
    return route.abort();
  });
});

test("home presents the requested sections and keeps mobile navigation at the bottom", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Poké Event Alert" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Boutiques suivies" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "À venir" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Boutique mise en avant" })).toBeVisible();

  const sections = await page.locator(".homeSection").evaluateAll((items) => items.map((item) => item.getBoundingClientRect().top));
  expect(sections[0]).toBeLessThan(sections[1]);
  expect(sections[1]).toBeLessThan(sections[2]);

  await expect(page.locator(".homeEventArtwork img")).toHaveCount(4);
  await expect(page.locator(".homeEventCard:visible")).toHaveCount(3);
  await expect(page.locator(".homeEventTitle")).toHaveText([
    "League Cup de test",
    "League Challenge moins chère",
    "Avant-première de test",
    "Session Play gratuite"
  ]);
  expect(await page.locator("body").evaluate((body) => body.scrollWidth)).toBeLessThanOrEqual(390);
  const upcomingCards = await page.locator(".homeEventCard").evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect()));
  expect(upcomingCards[0].x).toBeLessThan(upcomingCards[1].x);
  expect(upcomingCards[2].y).toBe(upcomingCards[0].y);
  expect(upcomingCards[3].width).toBe(0);

  const nav = await page.locator(".bottomNav").boundingBox();
  expect(nav).not.toBeNull();
  expect(nav!.y).toBeGreaterThan(600);
  expect(nav!.y + nav!.height).toBeGreaterThanOrEqual(842);

  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(page.locator(".homeEventCard:visible")).toHaveCount(4);
});

test("home and Explorer find, open, follow, and unfollow a shop", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("League Challenge moins chère")).toBeVisible();
  await page.getByRole("link", { name: "Explorer", exact: true }).click();
  await page.getByRole("tab", { name: /Boutiques/ }).click();
  await page.getByRole("textbox", { name: /Rechercher un événement ou une boutique/ }).fill("Rennes");
  const shop = page.locator(".venueCard", { hasText: "Boutique Démo" });
  await expect(shop).toBeVisible();
  await shop.getByRole("button", { name: "Suivre Boutique Démo" }).click();
  await expect(shop.getByRole("button", { name: "Ne plus suivre Boutique Démo" })).toBeVisible();
  await shop.getByRole("link", { name: /Voir la boutique/ }).click();
  await expect(page.getByRole("heading", { name: "Boutique Démo" })).toBeVisible();
  await page.goto("/explorer/");
  await page.getByRole("tab", { name: /Boutiques/ }).click();
  const followed = page.locator(".venueCard", { hasText: "Boutique Démo" });
  await followed.getByRole("button", { name: "Ne plus suivre Boutique Démo" }).click();
  await expect(followed.getByRole("button", { name: "Suivre Boutique Démo" })).toBeVisible();
});

test("home keeps nearby events and local favorites when API sync fails", async ({ page }) => {
  await page.route("http://127.0.0.1:3999/users/e2e-user/follows/**", (route) => route.abort());
  await page.addInitScript(() => {
    localStorage.setItem("poke-event-alert:preview-settings", JSON.stringify({
      discoveryRadiusKm: 10,
      location: { latitude: 48.11, longitude: -1.68 }
    }));
  });
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/");
  await expect(page.locator(".homeUpcoming")).toContainText("Session Play payante");

  await page.getByRole("link", { name: "Explorer", exact: true }).click();
  await page.getByRole("tab", { name: /Boutiques/ }).click();
  await page.getByRole("textbox", { name: /Rechercher un événement ou une boutique/ }).fill("Rennes");
  const shop = page.locator(".venueCard", { hasText: "Boutique Démo" }).first();
  await shop.getByRole("button", { name: "Suivre Boutique Démo" }).click();
  await expect(shop.getByRole("button", { name: "Ne plus suivre Boutique Démo" })).toBeVisible();
  await expect(page.locator(".notice.error")).toContainText("ajoutée aux favoris sur cet appareil");
  expect(await page.evaluate(() => localStorage.getItem("poke-event-alert:preview-favorites"))).toContain("league:1001");
});

test("opens an event and calendar, with static data when the API is unavailable", async ({ page }) => {
  await page.route("http://127.0.0.1:3999/**", (route) => route.abort());
  await page.goto("/explorer/");
  await expect(page.getByText("League Challenge de test")).toBeVisible();
  await page.getByRole("link", { name: /League Challenge de test/ }).click();
  await expect(page.getByRole("heading", { name: "League Challenge de test" })).toBeVisible();
  await page.evaluate(() => localStorage.setItem("poke-event-alert:preview-favorites", JSON.stringify(["league:1001"])));
  await page.goto(`/calendrier/?day=${daysFromNow(5).slice(0, 10)}`);
  await expect(page.getByRole("heading", { name: "Calendrier" })).toBeVisible();
  await expect(page.getByText("League Challenge de test")).toBeVisible();
  await page.route("http://127.0.0.1:3999/venues?**", (route) => route.abort());
  await page.goto("/boutique/?key=league%3A1001");
  await expect(page.getByRole("heading", { name: "Boutique Démo" })).toBeVisible();
  await expect(page.getByText("League Challenge de test")).toBeVisible();
});
