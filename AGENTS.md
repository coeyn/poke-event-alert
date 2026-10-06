# Poké Event Alert — agent handoff

This file is the current operational context for coding agents working in this repository. Read it before making changes.

## Product goal

Poké Event Alert is a community PWA for Play! Pokémon players.

Main promise: **users should not miss an event published by a shop / League they follow.**

The app is alert-first, not just another event locator. Users can browse events and shops, follow shops, receive Web Push notifications for new/updated matching events, open event details, and export events to iCalendar.

Public web app: `https://coeyn.github.io/poke-event-alert/`
Public API: `https://nasmaine22.synology.me:8443`

This is an independent fan/community project and must keep the non-affiliation disclaimer.

## Current stack

Monorepo:

- `apps/web` — Next.js 16 / React 19 static-export PWA, deployed on GitHub Pages.
- `apps/api` — Fastify API + PostgreSQL ingestion / change detection / Push worker.
- PostgreSQL and API run on a small Synology NAS.
- Event source adapter currently uses PokeData (`https://pokedata.ovh/events/apiv2`).

The Synology is resource-constrained (512 MB RAM). **Do not redesign the frontend so every browser downloads all French events from the NAS.**

## Current data-loading strategy — preserve this unless explicitly asked to change it

The frontend intentionally uses a hybrid strategy to protect the NAS:

1. **General event list and general shop list** use the static `events.json` snapshot hosted by GitHub Pages/CDN.
2. GitHub Actions regenerates that snapshot every **30 minutes**.
3. **Opening one shop page** performs a targeted live API lookup for that shop and then requests only that shop's future events.
4. **Shop counters** are refreshed selectively with the batched `POST /venues/counts` endpoint:
   - `Mes boutiques` refreshes followed-shop counters in one grouped request.
   - the general shop page refreshes live counters only when the user actually enters a search query, with debounce.
5. Browser-side live venue/count data is cached briefly (currently 60 seconds).
6. If the NAS/API is unavailable, the static snapshot remains a valid fallback.

Do not regress to calling `/events` for the full country on every page load.

## Important existing behavior

Working features that should not be broken during UI/CSS work:

- PWA / service worker registration.
- Bottom navigation and routes.
- Event list and event detail pages.
- Shop list, shop detail pages, local favorite state and backend follow synchronization.
- Existing local favorites can migrate/sync to backend follows.
- Web Push subscription, unsubscribe, test notification, and push click handling.
- Push notifications for NEW / UPDATED matching events.
- iCalendar export.
- API CORS setup for GitHub Pages.
- Static fallback behavior when the API is down.

Push and database secrets are environment variables. Never commit or print private VAPID keys, DB passwords, or `.env` contents.

## Web routes / main UI areas

Current routes under `apps/web/app`:

- `/` — upcoming events
- `/boutiques/` — shop search / browse
- `/mes-boutiques/` — followed shops
- `/boutique/?key=...` — shop detail, refreshed live
- `/tournoi/?id=...` — event detail
- `/reglages/` — settings / Push controls

Main reusable frontend files:

- `apps/web/app/globals.css` — current global styling
- `apps/web/components/AppShell.tsx`
- `apps/web/components/BottomNav.tsx`
- `apps/web/components/EventCard.tsx`
- `apps/web/components/LiveData.tsx`
- `apps/web/components/Loading.tsx`
- `apps/web/lib/preview.ts` — static/live data helpers
- `apps/web/lib/follows.ts` — favorites/follow synchronization
- `apps/web/lib/api.ts` — API helpers

## Current UI/CSS task

The owner considers the current interface **ugly and not practical enough** and is moving to Codex primarily to improve the frontend presentation and usability.

You are encouraged to substantially improve layout, CSS, information hierarchy, spacing, component structure, and responsive behavior. Small JSX refactors are fine when they materially improve UX.

### UX priorities

