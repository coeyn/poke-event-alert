# API HTTP — MVP

Base locale par défaut : `http://localhost:3001`.

## Événements

### `GET /events`

Retourne uniquement les événements actifs.

Paramètres :

- `from` — date/heure ISO, défaut : maintenant ;
- `to` — date/heure ISO ;
- `eventType` — un ou plusieurs types séparés par des virgules ;
- `game` — un ou plusieurs jeux séparés par des virgules ;
- `countryCode` — code pays Alpha-2 ;
- `venueId` — UUID de la boutique ;
- `limit` — défaut 25, maximum 100 ;
- `offset` — défaut 0.

### `GET /events/:id`

Retourne un événement, y compris son statut courant. Un événement `missing` reste donc consultable depuis une ancienne notification, même s'il n'apparaît plus dans les listes actives.

## Boutiques / Ligues

### `GET /venues`

Recherche dans le nom, la ville, le League ID, l'adresse et le code postal.

Paramètres :

- `search`
- `countryCode`
- `limit`
- `offset`

Chaque résultat contient `upcomingEventCount`.

### `GET /venues/:id`

Détail d'une boutique / Ligue.

### `GET /venues/:id/events`

Événements actifs à venir de cette boutique.

## Utilisateur MVP

L'authentification n'est pas encore implémentée. Le MVP technique utilise explicitement l'UUID utilisateur dans l'URL.

### `POST /users`

Corps optionnel :

```json
{
  "email": "joueur@example.com",
  "displayName": "Joueur"
}
```

### Favoris

- `GET /users/:userId/follows`
- `POST /users/:userId/follows/:venueId`
- `DELETE /users/:userId/follows/:venueId`

### Préférences

- `GET /users/:userId/preferences`
- `PUT /users/:userId/preferences`

Exemple de remplacement des préférences :

```json
{
  "eventTypes": ["challenge", "cup"],
  "newEventEnabled": true,
  "eventUpdateEnabled": true,
  "reminderEnabled": true,
  "reminderHoursBefore": 12
}
```

## Pagination

Les listes paginées utilisent :

```json
{
  "items": [],
  "pagination": {
    "limit": 25,
    "offset": 0,
    "total": 0,
    "hasMore": false
  }
}
```

## Erreurs

Les erreurs courantes sont normalisées :

- `400` — identifiant ou paramètre invalide ;
- `404` — ressource référencée absente ;
- `409` — conflit / ressource déjà existante ;
- `500` — erreur interne non prévue.
