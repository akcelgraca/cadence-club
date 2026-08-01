import { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router/react-navigation';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSocialStore } from '../../store/socialStore';
import { useUnreadCount } from '../../hooks/useNotifications';
import { getTotalUnread } from '../../services/messages';
import { getUnreadClubMessagesCount, getPendingRequestsForMyClubs } from '../../services/clubs';
import { FeedTab } from '../../components/social/FeedTab';
import { ClubsTab } from '../../components/social/ClubsTab';
import { MessagesTab } from '../../components/social/MessagesTab';
import { colors, typography } from '../../lib/theme';

const TABS = [
  { key: 'feed', label: 'Feed' },
  { key: 'clubs', label: 'Clubes' },
  { key: 'messages', label: 'Mensagens' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const HEADER_ICON: Record<TabKey, keyof typeof Ionicons.glyphMap> = {
  feed: 'notifications-outline',
  clubs: 'search-outline',
  messages: 'create-outline',
};

export default function SocialScreen() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const { data: unreadCount = 0 } = useUnreadCount();

  const activeTab = useSocialStore((s) => s.activeTab);
  const setActiveTab = useSocialStore((s) => s.setActiveTab);
  const unreadMessages = useSocialStore((s) => s.unreadMessages);
  const unreadClubs = useSocialStore((s) => s.unreadClubs);
  const setUnreadMessages = useSocialStore((s) => s.setUnreadMessages);
  const setUnreadClubs = useSocialStore((s) => s.setUnreadClubs);

  // Badges — atualizados sempre que o ecrã ganha foco.
  // Mensagens: conversas diretas + chats de clube (é onde ambos vivem).
  // Clubes: pedidos de adesão à espera de aprovação — a única coisa
  // acionável que vive mesmo nesta aba.
  useFocusEffect(
    useCallback(() => {
      Promise.all([getTotalUnread(), getUnreadClubMessagesCount()])
        .then(([dms, clubMsgs]) => setUnreadMessages(dms + clubMsgs))
        .catch(() => {});
      getPendingRequestsForMyClubs()
        .then((reqs) => setUnreadClubs(reqs.length))
        .catch(() => {});
    }, [setUnreadMessages, setUnreadClubs]),
  );

  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, TABS.findIndex((t) => t.key === activeTab)),
  );

  const [tabLayouts, setTabLayouts] = useState<{ x: number; width: number }[]>([]);

  const goToTab = useCallback(
    (index: number) => {
      scrollRef.current?.scrollTo({ x: index * width, animated: true });
      setActiveIndex(index);
      setActiveTab(TABS[index].key);
    },
    [width, setActiveTab],
  );

  const handleHeaderAction = () => {
    const key = TABS[activeIndex].key;
    if (key === 'feed') router.push('/notifications');
    if (key === 'clubs') router.push('/club/discover');
    if (key === 'messages') router.push('/messages/new');
  };

  const ready = tabLayouts.length === TABS.length;

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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Social</Text>
        <Pressable
          hitSlop={12}
          onPress={handleHeaderAction}
          style={styles.headerAction}
          accessibilityRole="button"
        >
          <Ionicons name={HEADER_ICON[TABS[activeIndex].key]} size={22} color={colors.foreground} />
          {activeIndex === 0 && unreadCount > 0 && (
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar} accessibilityRole="tablist">
        {TABS.map((tab, i) => {
          const isActive = i === activeIndex;
          const badge = tab.key === 'messages' ? unreadMessages : tab.key === 'clubs' ? unreadClubs : 0;
          return (
            <Pressable
              key={tab.key}
              onPress={() => goToTab(i)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              style={styles.tabItem}
              onLayout={(e) => {
                const { x, width: w } = e.nativeEvent.layout;
                setTabLayouts((prev) => {
                  const next = [...prev];
                  next[i] = { x, width: w };
                  return next;
                });
              }}
            >
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
              {badge > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
        {ready && (
          <Animated.View style={[styles.indicator, { left: indicatorLeft, width: indicatorWidth }]} />
        )}
      </View>

      {/* Pager */}
      <Animated.ScrollView
        ref={scrollRef}
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
          setActiveTab(TABS[index].key);
        }}
        style={styles.pager}
      >
        <View style={[styles.page, { width }]}>
          <FeedTab />
        </View>
        <View style={[styles.page, { width }]}>
          <ClubsTab />
        </View>
        <View style={[styles.page, { width }]}>
          <MessagesTab />
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  title: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 28,
    color: colors.foreground,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerAction: { position: 'relative', padding: 4 },
  notifBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.destructive,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  notifBadgeText: { ...typography.mono, fontSize: 9, color: '#fff', fontWeight: '700' },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
  },
  tabLabel: {
    fontFamily: 'Barlow_500Medium',
    fontSize: 14,
    color: colors.mutedForeground,
  },
  tabLabelActive: { color: colors.foreground, fontFamily: 'Barlow_600SemiBold' },
  indicator: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: 1,
  },
  badge: {
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.destructive,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontFamily: 'Barlow_500Medium', fontSize: 11, color: '#fff' },
  pager: { flex: 1 },
  page: { flex: 1 },
});
