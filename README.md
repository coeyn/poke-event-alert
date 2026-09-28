# Poké Event Alert

> Ne plus rater un événement Play! Pokémon parce qu'il a été publié sans notification.

Poké Event Alert est un projet communautaire destiné aux joueurs Play! Pokémon qui souhaitent suivre leurs boutiques et Ligues favorites et être alertés lorsqu'un nouvel événement est publié ou modifié.

## Problème

Aujourd'hui, les joueurs doivent penser à consulter régulièrement le localisateur d'événements et les communications propres à chaque boutique. Plusieurs joueurs peuvent ainsi découvrir trop tard un League Challenge, une League Cup, une Avant-première ou un autre événement.

Le produit ne cherche donc pas à être un simple clone du localisateur : **la fonction principale est l'abonnement et l'alerte**.

## MVP

Le premier objectif est de permettre à un joueur de :

- rechercher une boutique / Ligue ;
- suivre une ou plusieurs boutiques favorites ;
- choisir les types d'événements qui l'intéressent ;
- voir ses prochains événements dans une seule vue ;
- recevoir une notification lorsqu'un nouvel événement correspondant apparaît ;
- recevoir une notification lorsqu'un événement suivi change ;
- ouvrir la page source de l'événement ;
- ajouter l'événement à son calendrier.

### Types d'événements ciblés

- League Challenge
- League Cup
- Avant-première / Prerelease
- Tournois et sessions Play! publics
- Pokémon GO
- VGC

Le périmètre exact dépendra des données réellement disponibles dans les sources utilisées.

## Principes produit

1. **Alert-first** — l'utilisateur ne doit plus avoir à penser à vérifier.
2. **Source visible** — chaque événement doit indiquer d'où vient l'information.
3. **Pas de faux niveau de certitude** — un événement supprimé de la source sera signalé comme potentiellement annulé jusqu'à confirmation.
4. **Favoris simples** — suivre une boutique doit prendre quelques secondes.
5. **Mobile d'abord** — l'interface est pensée comme une PWA installable.

## Architecture envisagée

Le dépôt est organisé en monorepo :

```
apps/
  web/        PWA utilisateur
  api/        API, ingestion, détection de changements et notifications

docs/
  PRODUCT.md
  ARCHITECTURE.md
  DATA_MODEL.md
```

Stack proposée pour le MVP :

- TypeScript
- Frontend PWA : Next.js
- API : Node.js / Fastify
- Base : PostgreSQL
- Jobs : cron / worker
- Notifications : Web Push en priorité
- Calendrier : export iCalendar (`.ics`)

La source d'événements sera isolée derrière des adaptateurs afin de pouvoir changer de fournisseur sans réécrire l'application.

## Flux principal

```
Source événement
      ↓
   Ingestion
      ↓
Normalisation + identification
      ↓
Comparaison avec l'état précédent
      ↓
NEW / UPDATED / MISSING / UNCHANGED
      ↓
Matching abonnements utilisateurs
      ↓
Notification + affichage dans l'app
```

## État du projet

🚧 Initialisation du MVP.

Voir :

- [Vision produit](docs/PRODUCT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Modèle de données](docs/DATA_MODEL.md)

## Avertissement

Poké Event Alert est un projet communautaire indépendant. Il n'est ni affilié, ni approuvé, ni sponsorisé par The Pokémon Company International.

Les informations d'événements doivent toujours pouvoir être vérifiées auprès de la boutique, de la Ligue ou de la source officielle.
