# Déploiement production

Poké Event Alert sépare :

- la PWA statique : GitHub Pages ;
- l'API Node.js ;
- PostgreSQL ;
- un worker qui récupère les événements et envoie les notifications Push.

Le backend est fourni sous forme Docker Compose et peut être exécuté sur un VPS ou un NAS compatible Docker / Container Manager.

## 1. Préparer les secrets

Copier le fichier d'exemple :

```bash
cp .env.production.example .env.production
```

Choisir un mot de passe PostgreSQL long et aléatoire.

Générer les clés VAPID :

```bash
npx web-push generate-vapid-keys
```

Renseigner :

- `WEB_PUSH_PUBLIC_KEY`
- `WEB_PUSH_PRIVATE_KEY`
- `WEB_PUSH_SUBJECT`

Ne jamais committer `.env.production`.

## 2. Lancer les conteneurs

```bash
docker compose \
  --env-file .env.production \
  -f docker-compose.prod.yml \
  up -d --build
```

Le compose démarre quatre services :

- `postgres` : base persistante ;
- `migrate` : applique les migrations puis s'arrête ;
- `api` : sert l'API HTTP sur le port 3001 par défaut ;
- `worker` : ingestion PokéData + notifications, toutes les heures par défaut.

Vérification locale :

```bash
curl http://127.0.0.1:3001/health
```

Réponse attendue :

```json
{"ok":true}
```

## 3. Exposer l'API en HTTPS

Web Push et la PWA nécessitent une API publique en HTTPS.

Utiliser un reverse proxy (Synology Reverse Proxy, Caddy, nginx, Traefik, etc.) avec par exemple :

```
https://api.votre-domaine.fr
        ↓
http://127.0.0.1:3001
```

Le certificat TLS doit être valide.

Dans `.env.production`, conserver :

```env
PUBLIC_WEB_URL=https://coeyn.github.io/poke-event-alert
CORS_ORIGINS=https://coeyn.github.io
```

Ne pas mettre le chemin `/poke-event-alert` dans `CORS_ORIGINS` : CORS travaille sur l'origine (schéma + domaine + port).

## 4. Relier GitHub Pages au backend

Dans le dépôt GitHub :

`Settings → Secrets and variables → Actions → Variables`

Créer :

```
NEXT_PUBLIC_API_URL=https://api.votre-domaine.fr
```

Puis relancer le workflow **Deploy web preview**.

Le build GitHub Pages injectera cette URL dans la PWA. La page Réglages proposera alors l'activation réelle des notifications.

## 5. Vérifier le flux Push

1. ouvrir la PWA ;
2. suivre une boutique ;
3. ouvrir Réglages ;
4. enregistrer les types d'événements ;
5. activer les notifications ;
6. vérifier qu'un enregistrement apparaît dans `push_subscriptions` ;
7. lancer une ingestion ;
8. lancer l'envoi des notifications.

Commandes manuelles :

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec api \
  node apps/api/dist/cli/ingest-pokedata.js

docker compose --env-file .env.production -f docker-compose.prod.yml exec api \
  node apps/api/dist/cli/send-notifications.js
```

## 6. Sauvegarder PostgreSQL

Exemple :

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U poke_event_alert poke_event_alert > poke-event-alert-backup.sql
```

Restauration sur une base vide :

```bash
cat poke-event-alert-backup.sql | \
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres \
  psql -U poke_event_alert poke_event_alert
```

Prévoir ensuite une sauvegarde automatisée du volume ou un `pg_dump` régulier.

## 7. Mise à jour

Après un nouveau merge :

```bash
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Le service `migrate` applique les migrations avant le redémarrage de l'API et du worker.
