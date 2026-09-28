CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  source_venue_id text NOT NULL,
  league_id text,
  name text NOT NULL,
  address text,
  city text,
  postal_code text,
  country_code text,
  latitude double precision,
  longitude double precision,
  source_url text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_venue_id)
);

CREATE INDEX IF NOT EXISTS venues_league_id_idx ON venues (league_id);
CREATE INDEX IF NOT EXISTS venues_city_idx ON venues (city);

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  source_event_id text NOT NULL,
  venue_id uuid REFERENCES venues(id) ON DELETE SET NULL,
  title text NOT NULL,
  event_type text,
  game text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  registration_url text,
  source_url text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'missing', 'cancelled')),
  content_hash text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  missing_since timestamptz,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (source, source_event_id)
);

CREATE INDEX IF NOT EXISTS events_starts_at_idx ON events (starts_at);
CREATE INDEX IF NOT EXISTS events_venue_id_idx ON events (venue_id);
CREATE INDEX IF NOT EXISTS events_source_status_idx ON events (source, status);

CREATE TABLE IF NOT EXISTS event_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  detected_at timestamptz NOT NULL DEFAULT now(),
  previous_hash text NOT NULL,
  new_hash text NOT NULL,
  changes jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS event_revisions_event_id_idx
  ON event_revisions (event_id, detected_at DESC);

CREATE TABLE IF NOT EXISTS venue_follows (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, venue_id)
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  event_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  new_event_enabled boolean NOT NULL DEFAULT true,
  event_update_enabled boolean NOT NULL DEFAULT true,
  reminder_enabled boolean NOT NULL DEFAULT false,
  reminder_hours_before integer NOT NULL DEFAULT 24
    CHECK (reminder_hours_before > 0)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_success_at timestamptz
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('new_event', 'event_updated', 'reminder', 'event_missing')),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  opened_at timestamptz,
  deduplication_key text NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON notifications (user_id, created_at DESC);
