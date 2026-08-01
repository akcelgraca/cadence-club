import React, { useCallback, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import PagerView, {
  PagerViewOnPageScrollEventData,
} from "react-native-pager-view";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import FeedTab from "./tabs/FeedTab";
import ClubsTab from "./tabs/ClubsTab";
import MessagesTab from "./tabs/MessagesTab";
import { useSocialStore } from "@/store/socialStore";

// TODO: mapear para o teu tema em src/lib (cores + Barlow/Barlow Condensed)
const COLORS = {
  accent: "#D85A30",
  text: "#1A1A1A",
  textMuted: "rgba(26,26,26,0.4)",
  background: "#FFFFFF",
  hairline: "rgba(0,0,0,0.12)",
  unread: "#1D9E75",
};

const TABS = [
  { key: "feed", label: "Feed" },
  { key: "clubs", label: "Clubs" },
  { key: "messages", label: "Mensagens" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const HEADER_ACTION: Record<TabKey, keyof typeof Feather.glyphMap> = {
  feed: "bell",
  clubs: "search",
  messages: "edit",
};

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

export default function SocialScreen() {
  const { width } = useWindowDimensions();
  const pagerRef = useRef<PagerView>(null);

  // posição contínua do pager: page + offset ∈ [0, 2]
  const scrollPosition = useRef(new Animated.Value(0)).current;

  const activeTab = useSocialStore((s) => s.activeTab);
  const setActiveTab = useSocialStore((s) => s.setActiveTab);
  const unreadMessages = useSocialStore((s) => s.unreadMessages);
  const unreadClubs = useSocialStore((s) => s.unreadClubs);

  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, TABS.findIndex((t) => t.key === activeTab)),
  );

  // larguras reais de cada label, medidas por onLayout
  const [tabLayouts, setTabLayouts] = useState<
    { x: number; width: number }[]
  >([]);

  const onPageScroll = Animated.event<PagerViewOnPageScrollEventData>(
    [{ nativeEvent: { position: scrollPosition, offset: undefined } }],
    {
      useNativeDriver: false,
      listener: (e) => {
        const { position, offset } = e.nativeEvent;
        scrollPosition.setValue(position + offset);
      },
    },
  );

  const onPageSelected = useCallback(
    (index: number) => {
      setActiveIndex(index);
      setActiveTab(TABS[index].key);
    },
    [setActiveTab],
  );

  const goToTab = useCallback((index: number) => {
    pagerRef.current?.setPage(index);
  }, []);

  const ready = tabLayouts.length === TABS.length;

  const indicatorLeft = ready
    ? scrollPosition.interpolate({
        inputRange: TABS.map((_, i) => i),
        outputRange: tabLayouts.map((l) => l.x),
        extrapolate: "clamp",
      })
    : 0;

  const indicatorWidth = ready
    ? scrollPosition.interpolate({
        inputRange: TABS.map((_, i) => i),
        outputRange: tabLayouts.map((l) => l.width),
        extrapolate: "clamp",
      })
    : 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Social</Text>
        <Pressable
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={
            activeIndex === 0
              ? "Notificações"
              : activeIndex === 1
                ? "Pesquisar clubes"
                : "Nova mensagem"
          }
        >
          <Feather
            name={HEADER_ACTION[TABS[activeIndex].key]}
            size={22}
            color={COLORS.text}
          />
        </Pressable>
      </View>

      <View style={styles.tabBar} accessibilityRole="tablist">
        {TABS.map((tab, i) => {
          const isActive = i === activeIndex;
          const badge =
            tab.key === "messages"
              ? unreadMessages
              : tab.key === "clubs"
                ? unreadClubs
                : 0;
          return (
            <Pressable
              key={tab.key}
              onPress={() => goToTab(i)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={
                badge > 0 ? `${tab.label}, ${badge} por ler` : tab.label
              }
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
              <Text
                style={[
                  styles.tabLabel,
                  isActive && styles.tabLabelActive,
                ]}
              >
                {tab.label}
              </Text>
              {badge > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {badge > 99 ? "99+" : badge}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
        {ready && (
          <Animated.View
            style={[
              styles.indicator,
              { left: indicatorLeft, width: indicatorWidth },
            ]}
          />
        )}
      </View>

      <AnimatedPagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={activeIndex}
        onPageScroll={onPageScroll}
        onPageSelected={(e) => onPageSelected(e.nativeEvent.position)}
        overdrag={false}
      >
        <View key="feed" style={styles.page}>
          <FeedTab />
        </View>
        <View key="clubs" style={styles.page}>
          <ClubsTab />
        </View>
        <View key="messages" style={styles.page}>
          <MessagesTab />
        </View>
      </AnimatedPagerView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  title: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 26,
    color: COLORS.text,
  },
  tabBar: {
    flexDirection: "row",
    gap: 20,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.hairline,
  },
  tabItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 10,
  },
  tabLabel: {
    fontFamily: "Barlow_500Medium",
    fontSize: 14,
    color: COLORS.textMuted,
  },
  tabLabelActive: { color: COLORS.text },
  indicator: {
    position: "absolute",
    bottom: 0,
    height: 2,
    backgroundColor: COLORS.accent,
    borderRadius: 1,
  },
  badge: {
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: COLORS.unread,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    fontFamily: "Barlow_500Medium",
    fontSize: 11,
    color: "#FFFFFF",
  },
  pager: { flex: 1 },
  page: { flex: 1 },
});
