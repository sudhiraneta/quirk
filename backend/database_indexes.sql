-- CRITICAL INDEXES FOR FAST QUERIES
-- Run these in Supabase SQL Editor to massively speed up queries

-- Index on user_uuid + last_visit for metrics queries (CRITICAL)
CREATE INDEX IF NOT EXISTS idx_browsing_user_visit
ON browsing_history(user_uuid, last_visit DESC);

-- Index on user_uuid alone for user lookups
CREATE INDEX IF NOT EXISTS idx_browsing_user
ON browsing_history(user_uuid);

-- Index on Pinterest pins
CREATE INDEX IF NOT EXISTS idx_pinterest_user_created
ON pinterest_pins(user_uuid, collected_at DESC);

-- Index on analyses
CREATE INDEX IF NOT EXISTS idx_analyses_user_created
ON analyses(user_uuid, created_at DESC);

-- Composite index for fast filtering
CREATE INDEX IF NOT EXISTS idx_browsing_platform_category
ON browsing_history(platform, category);

-- Auto-delete old data (7 days) - runs daily
CREATE OR REPLACE FUNCTION delete_old_browsing_data()
RETURNS void AS $$
BEGIN
  DELETE FROM browsing_history
  WHERE last_visit < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (if using pg_cron extension)
-- SELECT cron.schedule('cleanup-old-data', '0 2 * * *', 'SELECT delete_old_browsing_data()');
