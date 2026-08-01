import { supabase } from './supabase';
import { mapCounts, attachHasKudosed, ACTIVITY_SELECT } from './activities';
import type {
  Club, ClubMember, ClubMessage, ClubJoinRequest, ClubChat, ClubStats, Activity,
} from '../lib/types';

// ── Supabase Migration — run once in your SQL editor ─────────────────────────
//
// CREATE TABLE IF NOT EXISTS clubs (
//   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   name text NOT NULL,
//   description text,
//   avatar_url text,
//   city text,
//   category text,
//   is_private boolean NOT NULL DEFAULT false,
//   owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
//   member_count int NOT NULL DEFAULT 0,
//   created_at timestamptz NOT NULL DEFAULT now()
// );
// CREATE TABLE IF NOT EXISTS club_members (
//   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
//   user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
//   role text NOT NULL DEFAULT 'member',
//   joined_at timestamptz NOT NULL DEFAULT now(),
//   UNIQUE(club_id, user_id)
// );
// ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
// ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "Clubs viewable" ON clubs FOR SELECT USING (is_private = false OR auth.uid() IN (SELECT user_id FROM club_members WHERE club_id = id));
// CREATE POLICY "Club members viewable" ON club_members FOR SELECT USING (true);
// CREATE POLICY "Users join clubs" ON club_members FOR INSERT WITH CHECK (auth.uid() = user_id);
// CREATE POLICY "Users leave clubs" ON club_members FOR DELETE USING (auth.uid() = user_id);
// CREATE POLICY "Users create clubs" ON clubs FOR INSERT WITH CHECK (auth.uid() = owner_id);
// CREATE POLICY "Admins update clubs" ON clubs FOR UPDATE USING (auth.uid() = owner_id);

function isMissingTable(err: any): boolean {
  return err?.message?.includes('does not exist') || err?.code === '42P01';
}

export async function getMyClubs(): Promise<Club[]> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return [];

  const [{ data, error }, { data: owned }] = await Promise.all([
    supabase
      .from('club_members')
      .select('role, joined_at, club:clubs(*)')
      .eq('user_id', user.user.id)
      .order('joined_at', { ascending: false }),
    // Clubes de que sou dono — mesmo que a linha de membro falte (dados antigos)
    supabase.from('clubs').select('*').eq('owner_id', user.user.id),
  ]);

  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }

  const clubs: Club[] = (data ?? []).map((row: any) => ({
    ...row.club,
    is_member: true,
    role: row.role,
  }));

  for (const c of owned ?? []) {
    if (!clubs.some((existing) => existing.id === c.id)) {
      clubs.push({ ...c, is_member: true, role: 'admin' } as Club);
    }
  }
  return clubs;
}

export async function discoverClubs(search?: string): Promise<Club[]> {
  const { data: user } = await supabase.auth.getUser();

  let query = supabase
    .from('clubs')
    .select('*')
    .order('member_count', { ascending: false })
    .limit(30);

  // A lista "Descobrir" mostra só públicos; a pesquisa por nome inclui
  // privados, para ser possível encontrá-los e pedir para entrar.
  if (search?.trim()) {
    query = query.ilike('name', `%${search.trim()}%`);
  } else {
    query = query.eq('is_private', false);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  if (!data?.length) return [];
  if (!user.user) return data;

  const clubIds = data.map((c: any) => c.id);
  const [{ data: memberships }, requestMap] = await Promise.all([
    supabase
      .from('club_members')
      .select('club_id, role')
      .eq('user_id', user.user.id)
      .in('club_id', clubIds),
    getMyRequestStatuses(clubIds),
  ]);

  const memberMap = new Map((memberships ?? []).map((m: any) => [m.club_id, m.role]));
  return data.map((c: any) => {
    const isOwner = c.owner_id === user.user!.id;
    return {
      ...c,
      // O dono conta sempre como membro/admin, mesmo com dados antigos incompletos
      is_member: memberMap.has(c.id) || isOwner,
      role: memberMap.get(c.id) ?? (isOwner ? 'admin' : undefined),
      request_status: isOwner ? undefined : requestMap.get(c.id) ?? undefined,
    };
  });
}

/**
 * Clubes sugeridos para aderir — públicos, de que ainda não sou membro,
 * com prioridade para a minha cidade e depois para os mais populares.
 */
export async function getSuggestedClubs(limit = 8): Promise<Club[]> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return [];

  const [{ data: me }, { data: clubs, error }] = await Promise.all([
    supabase.from('profiles').select('city').eq('id', user.user.id).maybeSingle(),
    supabase
      .from('clubs')
      .select('*')
      .eq('is_private', false)
      .order('member_count', { ascending: false })
      .limit(50),
  ]);

  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  if (!clubs?.length) return [];

  const clubIds = clubs.map((c: any) => c.id);
  const [{ data: memberships }, requestMap] = await Promise.all([
    supabase
      .from('club_members')
      .select('club_id')
      .eq('user_id', user.user.id)
      .in('club_id', clubIds),
    getMyRequestStatuses(clubIds),
  ]);

  const memberSet = new Set((memberships ?? []).map((m: any) => m.club_id));
  const myCity = me?.city?.toLowerCase();

  return clubs
    .filter((c: any) => !memberSet.has(c.id) && c.owner_id !== user.user!.id)
    .map((c: any) => ({
      ...c,
      is_member: false,
      request_status: requestMap.get(c.id) ?? undefined,
    }))
    // Mesma cidade primeiro; dentro de cada grupo mantém a ordem por popularidade
    .sort((a: Club, b: Club) => {
      const aSame = myCity && a.city?.toLowerCase() === myCity ? 1 : 0;
      const bSame = myCity && b.city?.toLowerCase() === myCity ? 1 : 0;
      return bSame - aSame;
    })
    .slice(0, limit);
}

