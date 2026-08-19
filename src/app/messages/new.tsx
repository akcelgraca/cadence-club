import { useState, useEffect, useMemo } from 'react';
import { useColors } from '../../hooks/useColors';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { searchUsersToMessage } from '../../services/messages';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../../components/common/Avatar';
import { typography, withAlpha, type Colors } from '../../lib/theme';
import type { Profile } from '../../lib/types';
import { useTranslation } from 'react-i18next';
import { goBackOr } from '../../lib/navigation';

export default function NewMessageScreen() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Partial<Profile>[]>([]);
  const [loading, setLoading] = useState(false);
  const myId = useAuthStore((s) => s.profile?.id);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchUsersToMessage(query);
        setResults((data as Partial<Profile>[]).filter((u) => u.id !== myId));
      } catch {}
      setLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, myId]);

  const openChat = (user: Partial<Profile>) => {
    // NOTA: o id "draft" é o sentinela de conversa nova. Não usar "new" —
    // /messages/new corresponde à rota estática deste próprio ecrã.
    router.push({
      pathname: '/messages/[id]',
      params: {
        id: 'draft',
        userId: user.id!,
        name: user.full_name || user.username || 'Atleta',
        avatarUrl: user.avatar_url ?? '',
      },
    } as any);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOr('/(tabs)/social')} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={c.foreground} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('messages_new_title')}</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={c.mutedForeground} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('messages_search_user')}
          placeholderTextColor={c.mutedForeground}
          value={query}
          onChangeText={setQuery}
          autoFocus
          returnKeyType="search"
        />
        {loading
          ? <ActivityIndicator size="small" color={c.primary} />
          : query.length > 0
            ? <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={c.mutedForeground} />
              </TouchableOpacity>
            : null
        }
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id!}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.userRow}
            onPress={() => openChat(item)}
            activeOpacity={0.7}
          >
            <Avatar
              uri={item.avatar_url}
              name={item.full_name || item.username}
              size={46}
            />
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{item.full_name ?? 'Atleta'}</Text>
              <Text style={styles.userHandle}>@{item.username}</Text>
            </View>
            <Ionicons name="chatbubble-outline" size={20} color={c.mutedForeground} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            {query.trim()
              ? (
                <>
                  <Ionicons name="search-outline" size={40} color={c.mutedForeground} />
                  <Text style={styles.emptyText}>Sem resultados para "{query}"</Text>
                </>
              )
              : (
                <>
                  <Ionicons name="people-outline" size={44} color={c.mutedForeground} />
                  <Text style={styles.emptyText}>{t('messages_search_hint')}</Text>
                </>
              )
            }
          </View>
        }
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (c: Colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  title: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 18,
    color: c.foreground,
  },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 16,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 12,
    backgroundColor: withAlpha(c.foreground, 0.06),
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    fontSize: 15,
    color: c.foreground,
  },

  list: { flexGrow: 1 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
    backgroundColor: c.card,
  },
  userInfo: { flex: 1 },
  userName: { ...typography.bodyBold, fontSize: 15, color: c.foreground },
  userHandle: { ...typography.body, fontSize: 13, color: c.mutedForeground, marginTop: 2 },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyText: {
    ...typography.body,
    fontSize: 14,
    color: c.mutedForeground,
    textAlign: 'center',
  },
});
