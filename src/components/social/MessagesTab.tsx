import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../common/Avatar';
import { getConversations } from '../../services/messages';
import { getMyClubChats } from '../../services/clubs';
import { useSocialStore } from '../../store/socialStore';
import { colors, typography, withAlpha } from '../../lib/theme';
import { formatRelativeTime } from '../../utils/dateHelpers';
import type { Conversation, ClubChat } from '../../lib/types';

/** Linha unificada da lista: conversa direta ou chat de clube. */
type ChatRow =
  | { kind: 'dm'; id: string; sortAt: number; unread: number; conv: Conversation }
  | { kind: 'club'; id: string; sortAt: number; unread: number; club: ClubChat };

export function MessagesTab() {
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const setUnreadMessages = useSocialStore((s) => s.setUnreadMessages);

  const load = useCallback(async () => {
    try {
      const [convs, clubs] = await Promise.all([getConversations(), getMyClubChats()]);

      const dmRows: ChatRow[] = convs.map((c) => ({
        kind: 'dm',
        id: `dm-${c.id}`,
        sortAt: c.last_message_at ? new Date(c.last_message_at).getTime() : 0,
        unread: c.unread_count,
        conv: c,
      }));

      const clubRows: ChatRow[] = clubs.map((c) => ({
        kind: 'club',
        id: `club-${c.club_id}`,
        sortAt: c.last_message_at ? new Date(c.last_message_at).getTime() : 0,
        unread: c.unread_count,
        club: c,
      }));

      const merged = [...dmRows, ...clubRows].sort((a, b) => b.sortAt - a.sortAt);
      setRows(merged);
      // Inclui os chats de clube — também são conversas desta aba
      setUnreadMessages(merged.reduce((acc, r) => acc + r.unread, 0));
    } catch {
      // tables may not exist yet — show empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setUnreadMessages]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const rowTitle = (row: ChatRow) =>
    row.kind === 'dm'
      ? row.conv.other_user.full_name || row.conv.other_user.username
      : row.club.name;

  const filtered = search.trim()
    ? rows.filter((r) => {
        const q = search.toLowerCase();
        if (r.kind === 'club') return r.club.name.toLowerCase().includes(q);
        return (
          r.conv.other_user?.full_name?.toLowerCase().includes(q) ||
          r.conv.other_user?.username?.toLowerCase().includes(q)
        );
      })
    : rows;

  const openRow = (row: ChatRow) => {
    if (row.kind === 'club') {
      router.push(`/club/${row.club.club_id}/chat`);
      return;
    }
    const conv = row.conv;
    router.push({
      pathname: '/messages/[id]',
      params: {
        id: conv.id,
        userId: conv.other_user.id,
        name: conv.other_user.full_name || conv.other_user.username,
        avatarUrl: conv.other_user.avatar_url ?? '',
      },
    } as any);
  };

  const renderItem = ({ item }: { item: ChatRow }) => {
    const isUnread = item.unread > 0;
    const title = rowTitle(item);
    const avatarUrl = item.kind === 'dm' ? item.conv.other_user.avatar_url : item.club.avatar_url;
    const lastAt = item.kind === 'dm' ? item.conv.last_message_at : item.club.last_message_at;
    const lastBody = item.kind === 'dm' ? item.conv.last_message_body : item.club.last_message_body;

    return (
      <TouchableOpacity style={styles.row} onPress={() => openRow(item)} activeOpacity={0.7}>
        <View style={styles.avatarWrap}>
          {item.kind === 'club' && !avatarUrl ? (
            <View style={styles.clubAvatar}>
              <Text style={styles.clubAvatarLetter}>{title[0]?.toUpperCase() ?? '?'}</Text>
            </View>
          ) : (
            <Avatar
              uri={avatarUrl}
              name={title}
              size={50}
              radius={item.kind === 'club' ? 16 : undefined}
            />
          )}
          {isUnread && <View style={styles.unreadDot} />}
        </View>

        <View style={styles.rowContent}>
          <View style={styles.rowTop}>
            <View style={styles.titleRow}>
              {item.kind === 'club' && (
                <Ionicons name="people" size={13} color={colors.mutedForeground} />
              )}
              <Text style={[styles.name, isUnread && styles.nameBold]} numberOfLines={1}>
                {title}
              </Text>
            </View>
            {lastAt && <Text style={styles.time}>{formatRelativeTime(lastAt)}</Text>}
          </View>
          <View style={styles.rowBottom}>
            <Text style={[styles.preview, isUnread && styles.previewBold]} numberOfLines={1}>
              {lastBody ?? 'Sem mensagens'}
            </Text>
            {isUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {item.unread > 99 ? '99+' : item.unread}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <View style={styles.root}>
      {/* Search */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={14} color={colors.mutedForeground} />
        <TextInput
          style={styles.searchInput}
          placeholder="Procurar conversas e clubes..."
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="chatbubble-ellipses-outline" size={48} color={colors.mutedForeground} />
            <Text style={styles.emptyTitle}>
              {search.trim() ? 'Sem resultados' : 'Sem conversas'}
            </Text>
            <Text style={styles.emptyBody}>
              {search.trim()
                ? `Nenhuma conversa com "${search}".`
                : 'Os chats dos teus clubes aparecem aqui. Toca no ícone de compor para enviar a primeira mensagem.'}
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.primary}
          />
        }
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 10,
    backgroundColor: withAlpha(colors.foreground, 0.06),
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    fontSize: 14,
    color: colors.foreground,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  avatarWrap: { position: 'relative' },
  clubAvatar: {
    width: 50, height: 50, borderRadius: 16,
    backgroundColor: withAlpha(colors.primary, 0.15),
    alignItems: 'center', justifyContent: 'center',
  },
  clubAvatarLetter: {
    fontFamily: 'BarlowCondensed_700Bold', fontSize: 22, color: colors.primary,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  unreadDot: {
    position: 'absolute',
    top: 0, right: 0,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: colors.primary,
    borderWidth: 2, borderColor: colors.card,
  },
  rowContent: { flex: 1, minWidth: 0 },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  name: { ...typography.body, fontSize: 15, color: colors.foreground, flexShrink: 1 },
  nameBold: { fontFamily: 'Barlow_600SemiBold' },
  time: { ...typography.body, fontSize: 12, color: colors.mutedForeground, marginLeft: 8 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  preview: { ...typography.body, fontSize: 13, color: colors.mutedForeground, flex: 1 },
  previewBold: { fontFamily: 'Barlow_500Medium', color: colors.foreground },
  unreadBadge: {
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  unreadBadgeText: {
    fontFamily: 'Barlow_600SemiBold',
    fontSize: 10,
    color: colors.primaryForeground,
  },

  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyTitle: { ...typography.bodyBold, fontSize: 17, color: colors.foreground },
  emptyBody: {
    ...typography.body, fontSize: 14,
    color: colors.mutedForeground, textAlign: 'center', lineHeight: 20,
  },
});
