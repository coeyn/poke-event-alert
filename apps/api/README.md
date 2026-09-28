# API

Backend de Poké Event Alert.

## Modules MVP

- `sources/` — adaptateurs de sources
- `ingestion/` — récupération, normalisation et détection des changements
- `events/` — persistance
- `venues/` — boutiques / Ligues
- `subscriptions/` — favoris et préférences
- `notifications/` — Web Push
- `calendar/` — génération iCalendar

## Stack

- Node.js
- TypeScript
- PostgreSQL
- `pg`

## Développement local

Démarrer PostgreSQL :

```bash
docker compose up -d postgres
```

Installer les dépendances et créer le schéma :

```bash
npm install
npm run --workspace @poke-event-alert/api db:migrate
```

Lancer les contrôles :

```bash
npm run --workspace @poke-event-alert/api typecheck
npm run --workspace @poke-event-alert/api test
```

## Source : PokéData Events API v2

L'adaptateur `PokeDataSource` cible par défaut :

`https://pokedata.ovh/events/apiv2`

Le endpoint est configurable via `POKEDATA_EVENTS_API_URL`.

Inspecter la source sans écrire en base :

```bash
npm run --workspace @poke-event-alert/api source:pokedata
```

Récupérer la source et l'ingérer en PostgreSQL :

```bash
npm run --workspace @poke-event-alert/api ingest:pokedata
```

Le pipeline :

- suit la pagination ;
- normalise vers le contrat interne `SourceEvent` ;
- déduplique par identifiant source ;
- conserve le payload brut pour le diagnostic ;
- calcule un hash uniquement sur les champs significatifs ;
- classe les événements en NEW / UPDATED / UNCHANGED / MISSING ;
- ne marque jamais automatiquement un événement comme annulé ;
- désactive la détection MISSING lorsque la collecte est incomplète.

Le schéma externe reste isolé dans `src/sources/pokedata`.


## Tests d'intégration

La CI démarre un PostgreSQL isolé, applique toutes les migrations puis vérifie le cycle d'ingestion complet :

```bash
npm run --workspace @poke-event-alert/api db:migrate
npm run --workspace @poke-event-alert/api test:integration
```

Le scénario couvre la création initiale, une collecte identique sans doublon, une modification d'événement et la disparition d'un événement futur dans le même périmètre de collecte.


## Notifications Web Push

Variables nécessaires :

```env
WEB_PUSH_PUBLIC_KEY=
WEB_PUSH_PRIVATE_KEY=
WEB_PUSH_SUBJECT=mailto:admin@example.com
PUBLIC_WEB_URL=https://coeyn.github.io/poke-event-alert
```

Générer une paire VAPID :

```bash
npx web-push generate-vapid-keys
```

Le flux est le suivant :

1. le navigateur crée un abonnement Push ;
2. l'abonnement est enregistré via `POST /users/:userId/push-subscriptions` ;
3. l'ingestion crée une notification lorsqu'un événement NEW ou UPDATED correspond à une boutique suivie et aux filtres utilisateur ;
4. `npm run --workspace @poke-event-alert/api notifications:send` envoie les notifications en attente ;
5. les abonnements expirés (HTTP 404/410) sont supprimés automatiquement.

En production, le job d'ingestion et le worker d'envoi doivent être exécutés de manière récurrente sur un backend toujours disponible.
