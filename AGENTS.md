# Poké Event Alert — guide de travail des agents

Ce document décrit l’architecture et les contraintes opérationnelles actuelles. Le projet est une PWA communautaire pour les joueurs Play! Pokémon, indépendante de The Pokémon Company International.

## Objectif et services

- Application publique : <https://coeyn.github.io/poke-event-alert/>
- API publique : <https://nasmaine22.synology.me:8443>
- Monorepo npm : `apps/web` (Next.js 16, React 19, export statique GitHub Pages), `apps/api` (Fastify/PostgreSQL/worker Push) et `packages/pokedata-normalization` (normalisation partagée).
- PokéData est la source des événements. Le Synology dispose de 512 Mo de RAM environ.

## Chargement des données : garder l’architecture hybride

1. Les listes générales d’événements et de boutiques lisent `apps/web/public/data/events.json`, généré et publié par GitHub Actions/CDN toutes les 30 minutes (`7,37 * * * *`).
2. L’ouverture d’une boutique demande uniquement cette boutique et ses événements futurs à l’API.
3. Les compteurs de boutiques utilisent `POST /venues/counts` en lots, seulement pour les boutiques suivies ou après une recherche.
4. Cache navigateur des données live : 60 secondes. Le snapshot demeure disponible lorsque le NAS ne répond pas.

Ne chargez pas tous les événements français du NAS depuis le navigateur. N’ajoutez pas de polling national ni de timers fréquents.

## Routes web actuelles

- `/` — accueil : mini-calendrier, événements à venir et événements ajoutés récemment.
- `/boutiques/` — recherche et liste des boutiques.
- `/explorer/` — recherche combinée événements/boutiques et filtres.
- `/calendrier/` — événements des boutiques suivies et, avec position/rayon, événements proches.
- `/mes-boutiques/` — compte Firebase, profil Play!, amis, présences et boutiques suivies.
- `/boutique/?key=...` — détail boutique, mise à jour live ciblée et fallback snapshot.
- `/tournoi/?id=...` — détail événement, prix, présence, lien source et export ICS.
- `/reglages/` — types d’alertes, découverte locale, boutiques bloquées et Push.

## Fonctionnalités à préserver

- PWA, service worker, navigation mobile et chemins GitHub Pages avec base `/poke-event-alert`.
- Favoris locaux avec synchronisation API, boutiques bloquées, calendrier et export `.ics`.
- Firebase Authentication (Google et email/mot de passe), profil public Play!, amis et présence événement.
- Notifications Web Push NEW/UPDATED, abonnement/désabonnement, test et ouverture depuis notification.
- Snapshot statique, fallback API hors ligne, CORS Pages et compteurs groupés.
- Le prix provient notamment du champ PokéData `cost`; une valeur zéro s’affiche « Gratuit ».
- La classification Session Play/Tournoi est partagée : friendly/échange/apprentissage devient Session Play; un événement non-premier/tournoi avec coût renseigné reste Tournoi (y compris coût zéro), sans coût devient Session Play. Ne changez pas cette règle sans demande explicite.
- MISSING n’est pas automatiquement une annulation.
- Garder le disclaimer d’indépendance/non-affiliation.

## Normalisation PokéData

`packages/pokedata-normalization/index.js` et ses déclarations/types tests sont la source commune pour les identifiants, types, jeux, dates (heure locale Europe/Paris si sans fuseau), coût et données boutique. Les adaptateurs API et snapshot peuvent adapter les formats de sortie ou les alias propres à un endpoint, mais ne dupliquent pas la classification.

## Firebase et communauté

- `firestore.rules` protège `users`, `publicProfiles`, `playIdRegistry`, `friendLinks` et `eventAttendance`.
- L’identifiant Play! est réservé en minuscules dans `playIdRegistry` dans la même transaction que `publicProfiles/{uid}`. Les règles vérifient la réservation via `getAfter`.
- Les utilisateurs peuvent lire les profils publics authentifiés; chaque propriétaire ne modifie que son profil. Les liens d’amitié ont deux membres triés, sont créés en attente et seul le destinataire répond. Les présences sont écrites/supprimées par leur propriétaire et visibles par ses amis acceptés.
- Après toute modification des règles, les publier avec `firebase deploy --only firestore:rules --project poke-event-alert` depuis le dépôt (CLI Firebase authentifié).
- L’UI de compte propose la réinitialisation du mot de passe et la suppression des données Firestore accessibles du compte. La suppression Auth requiert une nouvelle authentification. Ne jamais publier de config secrète; la config Firebase web publique reste dans les variables `NEXT_PUBLIC_FIREBASE_*`.

## Notifications et compatibilité

Les préférences distinguent `challenge`, `cup`, `prerelease`, `session_play`, `tournament` et `other`. Le backend conserve `other` pour les types non classés. Les anciennes préférences contenant `other` reçoivent `session_play` et `tournament` lors de la migration idempotente `0003_notification_event_types.sql`. Les nouveaux réglages manquants héritent de l’ancien booléen `other`.

## Développement et validation

Depuis la racine :

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
npm run dev
```

Les tests Playwright utilisent des fixtures et un faux endpoint API; ils ne nécessitent pas de compte Firebase. Le build Pages exporte les routes et doit être vérifié avec `GITHUB_PAGES=true` et `NEXT_PUBLIC_BASE_PATH=/poke-event-alert`.

## Déploiements

- `.github/workflows/ci.yml` est la validation réutilisable et s’exécute sur push, PR et avant Pages/conteneur. Elle lance lint, normalisation, typechecks/tests API, migrations et intégration PostgreSQL, Playwright, snapshot, build web et validation/build Docker.
- `.github/workflows/pages.yml` garde le cron toutes les 30 minutes, puis régénère les données, construit et déploie Pages après succès CI.
- `.github/workflows/container.yml` ne publie l’image API après succès CI. Elle produit `linux/arm64`, tags `latest` et SHA du commit.
- L’API contient une nouvelle migration SQL idempotente. Sur NAS, déployer le tag SHA publié; le démarrage API lance les migrations via le compose/entrypoint configuré. Vérifier le compose avant toute modification.
- Une modification web seulement ne requiert pas de déploiement NAS. Une modification API requiert publication GHCR puis mise à jour/redémarrage du service sur NAS.

## Sécurité et méthode

- Ne jamais lire/afficher les fichiers `.env`, clés privées VAPID ou mots de passe de base de données. Ne jamais les committer.
- Avant une modification de contrat API, inspecter routes, schéma SQL et tests d’intégration.
- Garder les changements ciblés; pas de refonte CSS globale pour une tâche de consolidation.
- Après un bloc significatif, exécuter lint, typecheck et tests pertinents; avant livraison, lancer build statique et e2e.
