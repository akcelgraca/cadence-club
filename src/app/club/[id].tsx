import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Animated,
  ActivityIndicator, Alert, RefreshControl, Share, useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useFocusEffect } from 'expo-router/react-navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import {
  getClub, getClubMembers, getClubActivities, joinClub, leaveClub,
  markClubRead, setClubPrivacy, deleteClub, getClubStats,
  requestToJoinClub, cancelJoinRequest, getPendingRequests, respondToJoinRequest,
} from '../../services/clubs';
import { getClubEvents } from '../../services/events';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../../components/common/Avatar';
import { SocialPostCard } from '../../components/social/SocialPostCard';
import { EventCard } from '../../components/social/EventCard';
import { ActivityIcon } from '../../components/common/ActivityIcon';
import { ACTIVITY_CATEGORIES } from '../../lib/constants';
import { colors, typography, withAlpha } from '../../lib/theme';
import type { ClubMember, ClubJoinRequest, Activity } from '../../lib/types';
import { useTranslation } from 'react-i18next';

type ClubTab = 'posts' | 'events' | 'members';

const TABS: { key: ClubTab; i18n_key: string }[] = [
  { key: 'posts', i18n_key: 'club_tab_posts' },
  { key: 'events', i18n_key: 'club_tab_events' },
  { key: 'members', i18n_key: 'club_tab_members' },
];

