import { supabase } from './supabase';
import type { ClubEvent } from '../lib/types';

// Schema e RLS: supabase/migrations/036_events_and_club_profile.sql

function isMissingTable(err: any): boolean {
  return err?.message?.includes('does not exist') || err?.code === '42P01';
}

const EVENT_SELECT = '*, attendees:event_attendees(count)';

async function enrich(rows: any[]): Promise<ClubEvent[]> {
  if (!rows.length) return [];
  const { data: user } = await supabase.auth.getUser();

  let mine = new Set<string>();
  if (user.user) {
    const { data } = await supabase
      .from('event_attendees')
      .select('event_id')
      .eq('user_id', user.user.id)
      .in('event_id', rows.map((r) => r.id));
    mine = new Set((data ?? []).map((a: any) => a.event_id));
  }

  return rows.map((row) => ({
    ...row,
    attendee_count: row.attendees?.[0]?.count ?? 0,
    is_attending: mine.has(row.id),
    attendees: undefined,
  })) as ClubEvent[];
}

/** Eventos de um clube. `past: true` devolve os já realizados (mais recentes primeiro). */
export async function getClubEvents(clubId: string, past = false): Promise<ClubEvent[]> {
  const nowIso = new Date().toISOString();
  const query = supabase
    .from('club_events')
    .select(EVENT_SELECT)
    .eq('club_id', clubId)
    .limit(50);

  const { data, error } = past
    ? await query.lt('starts_at', nowIso).order('starts_at', { ascending: false })
    : await query.gte('starts_at', nowIso).order('starts_at', { ascending: true });

  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  return enrich(data ?? []);
}

/** Próximos eventos dos clubes de que sou membro — agregador do ecrã /events. */
export async function getMyUpcomingEvents(limit = 30): Promise<ClubEvent[]> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return [];

  const { data: memberships } = await supabase
    .from('club_members')
    .select('club_id')
    .eq('user_id', user.user.id);

  const clubIds = (memberships ?? []).map((m: any) => m.club_id);
  if (!clubIds.length) return [];

  const { data, error } = await supabase
    .from('club_events')
    .select(`${EVENT_SELECT}, club:clubs(id, name, avatar_url)`)
    .in('club_id', clubIds)
    .gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
    .limit(limit);

  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  return enrich(data ?? []);
}

/** Eventos públicos numa cidade — descoberta de encontros na região. */
export async function discoverEvents(city?: string, limit = 30): Promise<ClubEvent[]> {
  let query = supabase
    .from('club_events')
    .select(`${EVENT_SELECT}, club:clubs!inner(id, name, avatar_url, city, is_private)`)
    .gte('starts_at', new Date().toISOString())
    .eq('club.is_private', false)
    .order('starts_at', { ascending: true })
    .limit(limit);

  if (city?.trim()) query = query.ilike('club.city', `%${city.trim()}%`);

  const { data, error } = await query;
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  return enrich(data ?? []);
}

export interface CreateEventPayload {
  club_id: string;
  title: string;
  description?: string;
  activity_type?: string;
  location?: string;
  starts_at: string;
  distance?: number;
}

export async function createClubEvent(payload: CreateEventPayload): Promise<ClubEvent> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('club_events')
    .insert({ ...payload, created_by: user.user.id })
    .select()
    .single();
  if (error) throw error;

  // O criador fica automaticamente inscrito
  await supabase
    .from('event_attendees')
    .insert({ event_id: data.id, user_id: user.user.id, status: 'going' });

  return { ...data, attendee_count: 1, is_attending: true } as ClubEvent;
}

export async function deleteClubEvent(eventId: string): Promise<void> {
  const { error } = await supabase.from('club_events').delete().eq('id', eventId);
  if (error) throw error;
}

export async function attendEvent(eventId: string): Promise<void> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('event_attendees')
    .insert({ event_id: eventId, user_id: user.user.id, status: 'going' });
  // 23505 = já inscrito — idempotente
  if (error && error.code !== '23505') throw error;
}

export async function leaveEvent(eventId: string): Promise<void> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('event_attendees')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', user.user.id);
  if (error) throw error;
}
