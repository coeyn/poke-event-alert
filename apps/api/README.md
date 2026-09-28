# API

Backend de Poké Event Alert.

## Première source : PokéData Events API v2

L'adaptateur `PokeDataSource` utilise l'API événements v2 de PokéData et la convertit vers le contrat interne `SourceEvent`.

Par défaut, le MVP récupère :

- les événements en France (`FR`) ;
- à partir d'aujourd'hui ;
- jusqu'à 180 jours dans le futur.

Ces valeurs sont configurables :

```env
POKEDATA_EVENTS_API_URL=https://pokedata.ovh/events/apiv2
POKEDATA_COUNTRIES=FR
POKEDATA_DAYS_AHEAD=180
```

Le client utilise les filtres de chemin documentés par PokéData (`_country`, `_start`, `_end`) et suit la pagination v2 avec `metadata.current_page` / `metadata.total_pages` et `_page/N`.

## Garanties de l'adaptateur

- pagination complète du périmètre demandé ;
- normalisation des champs réellement observés dans l'API v2 ;
- déduplication par identifiant source ;
- conservation du payload brut pour le diagnostic ;
- signal `complete=false` si la collecte est tronquée ;
- retour du `scope` exact de la collecte pour sécuriser ensuite la détection des événements disparus.

## Vérifications

```bash
npm install
npm run --workspace @poke-event-alert/api typecheck
npm run --workspace @poke-event-alert/api test
npm run --workspace @poke-event-alert/api source:pokedata
```

Le test live réalisé pendant le développement a confirmé le format v2, ses métadonnées de pagination et les champs utilisés pour les boutiques, Ligues, dates, produits et URLs.

> Le reste de l'application ne doit jamais dépendre directement du schéma PokéData. Toute adaptation à une évolution de la source reste confinée à `src/sources/pokedata`.