- **Mobile first**: this is primarily a phone PWA.
- The first screen should make the next useful action obvious.
- Event cards should be easy to scan quickly: event type, date/time, shop, city, and important action/link.
- Shop cards should make the shop name, city, League ID when present, followed state, and **upcoming event count** immediately understandable.
- Following/unfollowing a shop must be obvious and thumb-friendly.
- `Mes boutiques` should feel like a useful dashboard, not just another copy of the shop list.
- Search should be prominent and readable.
- Settings / notification state should clearly communicate whether Push is enabled.
- Keep bottom navigation usable with phone safe areas.
- Desktop/tablet should look intentional, but mobile has priority.

### Visual guidance

There is no locked visual identity yet. Prefer a polished modern event-app aesthetic over a generic admin dashboard.

Good defaults:

- strong but simple visual hierarchy;
- compact cards without feeling cramped;
- clear event-type badges;
- consistent spacing/radius/shadows;
- strong selected/followed states;
- readable contrast;
- avoid excessive gradients, glassmorphism, or decorative clutter;
- avoid making every element a separate bordered box;
- preserve French UI copy unless there is a clear UX reason to improve wording.

It can feel Pokémon-adjacent through energy and color, but do not depend on copyrighted Pokémon artwork for the core UI.

### Accessibility / interaction

- Aim for ~44 px touch targets for primary interactive controls.
- Keep visible keyboard focus states.
- Avoid horizontal scrolling on common phone widths.
- Respect `prefers-reduced-motion` if adding meaningful animation.
- Do not hide critical information behind hover-only interactions.

## Static export / GitHub Pages constraints

The web app is statically exported for GitHub Pages and uses the base path `/poke-event-alert` in deployment.

Be careful with:

- absolute paths;
- asset URLs;
- route links;
- service worker paths;
- anything that assumes a Node server is serving Next.js pages dynamically.

GitHub Pages deployment is controlled by `.github/workflows/pages.yml`.

## API / backend notes relevant to frontend work

Useful routes already exist; prefer using them rather than inventing expensive frontend workarounds:

- `GET /health`
- `GET /events`
- `GET /events/:id`
- `GET /venues`
- `GET /venues/:id`
- `GET /venues/:id/events`
- `POST /venues/counts` — batched live upcoming-event counts
- user/follow/preferences routes
- Push public key/subscription/test routes
- iCalendar event route

Before changing API contracts, inspect the current backend implementation and integration tests.

## Event ingestion semantics

Events use ingestion states including NEW / UPDATED / UNCHANGED / MISSING.

Important: **MISSING is not automatically equivalent to cancelled.** Do not change UI copy to confidently call a missing event cancelled unless the backend/source has explicit cancellation information.

## Development / validation

Install dependencies from the repository root when needed:

```bash
npm install
```

Useful web commands:

```bash
npm run --workspace @poke-event-alert/web typecheck
npm run --workspace @poke-event-alert/web preview:data
npm run --workspace @poke-event-alert/web build
npm run --workspace @poke-event-alert/web dev
```

For a UI/CSS change, at minimum run web typecheck + static build before considering it complete. CI also validates API and deployment compose files.

## Working style for this repository

- Inspect existing code before replacing behavior.
- Prefer focused commits / PRs.
- Do not remove working backend integration just to simplify CSS.
- Do not replace the hybrid static/live strategy with polling.
- Do not add frequent timers that hit the Synology.
- Keep the app functional when the public API is temporarily unavailable.
- If a visual refactor needs markup changes, preserve data flow and route semantics.
- If you find a real functional bug while styling, fix it separately or clearly identify it rather than silently mixing a large behavioral rewrite into CSS work.

## Deployment note

API images are published to GHCR as both `latest` and an immutable commit-SHA tag. Synology has previously reused a stale `latest` image, so immutable SHA tags are safer for manual NAS deployments.

Frontend-only changes deploy through GitHub Pages and do not require a NAS redeploy.
Backend/API changes do require a new API image to be deployed on the NAS.
