-- Search routes by text query matching name, city, or creator's full_name.
-- When p_user_id is provided, only return routes from the user and users they follow.
-- When p_user_id is NULL, return all matching routes.

CREATE OR REPLACE FUNCTION search_routes(
  p_query TEXT,
  p_user_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 20
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
  updated_at TIMESTAMPTZ,
  creator_name TEXT,
  creator_username TEXT
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
    0::DOUBLE PRECISION AS distance_meters,
    r.user_id,
    ST_AsText(r.path::GEOMETRY) AS path_text,
    ST_X(r.start_point::GEOMETRY) AS start_lng,
    ST_Y(r.start_point::GEOMETRY) AS start_lat,
    r.created_at,
    r.updated_at,
    p.full_name AS creator_name,
    p.username AS creator_username
  FROM public.routes r
  LEFT JOIN public.profiles p ON r.user_id = p.id
  WHERE (
    r.name ILIKE '%' || p_query || '%'
    OR r.city ILIKE '%' || p_query || '%'
    OR p.full_name ILIKE '%' || p_query || '%'
  )
  AND (
    p_user_id IS NULL
    OR r.user_id = p_user_id
    OR r.user_id IN (SELECT following_id FROM public.follows WHERE follower_id = p_user_id)
  )
  ORDER BY r.usage_count DESC, r.rating_avg DESC
  LIMIT p_limit;
END;
$$;
