import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import {
  getClub, getClubMessages, sendClubMessage, markClubRead,
} from '../../../services/clubs';
import { supabase } from '../../../services/supabase';
import { useAuthStore } from '../../../store/authStore';
import { useKeyboardVisible } from '../../../hooks/useKeyboardVisible';
import { Avatar } from '../../../components/common/Avatar';
import { colors, typography, withAlpha } from '../../../lib/theme';
import { formatRelativeTime } from '../../../utils/dateHelpers';
import type { ClubMessage } from '../../../lib/types';
import { useTranslation } from 'react-i18next';
import { goBackOr } from '../../../lib/navigation';

export default function ClubChatScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const myId = useAuthStore((s) => s.profile?.id);
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();

  const [messages, setMessages] = useState<ClubMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const { data: club } = useQuery({
    queryKey: ['club', id],
    queryFn: () => getClub(id),
    enabled: !!id,
  });

  const isMember = !!club?.is_member;

  useEffect(() => {
    if (!id || club === undefined) return;
    if (!isMember) { setLoading(false); return; }
    getClubMessages(id)
      .then((msgs) => {
        setMessages(msgs);
        markClubRead(id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, isMember, club === undefined]);

  // Realtime
  useEffect(() => {
    if (!id || !isMember) return;
    const channel = supabase
      .channel(`club-chat-${id}`)
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'club_messages', filter: `club_id=eq.${id}` },
        async (payload: any) => {
          const msg = payload.new as ClubMessage;
          // O payload realtime não traz o join do profile — buscar à parte
          if (!msg.profile && msg.user_id !== myId) {
            const { data } = await supabase
              .from('profiles')
              .select('id, full_name, username, avatar_url')
              .eq('id', msg.user_id)
              .single();
            msg.profile = data ?? undefined;
          }
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [msg, ...prev]));
          if (msg.user_id !== myId) markClubRead(id);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, isMember, myId]);

  const handleSend = useCallback(async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText('');
    try {
      const msg = await sendClubMessage(id, body);
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [msg, ...prev]));
    } catch {
      Alert.alert(t('club_chat_send_error'));
      setText(body);
    } finally {
      setSending(false);
    }
  }, [text, sending, id]);

  const renderMessage = ({ item, index }: { item: ClubMessage; index: number }) => {
    const isMe = item.user_id === myId;
    // lista invertida: o índice seguinte é cronologicamente anterior
    const prevMsg = messages[index + 1];
    const showAuthor = !isMe && (!prevMsg || prevMsg.user_id !== item.user_id);
    const showTime = !prevMsg
      || new Date(item.created_at).getTime() - new Date(prevMsg.created_at).getTime() > 10 * 60 * 1000;

    return (
      <View style={styles.msgWrapper}>
        {showTime && <Text style={styles.msgTime}>{formatRelativeTime(item.created_at)}</Text>}
        <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
          {!isMe && (
            <View style={styles.msgAvatar}>
              {showAuthor ? (
                <TouchableOpacity onPress={() => router.push(`/profile/${item.user_id}`)}>
                  <Avatar uri={item.profile?.avatar_url} name={item.profile?.full_name} size={28} />
                </TouchableOpacity>
              ) : null}
            </View>
          )}
          <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
            {showAuthor && (
              <Text style={styles.bubbleAuthor}>{item.profile?.full_name ?? 'Atleta'}</Text>
            )}
            <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextThem]}>
              {item.body}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOr(`/club/${id}`)} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerClub}
          onPress={() => router.push(`/club/${id}`)}
          activeOpacity={0.7}
        >
          {club?.avatar_url
            ? <Avatar uri={club.avatar_url} size={34} radius={11} />
            : (
              <View style={styles.headerAvatar}>
                <Text style={styles.headerAvatarLetter}>{club?.name?.[0]?.toUpperCase() ?? '?'}</Text>
              </View>
            )}
          <View style={{ flex: 1 }}>
            <Text style={styles.headerName} numberOfLines={1}>{club?.name ?? t('club_fallback_name')}</Text>
            <Text style={styles.headerSub}>{club?.member_count ?? 0} membros · ver clube</Text>
          </View>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {loading ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
        ) : !isMember ? (
          <View style={styles.locked}>
            <Ionicons name="lock-closed-outline" size={40} color={colors.mutedForeground} />
            <Text style={styles.lockedTitle}>{t('club_chat_members_only')}</Text>
            <Text style={styles.lockedSub}>{t('club_chat_join_to_talk')}</Text>
            <TouchableOpacity style={styles.lockedBtn} onPress={() => router.push(`/club/${id}`)}>
              <Text style={styles.lockedBtnText}>{t('club_view')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <FlatList
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              inverted
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyChat}>
                  <Ionicons name="chatbubbles-outline" size={40} color={colors.mutedForeground} />
                  <Text style={styles.emptyTitle}>{t('club_chat_empty')}</Text>
                  <Text style={styles.emptySub}>{t('club_chat_empty_body')}</Text>
                </View>
              }
            />
            <View
              style={[
                styles.inputBar,
                { paddingBottom: keyboardVisible ? 8 : Math.max(insets.bottom, 8) },
              ]}
            >
              <TextInput
                style={styles.input}
                placeholder={t('club_chat_placeholder')}
                placeholderTextColor={colors.mutedForeground}
                value={text}
                onChangeText={setText}
                multiline
                maxLength={2000}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={!text.trim() || sending}
              >
                {sending
                  ? <ActivityIndicator size="small" color={colors.primaryForeground} />
                  : <Ionicons name="send" size={16} color={colors.primaryForeground} />}
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  backBtn: { padding: 2 },
  headerClub: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: {
    width: 34, height: 34, borderRadius: 11,
    backgroundColor: withAlpha(colors.primary, 0.15),
    alignItems: 'center', justifyContent: 'center',
  },
  headerAvatarLetter: {
    fontFamily: 'BarlowCondensed_700Bold', fontSize: 17, color: colors.primary,
  },
  headerName: { fontFamily: 'Barlow_600SemiBold', fontSize: 15, color: colors.foreground },
  headerSub: { ...typography.body, fontSize: 11, color: colors.mutedForeground, marginTop: 1 },

  listContent: { paddingHorizontal: 14, paddingVertical: 12, flexGrow: 1, justifyContent: 'flex-end' },

  locked: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
  lockedTitle: { ...typography.bodyBold, fontSize: 16, color: colors.foreground },
  lockedSub: { ...typography.body, fontSize: 13, color: colors.mutedForeground, textAlign: 'center' },
  lockedBtn: {
    marginTop: 8,
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 20, backgroundColor: colors.primary,
  },
  lockedBtnText: { fontFamily: 'Barlow_600SemiBold', fontSize: 13, color: colors.primaryForeground },

  msgWrapper: { marginBottom: 3 },
  msgTime: { ...typography.body, fontSize: 11, color: colors.mutedForeground, textAlign: 'center', marginVertical: 8 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  msgRowMe: { justifyContent: 'flex-end' },
  msgAvatar: { width: 28 },
  bubble: {
    maxWidth: '75%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 2,
  },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleThem: { alignSelf: 'flex-start', backgroundColor: colors.inputBackground, borderBottomLeftRadius: 4 },
  bubbleAuthor: { fontFamily: 'Barlow_600SemiBold', fontSize: 12, color: colors.primary, marginBottom: 2 },
  bubbleText: { ...typography.body, fontSize: 15, lineHeight: 20 },
  bubbleTextMe: { color: colors.primaryForeground },
  bubbleTextThem: { color: colors.foreground },

  emptyChat: { alignItems: 'center', paddingVertical: 60, gap: 8, transform: [{ scaleY: -1 }] },
  emptyTitle: { ...typography.bodyBold, fontSize: 16, color: colors.foreground },
  emptySub: { ...typography.body, fontSize: 13, color: colors.mutedForeground },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    ...typography.body,
    fontSize: 15,
    color: colors.foreground,
    backgroundColor: withAlpha(colors.foreground, 0.06),
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    maxHeight: 110,
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
