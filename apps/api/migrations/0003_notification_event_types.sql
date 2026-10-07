-- Preserve the historical meaning of "other" for users who saved preferences
-- before Session Play and Tournament became individually selectable.
UPDATE notification_preferences
SET event_types = (
  SELECT COALESCE(jsonb_agg(DISTINCT expanded.value), '[]'::jsonb)
  FROM jsonb_array_elements(event_types || '["session_play", "tournament"]'::jsonb) AS expanded(value)
)
WHERE event_types ? 'other';
