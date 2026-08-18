-- ============================================================
-- 005_weekly_daily_breakdown.sql
-- RPC to return per-day distance for the current week (Mon-Sun)
-- ============================================================

CREATE OR REPLACE FUNCTION get_weekly_daily_breakdown(p_user_id UUID)
RETURNS TABLE(
  day_of_week INTEGER,
  total_distance REAL
) AS $$
DECLARE
  v_week_start DATE;
BEGIN
  v_week_start := date_trunc('week', NOW()::DATE)::DATE;

  RETURN QUERY
  SELECT
    g.day_of_week,
    COALESCE(SUM(a.distance), 0)::REAL
  FROM generate_series(0, 6) AS g(day_of_week)
  LEFT JOIN public.activities a
    ON a.user_id = p_user_id
    AND a.start_time::DATE = (v_week_start + g.day_of_week)
  GROUP BY g.day_of_week
  ORDER BY g.day_of_week;
END;
$$ LANGUAGE plpgsql;
