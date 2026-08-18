-- ============================================================
-- 014_enrich_weekly_breakdown.sql
-- Enrich get_weekly_daily_breakdown with duration & activity count
-- ============================================================

DROP FUNCTION IF EXISTS get_weekly_daily_breakdown(UUID);

CREATE OR REPLACE FUNCTION get_weekly_daily_breakdown(p_user_id UUID)
RETURNS TABLE(
  day_of_week INTEGER,
  total_distance REAL,
  total_duration REAL,
  activity_count BIGINT
) AS $$
DECLARE
  v_week_start DATE;
BEGIN
  v_week_start := date_trunc('week', NOW()::DATE)::DATE;

  RETURN QUERY
  SELECT
    g.day_of_week,
    COALESCE(SUM(a.distance), 0)::REAL,
    COALESCE(SUM(a.duration), 0)::REAL,
    COUNT(a.id)
  FROM generate_series(0, 6) AS g(day_of_week)
  LEFT JOIN public.activities a
    ON a.user_id = p_user_id
    AND a.start_time::DATE = (v_week_start + g.day_of_week)
  GROUP BY g.day_of_week
  ORDER BY g.day_of_week;
END;
$$ LANGUAGE plpgsql;
