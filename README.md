# Poké Event Alert

> Ne plus rater un événement Play! Pokémon parce qu'il a été publié sans notification.

Poké Event Alert est un projet communautaire destiné aux joueurs Play! Pokémon qui souhaitent suivre leurs boutiques et Ligues favorites et être alertés lorsqu'un nouvel événement est publié ou modifié.

- PWA : `https://coeyn.github.io/poke-event-alert/`
- API publique : `https://nasmaine22.synology.me:8443`

## Problème

Aujourd'hui, les joueurs doivent penser à consulter régulièrement le localisateur d'événements et les communications propres à chaque boutique. Plusieurs joueurs peuvent ainsi découvrir trop tard un League Challenge, une League Cup, une Avant-première ou un autre événement.

Le produit ne cherche donc pas à être un simple clone du localisateur : **la fonction principale est l'abonnement et l'alerte**.

## Fonctionnalités

- Accueil avec mini-calendrier, événements à venir et nouveautés.
- Explorer regroupe la recherche d'événements et de boutiques; `/boutiques/` reste disponible pour parcourir les boutiques.
- Calendrier filtré sur les boutiques suivies et, au choix, sur les événements proches de la position du joueur.
- Suivi et blocage de boutiques, compteurs d'événements à venir et filtres par type.
- Détail événement avec type, jeu, boutique, horaire, prix (dont « Gratuit ») et export iCalendar.
- Alertes Web Push NEW/UPDATED, réglables par League Challenge, League Cup, Avant-première, Session Play, Tournoi et autres événements.
- Compte Firebase Google ou email/mot de passe; profil Play!, demandes d’amitié et présence aux événements.
- Les données non connectées restent utilisables localement. Favoris, boutiques bloquées et préférences peuvent être synchronisés avec Firebase.

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
- Firebase Authentication / Firestore pour comptes et fonctions communautaires
- normalisation PokéData partagée par `packages/pokedata-normalization`

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

Les événements sont normalisés par le même module partagé dans le snapshot et l'API live. Une heure PokéData sans fuseau est interprétée en heure de Paris. Les événements amicaux (échange, apprentissage, Session Play) restent distincts des tournois. Un tournoi à coût `0` est gratuit; un coût absent correspond à une Session Play pour les types tournoi/non-premier.

## Routes

| URL | Contenu |
| --- | --- |
| `/` | Accueil et prochaines dates |
| `/explorer/` | Recherche événements et boutiques |
| `/boutiques/` | Parcours des boutiques |
| `/calendrier/` | Calendrier personnalisé |
| `/mes-boutiques/` | Compte, profil joueur, amis, présences et favoris |
| `/boutique/?key=...` | Détail boutique avec rafraîchissement live ciblé |
| `/tournoi/?id=...` | Détail événement et export `.ics` |
| `/reglages/` | Types Push, rayon, position et boutiques bloquées |

## Firebase

Firebase Authentication prend en charge Google et email/mot de passe, dont l'envoi d'un lien de réinitialisation. Les règles Firestore du dépôt protègent les profils, réservations d'identifiant Play!, liens d'amitié et présences. Après avoir vérifié les doublons existants, la réservation initiale des IDs doit être faite par une identité Admin Firebase, puis les règles publiées :

```bash
npm run firebase:migrate-play-ids
firebase deploy --only firestore:rules --project poke-event-alert
```

La commande de migration utilise les Application Default Credentials ou `GOOGLE_APPLICATION_CREDENTIALS` vers un compte de service qui a accès Firestore. N’ajoute jamais ce fichier au dépôt. Elle s’arrête et signale les profils en doublon pour qu’ils soient résolus avant l’activation de l’unicité.

Les variables de build web `NEXT_PUBLIC_FIREBASE_*` sont publiques (configuration cliente Firebase), et peuvent être définies comme variables GitHub Actions. Les clés VAPID privées et les accès PostgreSQL restent exclusivement dans les variables/secrets serveur.

## Démarrage local

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run --workspace @poke-event-alert/api test:integration
npm run --workspace @poke-event-alert/web preview:data
npm run --workspace @poke-event-alert/web build
npx playwright install chromium
npm run test:e2e
npm run --workspace @poke-event-alert/web dev
```

Ouvrir `http://localhost:3000`. Le snapshot local est régénéré par `preview:data` et n'est pas versionné. Les tests Playwright utilisent des fixtures et un faux endpoint; aucun compte Firebase n'est requis.

### Pour les agents de code / Codex

Lire **[`AGENTS.md`](AGENTS.md)** avant de modifier le projet. Il documente les routes et fonctionnalités courantes, les règles de normalisation, les contraintes de charge du NAS et le flux de déploiement.

Voir aussi :

- [Vision produit](docs/PRODUCT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Modèle de données](docs/DATA_MODEL.md)

## Avertissement

Poké Event Alert est un projet communautaire indépendant. Il n'est ni affilié, ni approuvé, ni sponsorisé par The Pokémon Company International.

Les informations d'événements doivent toujours pouvoir être vérifiées auprès de la boutique, de la Ligue ou de la source officielle.
