# Modèle de données MVP

## users

- `id`
- `created_at`
- `email` nullable
- `display_name` nullable

Le MVP peut évoluer vers une authentification sans mot de passe.

## venues

- `id`
- `source`
- `source_venue_id`
- `league_id` nullable
- `name`
- `address`
- `city`
- `postal_code`
- `country_code`
- `latitude` nullable
- `longitude` nullable
- `source_url` nullable
- `last_seen_at`

Contrainte unique recommandée : `(source, source_venue_id)`.

## events

- `id`
- `source`
- `source_event_id`
- `venue_id`
- `title`
- `event_type`
- `starts_at`
- `ends_at` nullable
- `registration_url` nullable
- `source_url`
- `status`
- `content_hash`
- `first_seen_at`
- `last_seen_at`
- `missing_since` nullable
- `raw_payload` JSONB

Contrainte unique recommandée : `(source, source_event_id)`.

## event_revisions

Permet de comprendre pourquoi une notification de modification a été envoyée.

- `id`
- `event_id`
- `detected_at`
- `previous_hash`
- `new_hash`
- `changes` JSONB

## venue_follows

- `user_id`
- `venue_id`
- `created_at`

Contrainte unique : `(user_id, venue_id)`.

## notification_preferences

- `user_id`
- `event_types` JSONB
- `new_event_enabled`
- `event_update_enabled`
- `reminder_enabled`
- `reminder_hours_before`

## push_subscriptions

- `id`
- `user_id`
- `endpoint`
- `p256dh`
- `auth`
- `created_at`
- `last_success_at` nullable

## notifications

- `id`
- `user_id`
- `event_id`
- `kind`
- `created_at`
- `sent_at` nullable
- `opened_at` nullable
- `deduplication_key`

Une contrainte unique sur `deduplication_key` évite les doublons.
