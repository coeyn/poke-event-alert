# Architecture MVP

## Vue générale

```
                    +-------------------+
                    |  Source adapter   |
                    +---------+---------+
                              |
                              v
+-------------+      +-------------------+      +-------------------+
| Scheduler   +----->+ Ingestion service +----->+ PostgreSQL        |
+-------------+      +---------+---------+      +---------+---------+
                              |                          |
                              v                          v
                    +-------------------+      +-------------------+
                    | Change detector   |      | HTTP API          |
                    +---------+---------+      +---------+---------+
                              |                          |
                              v                          v
                    +-------------------+      +-------------------+
                    | Notification job  |      | PWA / Web app     |
                    +-------------------+      +-------------------+
```

## Apps

### `apps/web`

Responsabilités :

- recherche ;
- affichage des événements ;
- favoris ;
- préférences ;
- installation PWA ;
- abonnement Web Push ;
- export calendrier.

### `apps/api`

Responsabilités :

- API HTTP ;
- ingestion des événements ;
- normalisation ;
- détection NEW / UPDATED / MISSING / UNCHANGED ;
- gestion des abonnements ;
- envoi des notifications.

## Source adapters

Une source doit implémenter un contrat commun :

```ts
type SourceEvent = {
  source: string
  sourceEventId: string
  sourceUrl: string
  title: string
  startsAt: string
  endsAt?: string
  venueName?: string
  leagueId?: string
  address?: string
  eventType?: string
  registrationUrl?: string
  raw: unknown
}
```

Le reste du produit ne doit pas dépendre du format spécifique d'un fournisseur.

## Détection de changements

Pour chaque événement normalisé :

1. générer un identifiant stable ;
2. calculer un hash des champs significatifs ;
3. comparer avec la dernière version ;
4. produire un statut :
   - `NEW`
   - `UPDATED`
   - `UNCHANGED`
   - `MISSING`

Un événement `MISSING` ne doit pas être immédiatement marqué « annulé ».

## Fréquence

Pour le MVP, un passage toutes les heures est suffisant. La fréquence pourra être adaptée selon les limites et conditions des sources.

## Sécurité / confidentialité

- stocker le minimum d'informations utilisateur ;
- permettre la suppression du compte et des abonnements ;
- ne jamais exposer les clés Web Push ;
- journaliser les erreurs d'ingestion sans données sensibles ;
- limiter le nombre de requêtes vers les sources.
