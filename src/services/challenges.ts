import { supabase } from './supabase';
import type { Challenge } from '../lib/types';

// Progresso calculado ao vivo a partir das atividades — ver a função
// get_challenges_with_progress em supabase/migrations/036_events_and_club_profile.sql

export async function getChallenges(): Promise<Challenge[]> {
  const { data, error } = await supabase.rpc('get_challenges_with_progress');
  if (error) return [];
  return (data ?? []) as Challenge[];
}

/** Desafios a decorrer em que já participo — usado no cartão do ecrã Hoje. */
export async function getActiveChallenges(): Promise<Challenge[]> {
  const all = await getChallenges();
  const today = new Date().toISOString().slice(0, 10);
  return all.filter((c) => c.end_date >= today && c.start_date <= today);
}

export async function joinChallenge(challengeId: string): Promise<void> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('user_challenges')
    .insert({ user_id: user.user.id, challenge_id: challengeId });
  // 23505 = já inscrito — idempotente
  if (error && error.code !== '23505') throw error;
}

export async function leaveChallenge(challengeId: string): Promise<void> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('user_challenges')
    .delete()
    .eq('user_id', user.user.id)
    .eq('challenge_id', challengeId);
  if (error) throw error;
}

/** Valor formatado para o tipo de desafio (ex.: 42.5 km, 8 treinos). */
export function formatChallengeValue(value: number, type: Challenge['type']): string {
  switch (type) {
    case 'distance':
      return `${(value / 1000).toFixed(value >= 100000 ? 0 : 1)} km`;
    case 'duration': {
      const h = Math.floor(value / 3600);
      const m = Math.round((value % 3600) / 60);
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    }
    case 'elevation':
      return `${Math.round(value)} m`;
    default:
      return `${Math.round(value)} treino${Math.round(value) === 1 ? '' : 's'}`;
  }
}
