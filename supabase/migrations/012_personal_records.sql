-- Get personal records (best pace) for standard distance categories
CREATE OR REPLACE FUNCTION get_personal_records(p_user_id UUID)
RETURNS TABLE(
  distance_category TEXT,
  best_pace DOUBLE PRECISION,
  best_duration INTEGER,
  activity_id UUID,
  achieved_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH ranked AS (
    SELECT
      CASE
        WHEN a.distance BETWEEN 800 AND 1500 THEN '1 km'
        WHEN a.distance BETWEEN 4500 AND 6000 THEN '5 km'
        WHEN a.distance BETWEEN 9000 AND 12000 THEN '10 km'
        WHEN a.distance BETWEEN 20000 AND 22000 THEN 'Meia'
        ELSE NULL
      END AS dist_cat,
      a.avg_pace,
      a.duration,
      a.id AS act_id,
      a.start_time,
      ROW_NUMBER() OVER (
        PARTITION BY
          CASE
            WHEN a.distance BETWEEN 800 AND 1500 THEN '1 km'
            WHEN a.distance BETWEEN 4500 AND 6000 THEN '5 km'
            WHEN a.distance BETWEEN 9000 AND 12000 THEN '10 km'
            WHEN a.distance BETWEEN 20000 AND 22000 THEN 'Meia'
          END
        ORDER BY a.avg_pace ASC
      ) AS rn
    FROM public.activities a
    WHERE a.user_id = p_user_id
      AND a.distance > 0
      AND a.duration > 0
      AND a.avg_pace > 0
  )
  SELECT
    r.dist_cat AS distance_category,
    r.avg_pace AS best_pace,
    r.duration AS best_duration,
    r.act_id AS activity_id,
    r.start_time AS achieved_at
  FROM ranked r
  WHERE r.dist_cat IS NOT NULL AND r.rn = 1
  ORDER BY
    CASE r.dist_cat
      WHEN '1 km' THEN 1
      WHEN '5 km' THEN 2
      WHEN '10 km' THEN 3
      WHEN 'Meia' THEN 4
    END;
END;
$$;
