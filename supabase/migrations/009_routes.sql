-- Routes table with PostGIS geometry
CREATE TABLE public.routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  city TEXT NOT NULL,
  country TEXT,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('run', 'cycle', 'walk')),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'moderate', 'hard', 'expert')),
  surface_type TEXT NOT NULL CHECK (surface_type IN ('road', 'trail', 'mixed', 'track')),
  distance REAL NOT NULL, -- meters
  elevation_gain REAL DEFAULT 0, -- meters
  estimated_duration INTEGER, -- seconds
  is_public BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  rating_avg REAL DEFAULT 0,
  -- PostGIS geometry for the full route path
  path GEOGRAPHY(LINESTRING, 4326) NOT NULL,
  -- Starting point for proximity queries
  start_point GEOGRAPHY(POINT, 4326) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Route waypoints (named points along the route: water fountains, viewpoints, etc.)
CREATE TABLE public.route_waypoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('water', 'viewpoint', 'restroom', 'parking', 'cafe', 'landmark', 'start', 'finish', 'custom')),
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_routes_city ON public.routes(city);
CREATE INDEX idx_routes_difficulty ON public.routes(difficulty);
CREATE INDEX idx_routes_activity_type ON public.routes(activity_type);
CREATE INDEX idx_routes_start_point ON public.routes USING GIST(start_point);
CREATE INDEX idx_routes_path ON public.routes USING GIST(path);
CREATE INDEX idx_route_waypoints_route ON public.route_waypoints(route_id);
CREATE INDEX idx_route_waypoints_location ON public.route_waypoints USING GIST(location);

-- RLS
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_waypoints ENABLE ROW LEVEL SECURITY;

-- Policies: anyone can read routes, owner can CRUD
CREATE POLICY "Routes are viewable by everyone" ON public.routes FOR SELECT USING (true);
CREATE POLICY "Users can create routes" ON public.routes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own routes" ON public.routes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own routes" ON public.routes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Waypoints viewable by everyone" ON public.route_waypoints FOR SELECT USING (true);
CREATE POLICY "Users can manage waypoints of own routes" ON public.route_waypoints
  FOR ALL USING (EXISTS (SELECT 1 FROM public.routes WHERE id = route_waypoints.route_id AND user_id = auth.uid()));

