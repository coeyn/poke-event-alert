# Poké Event Alert

> Ne plus rater un événement Play! Pokémon parce qu'il a été publié sans notification.

Poké Event Alert est un projet communautaire destiné aux joueurs Play! Pokémon qui souhaitent suivre leurs boutiques et Ligues favorites et être alertés lorsqu'un nouvel événement est publié ou modifié.

- PWA : `https://coeyn.github.io/poke-event-alert/`
- API publique : `https://nasmaine22.synology.me:8443`

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

Le périmètre exact dépend des données réellement disponibles dans les sources utilisées.

## Principes produit

1. **Alert-first** — l'utilisateur ne doit plus avoir à penser à vérifier.
2. **Source visible** — chaque événement doit indiquer d'où vient l'information.
3. **Pas de faux niveau de certitude** — un événement supprimé de la source sera signalé comme potentiellement annulé jusqu'à confirmation.
4. **Favoris simples** — suivre une boutique doit prendre quelques secondes.
5. **Mobile d'abord** — l'interface est pensée comme une PWA installable.

## Architecture

Le dépôt est organisé en monorepo :

```text
apps/
  web/        PWA utilisateur
  api/        API, ingestion, détection de changements et notifications

docs/
  PRODUCT.md
  ARCHITECTURE.md
  DATA_MODEL.md
```

Stack actuelle :

- TypeScript
- Frontend PWA : Next.js / React, export statique sur GitHub Pages
- API : Node.js / Fastify
- Base : PostgreSQL
- Worker d'ingestion / notifications
- Web Push
- export iCalendar (`.ics`)

La source d'événements est isolée derrière des adaptateurs afin de pouvoir changer de fournisseur sans réécrire l'application.

### Chargement web hybride

Le Synology qui héberge l'API est volontairement protégé contre la charge publique :

- les listes générales d'événements et de boutiques utilisent un snapshot statique servi par GitHub Pages/CDN ;
- le snapshot est régénéré toutes les 30 minutes ;
- une fiche boutique recharge uniquement cette boutique et ses événements depuis l'API ;
- les compteurs live sont récupérés de façon groupée et sélective ;
- le snapshot reste utilisable si l'API est temporairement indisponible.

## Flux principal

```text
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

Le MVP est déjà fonctionnel sur plusieurs briques :

- ingestion et stockage PostgreSQL ;
- API événements / boutiques ;
- PWA mobile-first ;
- recherche et suivi de boutiques ;
- synchronisation des favoris avec le backend ;
- notifications Web Push et bouton de test ;
- alertes NEW / UPDATED ;
- détail événement / boutique ;
- export iCalendar ;
- déploiement GitHub Pages ;
- déploiement Synology ARM64 via image GHCR.

Le chantier en cours concerne notamment **l'ergonomie et la refonte visuelle du frontend**.

### Pour les agents de code / Codex

Lire **[`AGENTS.md`](AGENTS.md)** avant de modifier le projet. Il contient le contexte opérationnel actuel, les contraintes de charge du NAS, la stratégie statique/live à préserver et les priorités UX de la refonte frontend.

Voir aussi :

- [Vision produit](docs/PRODUCT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Modèle de données](docs/DATA_MODEL.md)

## Avertissement

Poké Event Alert est un projet communautaire indépendant. Il n'est ni affilié, ni approuvé, ni sponsorisé par The Pokémon Company International.

Les informations d'événements doivent toujours pouvoir être vérifiées auprès de la boutique, de la Ligue ou de la source officielle.
