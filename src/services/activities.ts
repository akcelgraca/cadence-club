import { supabase } from './supabase';
import type { Activity, ActivityPoint, ActivityType, ActivityCategory, RunType, SurfaceType } from '../lib/types';
import { ACTIVITY_CATEGORIES } from '../lib/constants';

export interface SaveActivityPayload {
  type: ActivityType;
  runType?: RunType;
  distance: number;
  duration: number;
  elevation_gain: number;
  avg_pace: number;
  start_time: string;
  end_time: string;
  route_summary: number[][];
  points: { lat: number; lng: number; elevation: number | null; timestamp: string }[];
  mood: number | null;
  title: string | null;
  description: string | null;
  is_public: boolean;
  surface_type?: SurfaceType | null;
  equipment_id?: string | null;
}

export async function saveActivity(payload: SaveActivityPayload): Promise<Activity> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { data: activity, error } = await supabase
    .from('activities')
    .insert({
      user_id: user.user.id,
      type: payload.type,
      run_type: payload.runType ?? null,
      distance: payload.distance,
      duration: payload.duration,
      elevation_gain: payload.elevation_gain,
      avg_pace: payload.avg_pace,
      start_time: payload.start_time,
      end_time: payload.end_time,
      route_summary: payload.route_summary,
      mood: payload.mood,
      title: payload.title,
      description: payload.description,
      is_public: payload.is_public,
      surface_type: payload.surface_type ?? null,
      equipment_id: payload.equipment_id ?? null,
      source: 'app',
      state: 'finished',
    })
    .select()
    .single();

  if (error) throw error;

  // Save GPS points
  if (payload.points.length > 0) {
    const points = payload.points.map((p) => ({
      activity_id: activity.id,
      lat: p.lat,
      lng: p.lng,
      elevation: p.elevation,
      timestamp: p.timestamp,
    }));

    const { error: pointsError } = await supabase.from('activity_points').insert(points);
    if (pointsError) throw pointsError;
  }

  return activity;
}

function mapCounts(row: any): any {
  return {
    ...row,
    kudos_count: row.kudos?.[0]?.count ?? 0,
    comments_count: row.comments?.[0]?.count ?? 0,
    kudos: undefined,
    comments: undefined,
  };
}

export async function getActivity(id: string): Promise<Activity | null> {
  const { data, error } = await supabase
    .from('activities')
    .select('*, profile:profiles(*), kudos:kudos(count), comments:comments(count)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return mapCounts(data);
}

export async function getActivityPoints(activityId: string): Promise<ActivityPoint[]> {
  const { data, error } = await supabase
    .from('activity_points')
    .select('*')
    .eq('activity_id', activityId)
    .order('timestamp', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getMyActivities(userId: string, page: number = 0, limit: number = 15) {
  const { data, error } = await supabase
    .from('activities')
    .select('*, profile:profiles(*), kudos:kudos(count), comments:comments(count)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);
  if (error) throw error;
  return data?.map(mapCounts) ?? [];
}

export interface FeedFilter {
  category?: ActivityCategory | 'all';
  following?: boolean;
  searchQuery?: string;
}

export async function getFeed(page: number = 0, limit: number = 15, filter?: FeedFilter) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  // Get IDs of users being followed + self
  const { data: follows } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', user.user.id);

  const followingIds = follows?.map((f) => f.following_id) || [];
  const visibleIds = [user.user.id, ...followingIds];

  let query = supabase
    .from('activities')
    .select('*, profile:profiles(*), kudos:kudos(count), comments:comments(count)')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);

  // Apply category filter — resolves to specific activity types
  if (filter?.category && filter.category !== 'all') {
    const categoryTypes = ACTIVITY_CATEGORIES
      .find((c) => c.key === filter.category)
      ?.activities.map((a) => a.key) ?? [];
    if (categoryTypes.length > 0) {
      query = query.in('type', categoryTypes);
    }
  }

  // Apply following-only filter
  if (filter?.following) {
    query = query.in('user_id', followingIds.length > 0 ? followingIds : ['__none__']);
  } else {
    query = query.in('user_id', visibleIds);
  }

  // Apply search query filter (title or user profile name)
  if (filter?.searchQuery) {
    query = query.or(`title.ilike.%${filter.searchQuery}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data?.map(mapCounts) ?? [];
}
