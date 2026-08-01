import { supabase } from './supabase';
import type { Conversation, DirectMessage } from '../lib/types';

// Schema e políticas RLS: supabase/migrations/027_clubs_and_messages.sql
// e 028_fix_conversation_rls.sql.

function isMissingTable(err: any): boolean {
  return err?.message?.includes('does not exist') || err?.code === '42P01';
}

export async function getConversations(): Promise<Conversation[]> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return [];
  const myId = user.user.id;

  const { data: myParts, error: pErr } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', myId);

  if (pErr) {
    if (isMissingTable(pErr)) return [];
    throw pErr;
  }
  if (!myParts?.length) return [];

  const convIds = myParts.map((p: any) => p.conversation_id);

  const { data: convs, error: cErr } = await supabase
    .from('conversations')
    .select('*')
    .in('id', convIds)
    .not('last_message_at', 'is', null)
    .order('last_message_at', { ascending: false });
  if (cErr) throw cErr;
  if (!convs?.length) return [];

  // Other participants
  const { data: others } = await supabase
    .from('conversation_participants')
    .select('conversation_id, profile:profiles(id, full_name, username, avatar_url, city)')
    .in('conversation_id', convIds)
    .neq('user_id', myId);

  const otherMap = new Map((others ?? []).map((o: any) => [o.conversation_id, o.profile]));

  // Unread counts
  const { data: unreadRows } = await supabase
    .from('messages')
    .select('conversation_id')
    .in('conversation_id', convIds)
    .eq('is_read', false)
    .neq('sender_id', myId);

  const unreadMap = new Map<string, number>();
  (unreadRows ?? []).forEach((m: any) => {
    unreadMap.set(m.conversation_id, (unreadMap.get(m.conversation_id) ?? 0) + 1);
  });

  return convs
    .map((conv: any) => {
      const otherUser = otherMap.get(conv.id);
      if (!otherUser) return null;
      return {
        ...conv,
        other_user: otherUser,
        unread_count: unreadMap.get(conv.id) ?? 0,
      } as Conversation;
    })
    .filter(Boolean) as Conversation[];
}

export async function getMessages(conversationId: string, page = 0, limit = 40): Promise<DirectMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  return (data ?? []) as DirectMessage[];
}

export async function sendMessage(conversationId: string, body: string): Promise<DirectMessage> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: user.user.id, body })
    .select()
    .single();
  if (error) throw error;

  await supabase.from('conversations').update({
    last_message_at: data.created_at,
    last_message_body: body.slice(0, 200),
    last_message_sender_id: user.user.id,
  }).eq('id', conversationId);

  return data as DirectMessage;
}

export async function startConversation(otherUserId: string, body: string): Promise<string> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');
  const myId = user.user.id;

  // Check for existing conversation
  const { data: myConvs } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', myId);

  if (myConvs?.length) {
    const { data: shared } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', otherUserId)
      .in('conversation_id', myConvs.map((c: any) => c.conversation_id));

    if (shared?.length) {
      const convId = shared[0].conversation_id;
      await sendMessage(convId, body);
      return convId;
    }
  }

  // Create new conversation
  const { data: conv, error } = await supabase
    .from('conversations')
    .insert({
      last_message_at: new Date().toISOString(),
      last_message_body: body.slice(0, 200),
      last_message_sender_id: myId,
    })
    .select()
    .single();
  if (error) throw error;

  // A política RLS exige que o próprio já seja participante antes de poder
  // adicionar outra pessoa — inserir em duas operações, o próprio primeiro.
  const { error: selfErr } = await supabase
    .from('conversation_participants')
    .insert({ conversation_id: conv.id, user_id: myId });
  if (selfErr) throw selfErr;

  const { error: otherErr } = await supabase
    .from('conversation_participants')
    .insert({ conversation_id: conv.id, user_id: otherUserId });
  if (otherErr) throw otherErr;

  await sendMessage(conv.id, body);
  return conv.id;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return;

  await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('conversation_id', conversationId)
    .neq('sender_id', user.user.id)
    .eq('is_read', false);
}

export async function searchUsersToMessage(query: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, city')
    .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

export async function getTotalUnread(): Promise<number> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return 0;
  const myId = user.user.id;

  const { data: myParts } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', myId);

  if (!myParts?.length) return 0;
  const convIds = myParts.map((p: any) => p.conversation_id);

  const { count } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .in('conversation_id', convIds)
    .eq('is_read', false)
    .neq('sender_id', myId);

  return count ?? 0;
}
