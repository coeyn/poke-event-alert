ALTER TABLE notification_preferences
  ADD COLUMN discovery_latitude double precision,
  ADD COLUMN discovery_longitude double precision,
  ADD COLUMN discovery_radius_km integer NOT NULL DEFAULT 0
    CHECK (discovery_radius_km BETWEEN 0 AND 200),
  ADD CONSTRAINT notification_discovery_coordinates_check CHECK (
    (discovery_latitude IS NULL AND discovery_longitude IS NULL)
    OR (
      discovery_latitude IS NOT NULL
      AND discovery_longitude IS NOT NULL
      AND
      discovery_latitude BETWEEN -90 AND 90
      AND discovery_longitude BETWEEN -180 AND 180
    )
  );

CREATE INDEX notification_preferences_discovery_radius_idx
  ON notification_preferences (discovery_radius_km)
  WHERE discovery_radius_km > 0;
