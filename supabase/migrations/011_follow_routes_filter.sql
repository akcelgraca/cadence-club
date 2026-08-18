-- Add following-only filter to get_nearby_routes
-- When p_user_id is provided, only return routes from the user and users they follow.
-- When p_user_id is NULL (backward compatible), return all nearby routes.

CREATE OR REPLACE FUNCTION get_nearby_routes(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius INTEGER DEFAULT 50000,
  p_activity_type TEXT DEFAULT NULL,
  p_difficulty TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  description TEXT,
  city TEXT,
  country TEXT,
  activity_type TEXT,
  difficulty TEXT,
  surface_type TEXT,
  distance REAL,
  elevation_gain REAL,
  estimated_duration INTEGER,
  is_public BOOLEAN,
  usage_count INTEGER,
  rating_avg REAL,
  distance_meters DOUBLE PRECISION,
  user_id UUID,
  path_text TEXT,
  start_lng DOUBLE PRECISION,
  start_lat DOUBLE PRECISION,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id, r.name, r.description, r.city, r.country,
    r.activity_type, r.difficulty, r.surface_type,
    r.distance, r.elevation_gain, r.estimated_duration,
    r.is_public, r.usage_count, r.rating_avg,
    ST_Distance(r.start_point, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::GEOGRAPHY) AS distance_meters,
    r.user_id,
    ST_AsText(r.path::GEOMETRY) AS path_text,
    ST_X(r.start_point::GEOMETRY) AS start_lng,
    ST_Y(r.start_point::GEOMETRY) AS start_lat,
    r.created_at,
    r.updated_at
  FROM public.routes r
  WHERE ST_DWithin(r.start_point, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::GEOGRAPHY, p_radius)
    AND (p_activity_type IS NULL OR r.activity_type = p_activity_type)
    AND (p_difficulty IS NULL OR r.difficulty = p_difficulty)
    AND (
      p_user_id IS NULL
      OR r.user_id = p_user_id
      OR r.user_id IN (SELECT following_id FROM public.follows WHERE follower_id = p_user_id)
    )
  ORDER BY distance_meters ASC;
END;
$$;
