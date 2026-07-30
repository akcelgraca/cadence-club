import { supabase } from './supabase';
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
