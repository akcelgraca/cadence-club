import { supabase } from './supabase';
import type { Notification } from '../lib/types';

export async function getNotifications(page: number = 0, limit: number = 20) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.user.id)
    .order('created_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);

  if (error) throw error;
  return data as Notification[];
}

export async function getUnreadCount(): Promise<number> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return 0;

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.user.id)
    .eq('is_read', false);

  if (error) return 0;
  return count ?? 0;
}

export async function markAsRead(notificationId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) throw error;
}

export async function markAllAsRead() {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.user.id)
    .eq('is_read', false);

  if (error) throw error;
}
