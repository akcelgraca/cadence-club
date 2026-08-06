import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { useKeyboardVisible } from '../../hooks/useKeyboardVisible';
import {
  getMessages, sendMessage, startConversation, markConversationRead,
} from '../../services/messages';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../../components/common/Avatar';
import { colors, typography, withAlpha } from '../../lib/theme';
import { formatRelativeTime } from '../../utils/dateHelpers';
import type { DirectMessage } from '../../lib/types';
import { useTranslation } from 'react-i18next';

export default function ChatScreen() {
  const { t } = useTranslation();
  const { id, userId, name, avatarUrl } = useLocalSearchParams<{
    id: string;
    userId: string;
    name: string;
    avatarUrl?: string;
  }>();

  const isNew = id === 'draft' || id === 'new';
  const myId = useAuthStore((s) => s.profile?.id);
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();

  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(!isNew);
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(isNew ? null : id);

  // Load messages
  useEffect(() => {
    if (!conversationId) return;
    setLoading(true);
    getMessages(conversationId)
      .then((msgs) => {
        setMessages(msgs);
        markConversationRead(conversationId);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [conversationId]);

  // Realtime subscription
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on(
        'postgres_changes' as any,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: any) => {
          const msg = payload.new as DirectMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [msg, ...prev];
          });
          if (msg.sender_id !== myId) {
            markConversationRead(conversationId);
          }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, myId]);

  const handleSend = useCallback(async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText('');

    try {
      if (conversationId) {
        const msg = await sendMessage(conversationId, body);
        setMessages((prev) => [msg, ...prev]);
      } else {
        // New conversation — create it on first send
        const convId = await startConversation(userId, body);
        setConversationId(convId);
        // Messages will be loaded by the useEffect above
      }
    } catch {
      Alert.alert(t('messages_send_error'));
      setText(body);
    } finally {
      setSending(false);
    }
  }, [text, sending, conversationId, userId]);

  const renderMessage = useCallback(({ item, index }: { item: DirectMessage; index: number }) => {
    const isMe = item.sender_id === myId;
    // inverted list: next index is chronologically earlier
    const nextMsg = messages[index + 1];
    const showTime = !nextMsg
      || new Date(item.created_at).getTime() - new Date(nextMsg.created_at).getTime() > 5 * 60 * 1000;

    return (
      <View style={styles.msgWrapper}>
        {showTime && (
          <Text style={styles.msgTime}>{formatRelativeTime(item.created_at)}</Text>
        )}
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextThem]}>
            {item.body}
          </Text>
        </View>
      </View>
    );
  }, [myId, messages]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerUser}
          onPress={() => userId && router.push(`/profile/${userId}`)}
          activeOpacity={0.7}
        >
          <Avatar uri={avatarUrl || null} name={name} size={36} />
          <View>
            <Text style={styles.headerName} numberOfLines={1}>{name}</Text>
            <Text style={styles.headerSub}>{t('messages_view_profile')}</Text>
          </View>
        </TouchableOpacity>

        <View style={{ width: 36 }} />
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            inverted
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Avatar uri={avatarUrl || null} name={name} size={64} />
                <Text style={styles.emptyChatName}>{name}</Text>
                <Text style={styles.emptyChatSub}>{t('messages_send_first')}</Text>
              </View>
            }
          />
        )}

        {/* Input bar */}
        <View
          style={[
            styles.inputBar,
            { paddingBottom: keyboardVisible ? 10 : Math.max(insets.bottom, 10) },
          ]}
        >
          <TextInput
            style={styles.input}
            placeholder={t('messages_placeholder')}
            placeholderTextColor={colors.mutedForeground}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={1000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
          >
            {sending
              ? <ActivityIndicator size="small" color={colors.primaryForeground} />
              : <Ionicons name="send" size={16} color={colors.primaryForeground} />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  backBtn: { padding: 2 },
  headerUser: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
  },
  headerName: {
    fontFamily: 'Barlow_600SemiBold',
    fontSize: 15,
    color: colors.foreground,
  },
  headerSub: {
    ...typography.body,
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 1,
  },

  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },

  // Message bubbles
  msgWrapper: { marginBottom: 4 },
  msgTime: {
    ...typography.body,
    fontSize: 11,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginVertical: 8,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 2,
  },
  bubbleMe: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    alignSelf: 'flex-start',
    backgroundColor: colors.inputBackground,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { ...typography.body, fontSize: 15, lineHeight: 21 },
  bubbleTextMe: { color: colors.primaryForeground },
  bubbleTextThem: { color: colors.foreground },

  // Empty chat
  emptyChat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyChatName: {
    fontFamily: 'Barlow_600SemiBold',
    fontSize: 17,
    color: colors.foreground,
  },
  emptyChatSub: {
    ...typography.body,
    fontSize: 14,
    color: colors.mutedForeground,
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
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
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 120,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