export default function ClubDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const myId = useAuthStore((s) => s.profile?.id);
  const { width } = useWindowDimensions();

  const pagerRef = useRef<any>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [activeIndex, setActiveIndex] = useState(0);
  const [tabLayouts, setTabLayouts] = useState<{ x: number; width: number }[]>([]);
  // Só carrega os dados das abas já visitadas — evita 3 fetches no arranque
  const [visited, setVisited] = useState<Set<ClubTab>>(new Set(['posts']));

  const [eventsPast, setEventsPast] = useState(false);
  const [joiningLeaving, setJoiningLeaving] = useState(false);
  const [deletedActivityIds, setDeletedActivityIds] = useState<Set<string>>(new Set());

  const activeTab = TABS[activeIndex].key;

  const goToTab = useCallback((index: number) => {
    pagerRef.current?.scrollTo({ x: index * width, animated: true });
    setActiveIndex(index);
    setVisited((prev) => new Set(prev).add(TABS[index].key));
  }, [width]);

  const {
    data: club,
    isLoading: clubLoading,
    refetch: refetchClub,
  } = useQuery({
    queryKey: ['club', id],
    queryFn: () => getClub(id),
    enabled: !!id,
  });

  const isMember = !!club?.is_member;
  const isOwner = !!myId && club?.owner_id === myId;
  const isAdmin = isOwner || club?.role === 'admin';

  const { data: stats } = useQuery({
    queryKey: ['clubStats', id],
    queryFn: () => getClubStats(id),
    enabled: !!id,
  });

  const {
    data: activities = [],
    refetch: refetchActivities,
    isFetching: activitiesFetching,
  } = useQuery({
    queryKey: ['clubActivities', id],
    queryFn: () => getClubActivities(id),
    enabled: !!id && visited.has('posts'),
  });

  const {
    data: events = [],
    refetch: refetchEvents,
    isFetching: eventsFetching,
  } = useQuery({
    queryKey: ['clubEvents', id, eventsPast],
    queryFn: () => getClubEvents(id, eventsPast),
    enabled: !!id && visited.has('events'),
  });

  const {
    data: members = [],
    refetch: refetchMembers,
    isFetching: membersFetching,
  } = useQuery({
    queryKey: ['clubMembers', id],
    queryFn: () => getClubMembers(id),
    enabled: !!id && visited.has('members'),
  });

  const {
    data: pendingRequests = [],
    refetch: refetchRequests,
  } = useQuery({
    queryKey: ['clubRequests', id],
    queryFn: () => getPendingRequests(id),
    enabled: !!id && isAdmin,
  });

  // Recarregar ao voltar (ex.: depois de criar um evento)
  useFocusEffect(useCallback(() => {
    if (visited.has('events')) refetchEvents();
  }, [visited, refetchEvents]));

  const handleRespond = (req: ClubJoinRequest, accept: boolean) => {
    respondToJoinRequest(req.id, accept)
      .then(() => {
        refetchRequests();
        if (accept) { refetchMembers(); refetchClub(); }
      })
      .catch(() => Alert.alert(t('club_request_process_error')));
  };

  const handleJoinLeave = () => {
    if (!club) return;
    if (!club.is_member && club.is_private) {
      if (club.request_status === 'pending') {
        Alert.alert(t('club_request_pending'), t('club_request_cancel_confirm'), [
          { text: t('club_request_keep'), style: 'cancel' },
          {
            text: t('club_request_cancel'), style: 'destructive',
            onPress: async () => {
              setJoiningLeaving(true);
              try { await cancelJoinRequest(club.id); refetchClub(); }
              catch { Alert.alert(t('club_request_cancel_error')); }
              finally { setJoiningLeaving(false); }
            },
          },
        ]);
      } else {
        setJoiningLeaving(true);
        requestToJoinClub(club.id)
          .then(() => {
            refetchClub();
            Alert.alert(t('club_request_sent_title'), t('club_request_sent_body'));
          })
          .catch(() => Alert.alert(t('club_request_error')))
          .finally(() => setJoiningLeaving(false));
      }
      return;
    }
    if (club.is_member) {
      Alert.alert(t('club_leave'), t('club_leave_confirm', { name: club.name }), [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('club_leave_action'), style: 'destructive',
          onPress: async () => {
            setJoiningLeaving(true);
            try { await leaveClub(club.id); refetchClub(); }
            catch { Alert.alert(t('club_leave_error')); }
            finally { setJoiningLeaving(false); }
          },
        },
      ]);
    } else {
      setJoiningLeaving(true);
      joinClub(club.id)
        .then(() => { refetchClub(); markClubRead(club.id); })
        .catch(() => Alert.alert(t('club_join_error')))
        .finally(() => setJoiningLeaving(false));
    }
  };

  const handleShare = async () => {
    if (!club) return;
    try {
      await Share.share({
        message: `Junta-te ao clube "${club.name}" no Cadence Club!${club.city ? ` · ${club.city}` : ''}`,
      });
    } catch {
      // utilizador cancelou
    }
  };

  const handleTogglePrivacy = () => {
    if (!club) return;
    const makingPrivate = !club.is_private;
    Alert.alert(
      makingPrivate ? t('club_make_private') : t('club_make_public'),
      makingPrivate
        ? t('club_make_private_body')
        : t('club_make_public_body'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('club_confirm'),
          onPress: async () => {
            try { await setClubPrivacy(club.id, makingPrivate); refetchClub(); }
            catch { Alert.alert(t('club_privacy_error')); }
          },
        },
      ],
    );
  };

  const confirmDeleteClub = () => {
    if (!club) return;
    Alert.alert(
      t('club_delete'),
      t('club_delete_confirm', { name: club.name }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'), style: 'destructive',
          onPress: async () => {
            try { await deleteClub(club.id); router.back(); }
            catch { Alert.alert(t('club_delete_error')); }
          },
        },
      ],
    );
  };

  const handleOwnerMenu = () => {
    if (!club) return;
    Alert.alert(club.name, t('club_manage'), [
      { text: club.is_private ? t('club_make_public') : t('club_make_private'), onPress: handleTogglePrivacy },
      { text: t('club_delete'), style: 'destructive', onPress: confirmDeleteClub },
      { text: t('cancel'), style: 'cancel' },
    ]);
  };

  if (clubLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
        </View>
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  if (!club) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
        </View>
        <View style={styles.center}><Text style={styles.errorText}>{t('club_not_found')}</Text></View>
      </SafeAreaView>
    );
  }

  const catDef = club.category ? ACTIVITY_CATEGORIES.find((c) => c.key === club.category) : null;
  const visibleActivities = (activities as Activity[]).filter((a) => !deletedActivityIds.has(a.id));

  const joinLabel = club.is_member
    ? club.role === 'admin' ? t('club_role_admin') : t('club_role_member')
    : club.is_private
      ? club.request_status === 'pending' ? t('club_join_pending') : t('club_join_request')
      : t('club_join');
  const joinSecondary = club.is_member || club.request_status === 'pending';

  // Indicador que interpola com o gesto do pager (como no menu Social)
  const ready = tabLayouts.length === TABS.length && tabLayouts.every(Boolean);
  const indicatorLeft = ready
    ? scrollX.interpolate({
        inputRange: TABS.map((_, i) => i * width),
        outputRange: tabLayouts.map((l) => l.x),
        extrapolate: 'clamp',
      })
    : new Animated.Value(0);
  const indicatorWidth = ready
    ? scrollX.interpolate({
        inputRange: TABS.map((_, i) => i * width),
        outputRange: tabLayouts.map((l) => l.width),
        extrapolate: 'clamp',
      })
    : new Animated.Value(0);

  const emptyBlock = (icon: keyof typeof Ionicons.glyphMap, title: string, sub: string) => (
    <View style={styles.emptyContent}>
      <Ionicons name={icon} size={40} color={colors.mutedForeground} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{club.name}</Text>
        {isOwner ? (
          <TouchableOpacity onPress={handleOwnerMenu} hitSlop={12} accessibilityLabel={t('club_manage')}>
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.foreground} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 32 }} />
        )}
      </View>

      {/* ── Identidade do clube ── */}
      <View style={styles.infoBanner}>
        {club.avatar_url
          ? <Avatar uri={club.avatar_url} size={60} radius={18} />
          : (
            <View style={styles.avatarLg}>
              <Text style={styles.avatarLgLetter}>{club.name[0]?.toUpperCase()}</Text>
            </View>
          )}

        <View style={styles.bannerRight}>
          <Text style={styles.clubName} numberOfLines={2}>{club.name}</Text>
          <View style={styles.clubMeta}>
            {catDef && (
              <View style={styles.metaItem}>
                <ActivityIcon activityKey={catDef.activities[0]?.key ?? ''} size={11} tintColor={colors.mutedForeground} />
                <Text style={styles.metaText}>{catDef.key}</Text>
              </View>
            )}
            {club.city && (
              <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={11} color={colors.mutedForeground} />
                <Text style={styles.metaText}>{club.city}</Text>
              </View>
            )}
            <View style={styles.metaItem}>
              <Ionicons name="people-outline" size={11} color={colors.mutedForeground} />
              <Text style={styles.metaText}>{club.member_count}</Text>
            </View>
            {club.is_private && (
              <View style={styles.metaItem}>
                <Ionicons name="lock-closed" size={11} color={colors.warning} />
                <Text style={[styles.metaText, { color: colors.warning }]}>{t('club_private')}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {!!club.description && (
        <Text style={styles.desc} numberOfLines={2}>{club.description}</Text>
      )}

      {/* Ações */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.primaryBtn, joinSecondary && styles.secondaryBtn]}
          onPress={handleJoinLeave}
          disabled={joiningLeaving}
        >
          {joiningLeaving
            ? <ActivityIndicator size="small" color={joinSecondary ? colors.primary : colors.primaryForeground} />
            : (
              <>
                {club.is_member && <Ionicons name="checkmark" size={15} color={colors.primary} />}
                <Text style={[styles.primaryBtnText, joinSecondary && styles.secondaryBtnText]}>
                  {joinLabel}
                </Text>
              </>
            )}
        </TouchableOpacity>

        {isMember && (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.push(`/club/${club.id}/chat`)}
            accessibilityLabel={t('club_open_chat')}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.iconBtn} onPress={handleShare} accessibilityLabel={t('club_share')}>
          <Ionicons name="share-social-outline" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Estatísticas do grupo */}
      <View style={styles.statsStrip}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats ? (stats.total_distance / 1000).toFixed(0) : '—'}</Text>
          <Text style={styles.statLabel}>{t('club_stat_total_km')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats ? (stats.month_distance / 1000).toFixed(0) : '—'}</Text>
          <Text style={styles.statLabel}>{t('club_stat_month_km')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats?.total_activities ?? '—'}</Text>
          <Text style={styles.statLabel}>{t('club_stat_activities')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats?.active_members ?? '—'}</Text>
          <Text style={styles.statLabel}>{t('club_stat_active')}</Text>
        </View>
      </View>

      {/* ── Barra de abas ── */}
      <View style={styles.tabs} accessibilityRole="tablist">
        {TABS.map((tab, i) => {
          const isActive = i === activeIndex;
          const showBadge = tab.key === 'members' && isAdmin && pendingRequests.length > 0;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tab}
              onPress={() => goToTab(i)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              onLayout={(e) => {
                const { x, width: w } = e.nativeEvent.layout;
                setTabLayouts((prev) => {
                  const next = [...prev];
                  next[i] = { x, width: w };
                  return next;
                });
              }}
            >
              <View style={styles.tabLabelRow}>
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{t(tab.i18n_key as any)}</Text>
                {showBadge && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{pendingRequests.length}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
        {ready && (
          <Animated.View style={[styles.tabIndicator, { left: indicatorLeft, width: indicatorWidth }]} />
        )}
      </View>

      {/* ── Pager deslizável ── */}
      <Animated.ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false },
        )}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setActiveIndex(index);
          setVisited((prev) => new Set(prev).add(TABS[index].key));
        }}
        style={styles.pager}
      >
        {/* Publicações */}
        <View style={{ width }}>
          <FlatList
            data={visibleActivities}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <SocialPostCard
                activity={item}
                onDeleted={() => setDeletedActivityIds((prev) => new Set([...prev, item.id]))}
              />
            )}
            ListEmptyComponent={emptyBlock(
              'pulse-outline',
              t('club_no_activities'),
              isMember ? t('club_no_activities_member') : t('club_no_activities_visitor'),
            )}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={activitiesFetching} onRefresh={refetchActivities} tintColor={colors.primary} />
            }
          />
        </View>

        {/* Eventos */}
        <View style={{ width }}>
          <FlatList
            data={events}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={
              <View style={styles.eventsBar}>
                <View style={styles.segment}>
                  {[
                    { key: false, label: t('club_events_upcoming') },
                    { key: true, label: t('club_events_past') },
                  ].map((opt) => (
                    <TouchableOpacity
                      key={String(opt.key)}
                      style={[styles.segmentBtn, eventsPast === opt.key && styles.segmentBtnActive]}
                      onPress={() => setEventsPast(opt.key)}
                    >
                      <Text style={[styles.segmentText, eventsPast === opt.key && styles.segmentTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {isAdmin && (
                  <TouchableOpacity
                    style={styles.newEventBtn}
                    onPress={() => router.push(`/club/${club.id}/event-new`)}
                  >
                    <Ionicons name="add" size={16} color={colors.primaryForeground} />
                    <Text style={styles.newEventText}>{t('club_event')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
            renderItem={({ item }) => (
              <EventCard
                event={item}
                canAttend={isMember}
                canDelete={isAdmin}
                onChanged={refetchEvents}
              />
            )}
            ListEmptyComponent={emptyBlock(
              'calendar-outline',
              eventsPast ? t('club_no_past_events') : t('club_no_events'),
              eventsPast
                ? t('club_no_past_events_body')
                : isAdmin
                  ? t('club_no_events_admin')
                  : t('club_no_events_member'),
            )}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={eventsFetching} onRefresh={refetchEvents} tintColor={colors.primary} />
            }
          />
        </View>

        {/* Membros */}
        <View style={{ width }}>
          <FlatList
            data={members as ClubMember[]}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={
              isAdmin && pendingRequests.length > 0 ? (
                <View>
                  <Text style={styles.sectionHeader}>Pedidos de adesão ({pendingRequests.length})</Text>
                  {pendingRequests.map((req) => (
                    <View key={req.id} style={styles.requestRow}>
                      <TouchableOpacity onPress={() => router.push(`/profile/${req.user_id}`)}>
                        <Avatar uri={req.profile?.avatar_url} name={req.profile?.full_name} size={44} />
                      </TouchableOpacity>
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>{req.profile?.full_name ?? 'Atleta'}</Text>
                        <Text style={styles.memberHandle}>@{req.profile?.username ?? ''}</Text>
                      </View>
                      <TouchableOpacity style={styles.acceptBtn} onPress={() => handleRespond(req, true)} hitSlop={6}>
                        <Ionicons name="checkmark" size={18} color={colors.primaryForeground} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.rejectBtn} onPress={() => handleRespond(req, false)} hitSlop={6}>
                        <Ionicons name="close" size={18} color={colors.destructive} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <Text style={styles.sectionHeader}>{t('club_tab_members')}</Text>
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.memberRow}
                onPress={() => router.push(`/profile/${item.user_id}`)}
                activeOpacity={0.7}
              >
                <Avatar uri={item.profile?.avatar_url} name={item.profile?.full_name} size={44} />
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{item.profile?.full_name ?? 'Atleta'}</Text>
                  <Text style={styles.memberHandle}>@{item.profile?.username ?? ''}</Text>
                </View>
                {item.role === 'admin' && (
                  <View style={styles.adminPill}>
                    <Ionicons name="shield-checkmark" size={11} color={colors.primary} />
                    <Text style={styles.adminText}>{t('club_role_admin')}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={emptyBlock('people-outline', t('club_no_members'), t('club_no_members_body'))}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={membersFetching} onRefresh={refetchMembers} tintColor={colors.primary} />
            }
          />
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { ...typography.body, color: colors.mutedForeground },
  pager: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 18,
    color: colors.foreground,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },

  // Banner
  infoBanner: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    backgroundColor: colors.card,
  },
  bannerRight: { flex: 1, justifyContent: 'center' },
  avatarLg: {
    width: 60, height: 60, borderRadius: 18,
    backgroundColor: withAlpha(colors.primary, 0.15),
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLgLetter: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 28, color: colors.primary },
  clubName: {
    fontFamily: 'BarlowCondensed_900Black', fontSize: 22,
    color: colors.foreground, marginBottom: 5, textTransform: 'uppercase',
  },
  clubMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { ...typography.body, fontSize: 12, color: colors.mutedForeground },

  desc: {
    ...typography.body, fontSize: 13, color: colors.mutedForeground,
    paddingHorizontal: 16, paddingBottom: 10, lineHeight: 18,
    backgroundColor: colors.card,
  },

  // Ações
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.card,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: colors.primary,
  },
  secondaryBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: withAlpha(colors.primary, 0.4),
  },
  primaryBtnText: { fontFamily: 'Barlow_600SemiBold', fontSize: 14, color: colors.primaryForeground },
  secondaryBtnText: { color: colors.primary },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: withAlpha(colors.primary, 0.3),
  },

  // Estatísticas
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: 10,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 4 },
  statValue: { fontFamily: 'BarlowCondensed_900Black', fontSize: 20, color: colors.foreground },
  statLabel: {
    fontFamily: 'Barlow_500Medium', fontSize: 9, letterSpacing: 0.8,
    color: colors.mutedForeground, textTransform: 'uppercase', marginTop: 1,
  },

  // Abas
  tabs: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
    position: 'relative',
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tabText: { fontFamily: 'Barlow_500Medium', fontSize: 14, color: colors.mutedForeground },
  tabTextActive: { fontFamily: 'Barlow_600SemiBold', color: colors.foreground },
  tabIndicator: {
    position: 'absolute', bottom: 0,
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: 1,
  },
  tabBadge: {
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: { fontFamily: 'Barlow_600SemiBold', fontSize: 10, color: colors.primaryForeground },

  // Barra da aba Eventos
  eventsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: withAlpha(colors.foreground, 0.06),
    borderRadius: 18,
    padding: 3,
  },
  segmentBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 15 },
  segmentBtnActive: { backgroundColor: colors.card },
  segmentText: { fontFamily: 'Barlow_500Medium', fontSize: 12, color: colors.mutedForeground },
  segmentTextActive: { fontFamily: 'Barlow_600SemiBold', color: colors.foreground },
  newEventBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 16, backgroundColor: colors.primary,
  },
  newEventText: { fontFamily: 'Barlow_600SemiBold', fontSize: 12, color: colors.primaryForeground },

  // Pedidos
  sectionHeader: {
    fontFamily: 'Barlow_600SemiBold', fontSize: 12,
    color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6,
  },
  requestRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10, gap: 12,
    backgroundColor: withAlpha(colors.primary, 0.05),
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  acceptBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  rejectBtn: {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 1, borderColor: withAlpha(colors.destructive, 0.4),
    alignItems: 'center', justifyContent: 'center',
  },

  // Membros
  memberRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 12,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  memberInfo: { flex: 1 },
  memberName: { ...typography.bodyBold, fontSize: 15, color: colors.foreground },
  memberHandle: { ...typography.body, fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
  adminPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: withAlpha(colors.primary, 0.1),
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  adminText: { fontFamily: 'Barlow_600SemiBold', fontSize: 11, color: colors.primary },

  // Vazio
  emptyContent: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 50, paddingHorizontal: 32, gap: 10,
  },
  emptyTitle: { ...typography.bodyBold, fontSize: 17, color: colors.foreground },
  emptySub: {
    ...typography.body, fontSize: 14, color: colors.mutedForeground,
    textAlign: 'center', lineHeight: 20,
  },
});
