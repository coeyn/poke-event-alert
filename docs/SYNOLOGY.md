# Installation Synology DS220j

Cette variante est optimisée pour le DS220j et ses 512 Mo de RAM.

Elle utilise seulement deux services permanents :

- PostgreSQL avec des réglages mémoire réduits ;
- Poké Event Alert (API + synchronisation + envoi des notifications dans un seul processus Node).

L'image Node est construite par GitHub Actions en ARM64/AMD64. Le NAS ne compile rien.

## Fichiers à placer dans le dossier du projet

- `docker-compose.synology.yml`
- `.env.synology.example` copié sous le nom `.env`

## Container Manager

Dans DSM :

1. ouvrir **Container Manager** ;
2. aller dans **Projet** ;
3. cliquer **Créer** ;
4. nom : `poke-event-alert` ;
5. choisir le dossier du projet ;
6. choisir le fichier Compose ;
7. lancer le projet.

L'API écoute localement sur le port `3001`.

Test local :

`http://IP_DU_NAS:3001/health`

La réponse attendue est :

`{"ok":true}`

## Reverse proxy DSM

Créer une règle dans :

**Panneau de configuration → Portail de connexion → Avancé → Proxy inversé**

Source :
- protocole : HTTPS
- nom d'hôte : votre nom DDNS/API
- port : 443

Destination :
- protocole : HTTP
- nom d'hôte : localhost
- port : 3001

Associer un certificat Let's Encrypt valide au nom d'hôte.

## GitHub Pages

Quand l'API est joignable publiquement en HTTPS, créer dans GitHub :

**Settings → Secrets and variables → Actions → Variables**

`NEXT_PUBLIC_API_URL=https://VOTRE_HOTE_API`

Puis relancer le workflow **Deploy web preview**.
