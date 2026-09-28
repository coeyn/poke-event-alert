# API

Backend de Poké Event Alert.

## Modules MVP

- `sources/` — adaptateurs de sources
- `ingestion/` — récupération et normalisation
- `events/` — persistance et comparaison
- `venues/` — boutiques / Ligues
- `subscriptions/` — favoris et préférences
- `notifications/` — Web Push
- `calendar/` — génération iCalendar

## Stack proposée

- Node.js
- TypeScript
- Fastify
- PostgreSQL

## Première source : PokéData Events API v2

L'adaptateur `PokeDataSource` cible par défaut :

`https://pokedata.ovh/events/apiv2`

Le endpoint est volontairement configurable :

```bash
POKEDATA_EVENTS_API_URL="https://pokedata.ovh/events/apiv2" npm run source:pokedata
```

Le client :

- suit la pagination ;
- normalise les événements vers le contrat interne `SourceEvent` ;
- déduplique sur l'identifiant source ;
- conserve le payload brut pour faciliter le diagnostic ;
- ignore les lignes qui n'ont pas d'identifiant stable ou de date exploitable ;
- ne couple pas le reste de l'application au schéma PokéData.

### Lancer localement

Depuis la racine du dépôt :

```bash
npm install
npm run --workspace @poke-event-alert/api typecheck
npm run --workspace @poke-event-alert/api test
npm run --workspace @poke-event-alert/api source:pokedata
```

> Le schéma de l'API externe reste isolé dans `src/sources/pokedata`. Si PokéData renomme un champ ou si nous ajoutons une autre source, le modèle interne ne change pas.