export async function getClub(id: string): Promise<Club> {
  const { data: user } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('clubs').select('*').eq('id', id).single();
  if (error) throw error;

  if (user.user) {
    const [{ data: membership }, requestMap] = await Promise.all([
      supabase
        .from('club_members')
        .select('role')
        .eq('club_id', id)
        .eq('user_id', user.user.id)
        .maybeSingle(),
      getMyRequestStatuses([id]),
    ]);
    const isOwner = data.owner_id === user.user.id;
    return {
      ...data,
      is_member: !!membership || isOwner,
      role: membership?.role ?? (isOwner ? 'admin' : undefined),
      request_status: isOwner ? undefined : requestMap.get(id),
    } as Club;
  }
  return data as Club;
}

export async function getClubMembers(clubId: string, limit = 50, offset = 0): Promise<ClubMember[]> {
  const { data, error } = await supabase
    .from('club_members')
    .select('*, profile:profiles(*)')
    .eq('club_id', clubId)
    .order('role', { ascending: true })
    .order('joined_at', { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  return (data ?? []) as ClubMember[];
}

export async function getClubActivities(clubId: string, page = 0, limit = 20): Promise<Activity[]> {
  const { data: members, error: mErr } = await supabase
    .from('club_members')
    .select('user_id')
    .eq('club_id', clubId);
  if (mErr) {
    if (isMissingTable(mErr)) return [];
    throw mErr;
  }
  if (!members?.length) return [];

  const userIds = members.map((m: any) => m.user_id);
  const { data, error } = await supabase
    .from('activities')
    .select(ACTIVITY_SELECT)
    .in('user_id', userIds)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);
  if (error) throw error;
  return attachHasKudosed((data ?? []).map(mapCounts)) as Promise<Activity[]>;
}

export async function joinClub(clubId: string): Promise<void> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  // member_count é mantido pelo trigger trg_club_member_count — não somar aqui
  const { error } = await supabase.from('club_members').insert({
    club_id: clubId,
    user_id: user.user.id,
    role: 'member',
  });
  if (error) throw error;
}

export async function leaveClub(clubId: string): Promise<void> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('club_members')
    .delete()
    .eq('club_id', clubId)
    .eq('user_id', user.user.id);
  if (error) throw error;
}

// ── Chat do clube ─────────────────────────────────────────────────────────────
// Schema e RLS: supabase/migrations/029_club_chat.sql

export async function getClubMessages(clubId: string, page = 0, limit = 40): Promise<ClubMessage[]> {
  const { data, error } = await supabase
    .from('club_messages')
    .select('*, profile:profiles(id, full_name, username, avatar_url)')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  return (data ?? []) as ClubMessage[];
}

export async function sendClubMessage(clubId: string, body: string): Promise<ClubMessage> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('club_messages')
    .insert({ club_id: clubId, user_id: user.user.id, body })
    .select('*, profile:profiles(id, full_name, username, avatar_url)')
    .single();
  if (error) throw error;
  return data as ClubMessage;
}

/** Só o dono pode apagar (política clubs_delete); membros, chat e pedidos
 *  são removidos em cascata pelas foreign keys. */
export async function deleteClub(clubId: string): Promise<void> {
  const { error } = await supabase.from('clubs').delete().eq('id', clubId);
  if (error) throw error;
}

/** Só o dono pode alterar (política clubs_update). */
export async function setClubPrivacy(clubId: string, isPrivate: boolean): Promise<void> {
  const { error } = await supabase
    .from('clubs')
    .update({ is_private: isPrivate })
    .eq('id', clubId);
  if (error) throw error;
}

// ── Leitura do chat (badge de não lidos) ─────────────────────────────────────
// Schema: supabase/migrations/032_club_reads.sql

export async function markClubRead(clubId: string): Promise<void> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return;

  await supabase
    .from('club_reads')
    .upsert(
      { user_id: user.user.id, club_id: clubId, last_read_at: new Date().toISOString() },
      { onConflict: 'user_id,club_id' },
    );
}

