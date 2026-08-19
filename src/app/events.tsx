import { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router/react-navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { getMyUpcomingEvents, discoverEvents } from '../services/events';
import { EventCard } from '../components/social/EventCard';
import { useAuthStore } from '../store/authStore';
import { colors, typography, withAlpha } from '../lib/theme';
import { useTranslation } from 'react-i18next';
import { goBackOr } from '../lib/navigation';

type EventsTab = 'mine' | 'discover';

export default function EventsScreen() {
  const { t } = useTranslation();
  const myCity = useAuthStore((s) => s.profile?.city);
  const [tab, setTab] = useState<EventsTab>('mine');
  const [city, setCity] = useState(myCity ?? '');

  const {
    data: mine = [],
    isLoading: mineLoading,
    refetch: refetchMine,
  } = useQuery({
    queryKey: ['myEvents'],
    queryFn: () => getMyUpcomingEvents(),
  });

  const {
    data: discovered = [],
    isLoading: discoverLoading,
    refetch: refetchDiscover,
  } = useQuery({
    queryKey: ['discoverEvents', city],
    queryFn: () => discoverEvents(city),
    enabled: tab === 'discover',
  });

  useFocusEffect(useCallback(() => {
    refetchMine();
    if (tab === 'discover') refetchDiscover();
  }, [tab, refetchMine, refetchDiscover]));

  const list = tab === 'mine' ? mine : discovered;
  const loading = tab === 'mine' ? mineLoading : discoverLoading;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOr('/(tabs)')} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('club_tab_events')}</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Abas */}
      <View style={styles.segment}>
        {([
          { key: 'mine' as const, label: t('events_tab_mine') },
          { key: 'discover' as const, label: t('events_tab_discover') },
        ]).map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.segmentBtn, tab === opt.key && styles.segmentBtnActive]}
            onPress={() => setTab(opt.key)}
          >
            <Text style={[styles.segmentText, tab === opt.key && styles.segmentTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Pesquisa por cidade (descobrir) */}
      {tab === 'discover' && (
        <View style={styles.searchBox}>
          <Ionicons name="location-outline" size={15} color={colors.mutedForeground} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('events_city_placeholder')}
            placeholderTextColor={colors.mutedForeground}
            value={city}
            onChangeText={setCity}
            returnKeyType="search"
          />
          {city.length > 0 && (
            <TouchableOpacity onPress={() => setCity('')} hitSlop={8}>
              <Ionicons name="close-circle" size={15} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <EventCard
              event={item}
              showClub
              canAttend={tab === 'mine'}
              onChanged={tab === 'mine' ? refetchMine : refetchDiscover}
            />
          )}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="calendar-outline" size={40} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>
                {tab === 'mine' ? t('events_none_mine') : t('events_none_here')}
              </Text>
              <Text style={styles.emptySub}>
                {tab === 'mine'
                  ? t('events_none_mine_body')
                  : t('events_none_here_body')}
              </Text>
              {tab === 'mine' && (
                <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(tabs)/social')}>
                  <Text style={styles.emptyBtnText}>{t('events_discover_clubs')}</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  headerTitle: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 18, color: colors.foreground },

  segment: {
    flexDirection: 'row',
    margin: 16,
    marginBottom: 8,
    backgroundColor: withAlpha(colors.foreground, 0.06),
    borderRadius: 20,
    padding: 3,
  },
  segmentBtn: { flex: 1, paddingVertical: 8, borderRadius: 17, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: colors.card },
  segmentText: { fontFamily: 'Barlow_500Medium', fontSize: 13, color: colors.mutedForeground },
  segmentTextActive: { fontFamily: 'Barlow_600SemiBold', color: colors.foreground },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 8,
    paddingHorizontal: 12, height: 38, borderRadius: 10,
    backgroundColor: withAlpha(colors.foreground, 0.06),
  },
  searchInput: { flex: 1, ...typography.body, fontSize: 14, color: colors.foreground },

  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40, gap: 10 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: withAlpha(colors.primary, 0.1),
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  emptyTitle: { ...typography.bodyBold, fontSize: 17, color: colors.foreground },
  emptySub: {
    ...typography.body, fontSize: 14, color: colors.mutedForeground,
    textAlign: 'center', lineHeight: 20,
  },
  emptyBtn: {
    marginTop: 8, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 20, backgroundColor: colors.primary,
  },
  emptyBtnText: { fontFamily: 'Barlow_600SemiBold', fontSize: 13, color: colors.primaryForeground },
});
