import { useState, useEffect, useCallback, useMemo } from 'react';
import { useColors } from '../../hooks/useColors';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { discoverClubs, getMyClubs } from '../../services/clubs';
import { ClubCard } from '../../components/social/ClubCard';
import { typography, withAlpha, type Colors } from '../../lib/theme';
import type { Club } from '../../lib/types';
import { useTranslation } from 'react-i18next';
import { goBackOr } from '../../lib/navigation';

/**
 * Pesquisa de clubes por nome (inclui privados, para ser possível pedir para
 * entrar). As sugestões por localização vivem na aba Clubes — aqui é só busca.
 */
export default function DiscoverClubsScreen() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (query: string) => {
    try {
      const [found, mine] = await Promise.all([discoverClubs(query), getMyClubs()]);
      // Esconde os clubes de que já sou membro — estes vivem na aba Clubes
      setClubs(found.filter((c) => !mine.some((m) => m.id === c.id)));
    } catch {
      setClubs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const query = search.trim();
    if (!query) {
      setClubs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => load(query), 300);
    return () => clearTimeout(timer);
  }, [search, load]);

  const handleClubAction = useCallback((updated: Club) => {
    setClubs((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header com pesquisa */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOr('/(tabs)/social')} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={c.foreground} />
        </TouchableOpacity>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={15} color={c.mutedForeground} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('club_discover_placeholder')}
            placeholderTextColor={c.mutedForeground}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            autoFocus
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={15} color={c.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={c.primary} /></View>
      ) : (
        <FlatList
          data={clubs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ClubCard club={item} onAction={handleClubAction} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="search-outline" size={40} color={c.primary} />
              </View>
              <Text style={styles.emptyTitle}>
                {search.trim() ? t('club_discover_no_results') : t('club_discover_title')}
              </Text>
              <Text style={styles.emptyBody}>
                {search.trim()
                  ? `Nenhum clube encontrado para "${search}".`
                  : t('club_discover_body')}
              </Text>
              {!!search.trim() && (
                <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/club/create')}>
                  <Ionicons name="add" size={16} color={c.primaryForeground} />
                  <Text style={styles.emptyBtnText}>{t('clubs_create')}</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            search.trim() ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); load(search.trim()); }}
                tintColor={c.primary}
              />
            ) : undefined
          }
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingBottom: 40, flexGrow: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 10,
    backgroundColor: withAlpha(c.foreground, 0.06),
  },
  searchInput: { flex: 1, ...typography.body, fontSize: 14, color: c.foreground },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 10 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: withAlpha(c.primary, 0.1),
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  emptyTitle: { ...typography.bodyBold, fontSize: 17, color: c.foreground },
  emptyBody: {
    ...typography.body, fontSize: 14, color: c.mutedForeground,
    textAlign: 'center', lineHeight: 20,
  },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 8, paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 20, backgroundColor: c.primary,
  },
  emptyBtnText: { fontFamily: 'Barlow_600SemiBold', fontSize: 13, color: c.primaryForeground },
});