export async function getUnreadClubsCount(): Promise<number> {
  const { data, error } = await supabase.rpc('get_unread_clubs_count');
  if (error) return 0;
  return data ?? 0;
}

/** Chats dos meus clubes — listados na aba Mensagens junto às conversas diretas. */
export async function getMyClubChats(): Promise<ClubChat[]> {
  const { data, error } = await supabase.rpc('get_my_club_chats');
  if (error) return [];
  return (data ?? []) as ClubChat[];
}

/**
 * Total de mensagens de clube por ler. Conta para o badge das Mensagens,
 * porque é lá que os chats de clube vivem.
 */
export async function getUnreadClubMessagesCount(): Promise<number> {
  const chats = await getMyClubChats();
  return chats.reduce((sum, c) => sum + (c.unread_count ?? 0), 0);
}

/**
 * Pedidos de adesão à espera da minha aprovação, em todos os clubes que
 * administro. A RLS já limita o que vejo; excluo os meus próprios pedidos.
 */
export async function getPendingRequestsForMyClubs(): Promise<ClubJoinRequest[]> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return [];

  const { data, error } = await supabase
    .from('club_join_requests')
    .select(`
      *,
      profile:profiles!club_join_requests_user_id_fkey(id, full_name, username, avatar_url),
      club:clubs(id, name)
    `)
    .eq('status', 'pending')
    .neq('user_id', user.user.id)
    .order('created_at', { ascending: true });

  if (error) return [];
  return (data ?? []) as ClubJoinRequest[];
}

export async function getClubStats(clubId: string): Promise<ClubStats | null> {
  const { data, error } = await supabase.rpc('get_club_stats', { p_club_id: clubId });
  if (error) return null;
  // A função devolve uma única linha
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? null) as ClubStats | null;
}

export async function createClub(fields: {
  name: string;
  description?: string;
  city?: string;
  category?: string;
  is_private?: boolean;
}): Promise<Club> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  // member_count parte de 0 — o trigger soma 1 quando o dono entra como admin
  const { data: club, error } = await supabase
    .from('clubs')
    .insert({ ...fields, owner_id: user.user.id, member_count: 0 })
    .select()
    .single();
  if (error) throw error;

  // Se a adesão do dono falhar, o clube fica órfão — apagar e propagar o erro
  const { error: memberError } = await supabase.from('club_members').insert({
    club_id: club.id,
    user_id: user.user.id,
    role: 'admin',
  });
  if (memberError) {
    await supabase.from('clubs').delete().eq('id', club.id);
    throw memberError;
  }

  return { ...club, member_count: 1, is_member: true, role: 'admin' } as Club;
}

// ── Pedidos de adesão (clubes privados) ──────────────────────────────────────
// Schema e RLS: supabase/migrations/034_club_join_requests.sql

export async function requestToJoinClub(clubId: string): Promise<void> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  // Remove pedidos antigos já resolvidos (recusado, ou aceite de quem
  // entretanto saiu do clube) para permitir pedir de novo
  await supabase
    .from('club_join_requests')
    .delete()
    .eq('club_id', clubId)
    .eq('user_id', user.user.id)
    .in('status', ['rejected', 'accepted']);

  const { error } = await supabase.from('club_join_requests').insert({
    club_id: clubId,
    user_id: user.user.id,
  });
  // 23505 = já existe pedido pendente/aceite — idempotente
  if (error && error.code !== '23505') throw error;
}

export async function cancelJoinRequest(clubId: string): Promise<void> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return;

  await supabase
    .from('club_join_requests')
    .delete()
    .eq('club_id', clubId)
    .eq('user_id', user.user.id)
    .eq('status', 'pending');
}

/** Mapa clube → estado do meu pedido, para os clubes indicados. */
async function getMyRequestStatuses(clubIds: string[]): Promise<Map<string, string>> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user || clubIds.length === 0) return new Map();

  const { data } = await supabase
    .from('club_join_requests')
    .select('club_id, status')
    .eq('user_id', user.user.id)
    .in('club_id', clubIds);
  return new Map((data ?? []).map((r: any) => [r.club_id, r.status]));
}

/** Pedidos pendentes de um clube — a RLS garante que só admins/dono os veem. */
export async function getPendingRequests(clubId: string): Promise<ClubJoinRequest[]> {
  // A tabela tem 2 FKs para profiles (user_id e resolved_by) — o join tem de
  // indicar explicitamente qual, senão o PostgREST devolve erro de ambiguidade.
  const { data, error } = await supabase
    .from('club_join_requests')
    .select('*, profile:profiles!club_join_requests_user_id_fkey(id, full_name, username, avatar_url)')
    .eq('club_id', clubId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  return (data ?? []) as ClubJoinRequest[];
}

export async function respondToJoinRequest(requestId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc('respond_club_request', {
    p_request_id: requestId,
    p_accept: accept,
  });
  if (error) throw error;
}