-- RPC: Get nearby routes within radius (meters)
CREATE OR REPLACE FUNCTION get_nearby_routes(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius INTEGER DEFAULT 50000, -- default 50km
  p_activity_type TEXT DEFAULT NULL,
  p_difficulty TEXT DEFAULT NULL
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
  ORDER BY distance_meters ASC;
END;
$$;

-- RPC: Get a single route by ID (with geometry parsed as WKT)
CREATE OR REPLACE FUNCTION get_route_by_id(p_route_id UUID)
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
    r.user_id,
    ST_AsText(r.path::GEOMETRY) AS path_text,
    ST_X(r.start_point::GEOMETRY) AS start_lng,
    ST_Y(r.start_point::GEOMETRY) AS start_lat,
    r.created_at,
    r.updated_at
  FROM public.routes r
  WHERE r.id = p_route_id;
END;
$$;

-- RPC: Create a route with PostGIS geometry
CREATE OR REPLACE FUNCTION create_route(
  p_name TEXT,
  p_description TEXT,
  p_city TEXT,
  p_country TEXT,
  p_activity_type TEXT,
  p_difficulty TEXT,
  p_surface_type TEXT,
  p_distance REAL,
  p_elevation_gain REAL,
  p_estimated_duration INTEGER,
  p_is_public BOOLEAN,
  p_path_wkt TEXT,
  p_start_lng DOUBLE PRECISION,
  p_start_lat DOUBLE PRECISION
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
DECLARE
  v_user_id UUID := auth.uid();
  v_route_id UUID;
BEGIN
  INSERT INTO public.routes (
    user_id, name, description, city, country,
    activity_type, difficulty, surface_type,
    distance, elevation_gain, estimated_duration, is_public,
    path, start_point
  ) VALUES (
    v_user_id, p_name, p_description, p_city, p_country,
    p_activity_type, p_difficulty, p_surface_type,
    p_distance, p_elevation_gain, p_estimated_duration, p_is_public,
    ST_GeomFromText(p_path_wkt, 4326)::GEOGRAPHY,
    ST_SetSRID(ST_MakePoint(p_start_lng, p_start_lat), 4326)::GEOGRAPHY
  )
  RETURNING public.routes.id INTO v_route_id;

  RETURN QUERY SELECT * FROM get_route_by_id(v_route_id);
END;
$$;

-- RPC: Update a route
CREATE OR REPLACE FUNCTION update_route(
  p_route_id UUID,
  p_name TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_country TEXT DEFAULT NULL,
  p_activity_type TEXT DEFAULT NULL,
  p_difficulty TEXT DEFAULT NULL,
  p_surface_type TEXT DEFAULT NULL,
  p_distance REAL DEFAULT NULL,
  p_elevation_gain REAL DEFAULT NULL,
  p_estimated_duration INTEGER DEFAULT NULL,
  p_is_public BOOLEAN DEFAULT NULL,
  p_path_wkt TEXT DEFAULT NULL,
  p_start_lng DOUBLE PRECISION DEFAULT NULL,
  p_start_lat DOUBLE PRECISION DEFAULT NULL
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
  UPDATE public.routes SET
    name = COALESCE(p_name, public.routes.name),
    description = COALESCE(p_description, public.routes.description),
    city = COALESCE(p_city, public.routes.city),
    country = COALESCE(p_country, public.routes.country),
    activity_type = COALESCE(p_activity_type, public.routes.activity_type),
    difficulty = COALESCE(p_difficulty, public.routes.difficulty),
    surface_type = COALESCE(p_surface_type, public.routes.surface_type),
    distance = COALESCE(p_distance, public.routes.distance),
    elevation_gain = COALESCE(p_elevation_gain, public.routes.elevation_gain),
    estimated_duration = COALESCE(p_estimated_duration, public.routes.estimated_duration),
    is_public = COALESCE(p_is_public, public.routes.is_public),
    path = CASE WHEN p_path_wkt IS NOT NULL
      THEN ST_GeomFromText(p_path_wkt, 4326)::GEOGRAPHY
      ELSE public.routes.path
    END,
    start_point = CASE WHEN p_start_lng IS NOT NULL AND p_start_lat IS NOT NULL
      THEN ST_SetSRID(ST_MakePoint(p_start_lng, p_start_lat), 4326)::GEOGRAPHY
      ELSE public.routes.start_point
    END,
    updated_at = NOW()
  WHERE id = p_route_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Route not found or not authorized';
  END IF;

  RETURN QUERY SELECT * FROM get_route_by_id(p_route_id);
END;
$$;

-- RPC: Create a route waypoint
CREATE OR REPLACE FUNCTION create_route_waypoint(
  p_route_id UUID,
  p_name TEXT,
  p_type TEXT,
  p_lng DOUBLE PRECISION,
  p_lat DOUBLE PRECISION,
  p_description TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  route_id UUID,
  name TEXT,
  type TEXT,
  description TEXT,
  location_lng DOUBLE PRECISION,
  location_lat DOUBLE PRECISION,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.route_waypoints (route_id, name, type, description, location)
  VALUES (
    p_route_id, p_name, p_type, p_description,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::GEOGRAPHY
  )
  RETURNING
    public.route_waypoints.id,
    public.route_waypoints.route_id,
    public.route_waypoints.name,
    public.route_waypoints.type,
    public.route_waypoints.description,
    ST_X(public.route_waypoints.location::GEOMETRY) AS location_lng,
    ST_Y(public.route_waypoints.location::GEOMETRY) AS location_lat,
    public.route_waypoints.created_at;
END;
$$;

-- RPC: Get waypoints for a route (with lng/lat extracted)
CREATE OR REPLACE FUNCTION get_route_waypoints(p_route_id UUID)
RETURNS TABLE(
  id UUID,
  route_id UUID,
  name TEXT,
  type TEXT,
  description TEXT,
  location_lng DOUBLE PRECISION,
  location_lat DOUBLE PRECISION,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    w.id, w.route_id, w.name, w.type, w.description,
    ST_X(w.location::GEOMETRY) AS location_lng,
    ST_Y(w.location::GEOMETRY) AS location_lat,
    w.created_at
  FROM public.route_waypoints w
  WHERE w.route_id = p_route_id
  ORDER BY w.created_at ASC;
END;
$$;

-- RPC: Increment route usage count
CREATE OR REPLACE FUNCTION increment_route_usage(p_route_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.routes
  SET usage_count = usage_count + 1
  WHERE id = p_route_id;
END;
$$;
