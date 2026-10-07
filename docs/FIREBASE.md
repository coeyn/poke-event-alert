# Configurer Firebase pour Poké Event Alert

L’application utilise Firebase Authentication pour les comptes e-mail/mot de passe et Cloud Firestore pour synchroniser les boutiques suivies, les boutiques bloquées et les filtres d’événements. La position GPS reste enregistrée localement sur chaque appareil.

## 1. Créer le projet Firebase

1. Ouvre [la console Firebase](https://console.firebase.google.com/) et crée un projet, par exemple `poke-event-alert`.
2. Dans **Authentication → Sign-in method**, active **E-mail/Mot de passe**.
3. Dans **Authentication → Settings → Authorized domains**, vérifie que `coeyn.github.io` est présent. Garde aussi `localhost` pour le développement.
4. Dans **Firestore Database**, crée une base Cloud Firestore. La région ne pourra pas être changée après sa création : choisis une région européenne proche, par exemple `europe-west1`.
5. Dans **Project settings → General → Your apps**, ajoute une application Web (icône `</>`), puis copie sa configuration.

## 2. Ajouter les clés au développement local

Copie `apps/web/.env.example` vers `apps/web/.env.local`, puis reporte les valeurs de la configuration Web dans les variables correspondantes. Redémarre ensuite le serveur avec `npm run --workspace @poke-event-alert/web dev`.

Ces paramètres Firebase côté navigateur identifient le projet, ils ne remplacent pas les règles d’accès. N’ajoute jamais de clé de compte de service ni de clé privée dans le site web.

## 3. Déployer les règles Firestore

Le fichier `firestore.rules` limite chaque compte à son document `users/{uid}`. Publie ces règles avec Firebase CLI depuis la racine du dépôt :

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules --project <ID_DU_PROJET>
```

Remplace `<ID_DU_PROJET>` par l’identifiant Firebase affiché dans les paramètres du projet. Après déploiement, crée un compte dans **Réglages → Compte et synchronisation**. À la première connexion, les données locales de cet appareil sont copiées vers Firestore. Les connexions suivantes chargent les données du compte.

## 4. Variables du site GitHub Pages

Pour activer Firebase sur le site publié, ajoute les sept variables `NEXT_PUBLIC_FIREBASE_*` comme variables de dépôt GitHub dans **Settings → Secrets and variables → Actions → Variables**. Le workflow Pages les transmet déjà à la commande de build et a les valeurs de ce projet en repli. Ces variables de configuration web sont publiques dans le navigateur ; les règles Firestore protègent les données. Ne publie pas `.env.local`.
