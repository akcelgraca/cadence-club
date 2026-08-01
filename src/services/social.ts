import { supabase } from './supabase';
import { mapCounts, attachHasKudosed, ACTIVITY_SELECT } from './activities';
import type { Comment } from '../lib/types';

// Follows
export async function getFollowerCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', userId);
  if (error) throw error;
  return count ?? 0;
}

export async function getFollowingCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', userId);
  if (error) throw error;
  return count ?? 0;
}

export async function followUser(followingId: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { error } = await supabase.from('follows').insert({
    follower_id: user.user.id,
    following_id: followingId,
  });
  if (error) throw error;
}

export async function unfollowUser(followingId: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', user.user.id)
    .eq('following_id', followingId);
  if (error) throw error;
}

export async function isFollowing(followingId: string): Promise<boolean> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return false;

  const { data, error } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', user.user.id)
    .eq('following_id', followingId)
    .maybeSingle();
  // PGRST116 means no row found — that's expected, not an error
  if (error && error.code !== 'PGRST116') throw error;
  return !!data;
}

export async function getFollowers(userId: string) {
  const { data, error } = await supabase
    .from('follows')
    .select('follower_id, profile:profiles!follows_follower_id_fkey(*)')
    .eq('following_id', userId);
  if (error) throw error;
  return data;
}

export async function getFollowing(userId: string) {
  const { data, error } = await supabase
    .from('follows')
    .select('following_id, profile:profiles!follows_following_id_fkey(*)')
    .eq('follower_id', userId);
  if (error) throw error;
  return data;
}

/**
 * Pessoas sugeridas para seguir — quem ainda não sigo, com prioridade para a
 * minha cidade. Usado no estado vazio do feed e na descoberta.
 */
export async function getSuggestedProfiles(limit = 10) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return [];

  const [{ data: me }, { data: follows }] = await Promise.all([
    supabase.from('profiles').select('city').eq('id', user.user.id).maybeSingle(),
    supabase.from('follows').select('following_id').eq('follower_id', user.user.id),
  ]);

  const excluded = new Set([user.user.id, ...(follows ?? []).map((f: any) => f.following_id)]);

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url, city, bio')
    .eq('is_public', true)
    .limit(limit + excluded.size + 10);
  if (error) return [];

  const candidates = (data ?? []).filter((p: any) => !excluded.has(p.id));
  const myCity = me?.city?.toLowerCase();

  // Mesma cidade primeiro
  candidates.sort((a: any, b: any) => {
    const aSame = myCity && a.city?.toLowerCase() === myCity ? 1 : 0;
    const bSame = myCity && b.city?.toLowerCase() === myCity ? 1 : 0;
    return bSame - aSame;
  });

  return candidates.slice(0, limit);
}

// Kudos
export async function giveKudo(activityId: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { error } = await supabase.from('kudos').insert({
    activity_id: activityId,
    user_id: user.user.id,
  });
  if (error) throw error;
}

export async function removeKudo(activityId: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('kudos')
    .delete()
    .eq('activity_id', activityId)
    .eq('user_id', user.user.id);
  if (error) throw error;
}

export async function hasKudosed(activityId: string): Promise<boolean> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return false;

  const { data, error } = await supabase
    .from('kudos')
    .select('id')
    .eq('activity_id', activityId)
    .eq('user_id', user.user.id)
    .maybeSingle();
  // PGRST116 means no row found — that's expected, not an error
  if (error && error.code !== 'PGRST116') throw error;
  return !!data;
}

// Comments
export async function getComments(activityId: string, page: number = 0, limit: number = 20) {
  const { data, error } = await supabase
    .from('comments')
    .select('*, profile:profiles(*)')
    .eq('activity_id', activityId)
    .is('parent_id', null)
    .order('created_at', { ascending: true })
    .range(page * limit, (page + 1) * limit - 1);
  if (error) throw error;
  return data as Comment[];
}

export async function addComment(activityId: string, body: string, parentId?: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('comments')
    .insert({
      activity_id: activityId,
      user_id: user.user.id,
      body,
      parent_id: parentId || null,
    })
    .select('*, profile:profiles(*)')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteComment(commentId: string) {
  const { error } = await supabase.from('comments').delete().eq('id', commentId);
  if (error) throw error;
}

export async function reportActivity(activityId: string, reason: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { error } = await supabase.from('reports').insert({
    reporter_id: user.user.id,
    activity_id: activityId,
    reason,
  });
  if (error) throw error;
}

// Posts guardados (favoritos) — supabase/migrations/031_feed_fixes.sql

export async function savePost(activityId: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { error } = await supabase.from('saved_posts').insert({
    user_id: user.user.id,
    activity_id: activityId,
  });
  // 23505 = já guardado — idempotente
  if (error && error.code !== '23505') throw error;
}

export async function unsavePost(activityId: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('saved_posts')
    .delete()
    .eq('user_id', user.user.id)
    .eq('activity_id', activityId);
  if (error) throw error;
}

export async function getSavedPosts(page = 0, limit = 15) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return [];

  const { data, error } = await supabase
    .from('saved_posts')
    .select(`created_at, activity:activities(${ACTIVITY_SELECT.slice(1)})`)
    .eq('user_id', user.user.id)
    .order('created_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);
  if (error) throw error;

  const activities = (data ?? [])
    .map((row: any) => row.activity)
    .filter(Boolean)
    .map(mapCounts);
  return attachHasKudosed(activities);
}

export async function isPostSaved(activityId: string): Promise<boolean> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return false;

  const { data, error } = await supabase
    .from('saved_posts')
    .select('id')
    .eq('user_id', user.user.id)
    .eq('activity_id', activityId)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return !!data;
}
