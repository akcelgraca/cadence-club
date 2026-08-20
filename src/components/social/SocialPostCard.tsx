import { useState, useRef, useCallback, useMemo } from 'react';
import { useColors } from '../../hooks/useColors';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  ScrollView, ActionSheetIOS, Alert, Platform,
  useWindowDimensions, Animated,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { Activity } from '../../lib/types';
import { Avatar } from '../common/Avatar';
import { ActivityIcon } from '../common/ActivityIcon';
import { formatDistance } from '../../utils/formatDistance';
import { formatPace } from '../../utils/formatPace';
import { formatDuration, formatRelativeTime } from '../../utils/dateHelpers';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { giveKudo, removeKudo, reportActivity, savePost } from '../../services/social';
import { deleteActivity } from '../../services/activities';
import { buildStaticMapUrl } from '../../lib/staticMap';
import { typography, withAlpha, type Colors } from '../../lib/theme';
import { getActivityByKey } from '../../lib/constants';
import { CommentsSheet } from './CommentsSheet';
import ShareSheet from '../share/ShareSheet';
import type { ShareCardData } from '../share/ShareActivityCard';
import type { LatLng } from '../share/RouteSketch';

// ─── helpers ────────────────────────────────────────────────────────────────

function parseStatValue(raw: string): { num: string; unit: string } {
  // e.g. "8.4 km" → { num: "8.4", unit: "km" }
  //      "5'30\"/km" → { num: "5'30\"", unit: "/km" }
  const m = raw.match(/^([0-9:.,''"""]+)\s*(.*)$/);
  return m ? { num: m[1], unit: m[2] } : { num: raw, unit: '' };
}

// ─── sub-components ──────────────────────────────────────────────────────────

interface StatBoxProps {
  value: string;
  label: string;
  flex?: number;
}
function StatBox({ value, label, flex = 1 }: StatBoxProps) {
  const c = useColors();
  const statStyles = useMemo(() => makeStatStyles(c), [c]);
  const { num, unit } = parseStatValue(value);
  return (
    <View style={[statStyles.box, { flex }]}>
      <View style={statStyles.valueRow}>
        <Text style={statStyles.num} numberOfLines={1}>{num}</Text>
        {!!unit && <Text style={statStyles.unit}>{unit}</Text>}
      </View>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const makeStatStyles = (c: Colors) => StyleSheet.create({
  box: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3, flexWrap: 'nowrap' },
  num: {
    fontFamily: 'BarlowCondensed_900Black',
    fontSize: 26,
    color: c.foreground,
    letterSpacing: 0.3,
  },
  unit: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 13,
    color: c.mutedForeground,
    marginBottom: 2,
  },
  label: {
    fontFamily: 'Barlow_500Medium',
    fontSize: 10,
    letterSpacing: 1.2,
    color: c.mutedForeground,
    textTransform: 'uppercase',
    marginTop: 1,
  },
});

// ─── main component ──────────────────────────────────────────────────────────

interface SocialPostCardProps {
  activity: Activity;
  onDeleted?: () => void;
}

export function SocialPostCard({ activity, onDeleted }: SocialPostCardProps) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
  const { width: screenW } = useWindowDimensions();
  const unitSystem = useSettingsStore((s) => s.settings.unitSystem);
  const { profile } = useAuthStore();

  const [boosted, setBoosted] = useState(activity.has_kudosed ?? false);
  const [kudosCount, setKudosCount] = useState(activity.kudos_count ?? 0);
  const [commentsCount, setCommentsCount] = useState(activity.comments_count ?? 0);
  const [activeSlide, setActiveSlide] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);

  const boostScale = useRef(new Animated.Value(1)).current;
  const burstScale = useRef(new Animated.Value(0)).current;
  const burstOpacity = useRef(new Animated.Value(0)).current;
  const lastTapRef = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const isOwn = profile?.id === activity.user_id;

  const activityDef = getActivityByKey(activity.type);
  const activityLabel = activityDef ? t(activityDef.i18n_key as any) : activity.type;
  const isDistanceBased = activityDef?.distance_based ?? false;

  // ── media ──────────────────────────────────────────────────────────────────
  // Um post tem SEMPRE pelo menos uma imagem: o mapa do percurso é gerado
  // automaticamente quando há rota; sem rota nem foto, entra um placeholder
  // com a imagem da modalidade.
  // Mapa gerado em 4:5 para encher o mesmo enquadramento das fotos
  const mapUrl = activity.route_summary && activity.route_summary.length >= 2
    ? buildStaticMapUrl(activity.route_summary, 'C7F732', 800, 1000)
    : null;

  type Slide =
    | { type: 'map' | 'photo'; url: string; generated?: boolean }
    | { type: 'placeholder'; url?: undefined; generated?: undefined };

  // Galeria completa quando vem na query; senão a capa, para queries antigas
  const galleryPhotos = activity.photos?.length
    ? [...activity.photos].sort((a, b) => {
        // Fotos reais primeiro, cartão gerado no fim
        if (!!a.is_generated !== !!b.is_generated) return a.is_generated ? 1 : -1;
        return a.position - b.position;
      })
    : activity.photo_url
      ? [{ id: 'cover', url: activity.photo_url, is_generated: false } as any]
      : [];

  const slides: Slide[] = [
    ...(mapUrl ? [{ type: 'map' as const, url: mapUrl }] : []),
    ...galleryPhotos.map((p) => ({
      type: 'photo' as const,
      url: p.url,
      // PNG transparente com texto branco: precisa de fundo escuro e de
      // caber inteiro, senão fica invisível ou cortado
      generated: !!p.is_generated,
    })),
  ];
  if (slides.length === 0) slides.push({ type: 'placeholder' });

  const mediaH = screenW * (5 / 4); // 4:5 vertical (formato Instagram)

  // ── actions ────────────────────────────────────────────────────────────────
  const handleBoost = useCallback(async () => {
    const next = !boosted;
    setBoosted(next);
    setKudosCount((c) => c + (next ? 1 : -1));
    Animated.sequence([
      Animated.spring(boostScale, { toValue: 1.35, useNativeDriver: true, speed: 80, bounciness: 18 }),
      Animated.spring(boostScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }),
    ]).start();
    try {
      if (next) await giveKudo(activity.id);
      else await removeKudo(activity.id);
    } catch {
      setBoosted(!next);
      setKudosCount((c) => c + (next ? -1 : 1));
    }
  }, [boosted, activity.id, boostScale]);

  /** Double-tap na media dá boost (nunca remove, à Instagram) + animação. */
  const handleDoubleTapBoost = useCallback(() => {
    burstScale.setValue(0.4);
    burstOpacity.setValue(1);
    Animated.parallel([
      Animated.spring(burstScale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 12 }),
      Animated.sequence([
        Animated.delay(320),
        Animated.timing(burstOpacity, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]),
    ]).start();

    if (boosted) return;
    setBoosted(true);
    setKudosCount((c) => c + 1);
    giveKudo(activity.id).catch(() => {
      setBoosted(false);
      setKudosCount((c) => c - 1);
    });
  }, [boosted, activity.id, burstScale, burstOpacity]);

  const openActivity = useCallback(() => router.push(`/activity/${activity.id}`), [activity.id]);

  /** Um toque abre a atividade; dois toques rápidos dão boost. */
  const handleMediaTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      lastTapRef.current = 0;
      handleDoubleTapBoost();
      return;
    }
    lastTapRef.current = now;
    setTimeout(() => {
      // Só abre se entretanto não houve um segundo toque
      if (lastTapRef.current === now) {
        lastTapRef.current = 0;
        openActivity();
      }
    }, 300);
  }, [handleDoubleTapBoost, openActivity]);
  const openProfile = useCallback(() => {
    if (activity.profile?.username) router.push(`/profile/${activity.user_id}`);
  }, [activity.profile, activity.user_id]);

  const handleOptionsMenu = useCallback(() => {
    const ownOptions = [t('cancel'), t('post_delete')];
    const otherOptions = [t('cancel'), t('post_report'), t('post_save')];

    if (Platform.OS === 'ios') {
      if (isOwn) {
        ActionSheetIOS.showActionSheetWithOptions(
          { options: ownOptions, destructiveButtonIndex: 1, cancelButtonIndex: 0 },
          (i) => { if (i === 1) confirmDelete(); },
        );
      } else {
        ActionSheetIOS.showActionSheetWithOptions(
          { options: otherOptions, cancelButtonIndex: 0 },
          (i) => { if (i === 1) openReport(); if (i === 2) handleSave(); },
        );
      }
    } else {
      Alert.alert(t('post_options'), undefined, isOwn
        ? [{ text: t('post_delete'), style: 'destructive', onPress: confirmDelete }, { text: t('cancel'), style: 'cancel' }]
        : [{ text: t('post_report'), onPress: openReport }, { text: t('post_save'), onPress: handleSave }, { text: t('cancel'), style: 'cancel' }],
      );
    }
  }, [isOwn, t]);

  const confirmDelete = () => {
    Alert.alert(t('post_delete'), t('post_delete_confirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: async () => {
        try { await deleteActivity(activity.id); onDeleted?.(); }
        catch { Alert.alert(t('post_delete_error')); }
      }},
    ]);
  };

  const openReport = () => Alert.alert(t('post_report_title'), t('post_report_reason'), [
    { text: t('post_report_inappropriate'), onPress: () => submitReport('inappropriate') },
    { text: t('post_report_spam'), onPress: () => submitReport('spam') },
    { text: t('post_report_other'), onPress: () => submitReport('other') },
    { text: t('cancel'), style: 'cancel' },
  ]);

  const submitReport = async (reason: string) => {
    try { await reportActivity(activity.id, reason); Alert.alert(t('post_report_sent_title'), t('post_report_sent_body')); }
    catch { Alert.alert(t('post_report_error')); }
  };

  const handleSave = async () => {
    try {
      await savePost(activity.id);
      Alert.alert(t('post_saved_title'), t('post_saved_body'));
    } catch {
      Alert.alert(t('post_save_error'));
    }
  };

  // ── stats ──────────────────────────────────────────────────────────────────
  const distStr  = isDistanceBased && activity.distance > 0 ? formatDistance(activity.distance, unitSystem) : null;
  const paceStr  = isDistanceBased && activity.avg_pace > 0 ? formatPace(activity.avg_pace, unitSystem) : null;
  const timeStr  = activity.duration > 0 ? formatDuration(activity.duration) : null;
  const elevStr  = activity.elevation_gain > 0 ? `${Math.round(activity.elevation_gain)} m` : null;

  const statsCount = [distStr, paceStr, timeStr, elevStr].filter(Boolean).length;
  const hasStats = statsCount > 0;

  // ── share data ─────────────────────────────────────────────────────────────
  const routeCoords: LatLng[] = (activity.route_summary ?? []).map(([lat, lng]) => ({ latitude: lat, longitude: lng }));
  const shareData: ShareCardData = {
    distanceKm: activity.distance / 1000,
    paceSecPerKm: activity.avg_pace,
    durationSec: activity.duration,
    routeCoords,
  };

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.card}>

      {/* ── Author row ── */}
      <View style={styles.authorRow}>
        <TouchableOpacity onPress={openProfile} activeOpacity={0.8}>
          <Avatar uri={activity.profile?.avatar_url} name={activity.profile?.full_name} size={44} radius={22} />
        </TouchableOpacity>

        <View style={styles.authorInfo}>
          <View style={styles.authorTopRow}>
            <TouchableOpacity onPress={openProfile} activeOpacity={0.8}>
              <Text style={styles.authorName} numberOfLines={1}>{activity.profile?.full_name ?? 'Atleta'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.authorMetaRow}>
            <Text style={styles.authorMeta}>
              {formatRelativeTime(activity.created_at)}
              {activity.profile?.city ? ` · ${activity.profile.city}` : ''}
            </Text>
            <View style={styles.activityPill}>
              <ActivityIcon activityKey={activity.type} size={10} tintColor={c.primary} />
              <Text style={styles.activityPillText}>{activityLabel}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.dotsBtn} onPress={handleOptionsMenu} hitSlop={12}>
          <Ionicons name="ellipsis-horizontal" size={20} color={c.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* ── Title ── */}
      {!!activity.title && (
        <TouchableOpacity onPress={openActivity} activeOpacity={0.8} style={styles.titleRow}>
          <Text style={styles.postTitle}>{activity.title}</Text>
        </TouchableOpacity>
      )}

      {/* ── Stats — acima da media, nunca sobrepostas ── */}
      {hasStats && (
        <View style={styles.statsRow}>
          {distStr && (
            <>
              <StatBox value={distStr} label={t('distance')} />
              {(paceStr || timeStr || elevStr) && <View style={styles.statDivider} />}
            </>
          )}
          {paceStr && (
            <>
              <StatBox value={paceStr} label={t('pace')} />
              {(timeStr || elevStr) && <View style={styles.statDivider} />}
            </>
          )}
          {timeStr && (
            <>
              <StatBox value={timeStr} label={t('post_stat_time')} />
              {elevStr && <View style={styles.statDivider} />}
            </>
          )}
          {elevStr && (
            <StatBox value={elevStr} label={t('post_stat_elevation')} />
          )}
        </View>
      )}

      {/* ── Media carousel ── */}
      {slides.length > 0 && (
        <View style={{ width: screenW, height: mediaH }}>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onMomentumScrollEnd={(e) => setActiveSlide(Math.round(e.nativeEvent.contentOffset.x / screenW))}
            style={{ width: screenW, height: mediaH }}
          >
            {slides.map((slide, idx) => (
              <TouchableOpacity key={idx} activeOpacity={0.95} onPress={handleMediaTap}>
                <View style={{ width: screenW, height: mediaH }}>
                  {slide.type === 'placeholder' ? (
                    <View style={[styles.placeholderSlide, { width: screenW, height: mediaH }]}>
                      <ActivityIcon activityKey={activity.type} size={72} tintColor={c.primary} />
                      <Text style={styles.placeholderLabel}>{activityLabel}</Text>
                    </View>
                  ) : (
                    <Image
                      source={{ uri: slide.url }}
                      style={[
                        { width: screenW, height: mediaH },
                        slide.generated && styles.generatedSlide,
                      ]}
                      resizeMode={slide.generated ? 'contain' : 'cover'}
                    />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* burst do double-tap */}
          <Animated.View
            style={[
              styles.burst,
              { opacity: burstOpacity, transform: [{ scale: burstScale }] },
            ]}
            pointerEvents="none"
          >
            <Ionicons name="flash" size={96} color="#FFFFFF" />
          </Animated.View>

          {/* pagination dots */}
          {slides.length > 1 && (
            <View style={styles.dotsRow} pointerEvents="none">
              {slides.map((_, i) => (
                <View key={i} style={[styles.dot, i === activeSlide && styles.dotActive]} />
              ))}
            </View>
          )}
        </View>
      )}

      {/* ── Description ── */}
      {!!activity.description && (
        <TouchableOpacity
          style={styles.descRow}
          onPress={() => setDescExpanded((v) => !v)}
          activeOpacity={0.7}
        >
          <Text
            style={styles.descText}
            numberOfLines={descExpanded ? undefined : 2}
          >
            {activity.description}
          </Text>
          {activity.description.length > 80 && (
            <Text style={styles.descToggle}>{descExpanded ? t('post_show_less') : t('post_show_more')}</Text>
          )}
        </TouchableOpacity>
      )}

      {/* ── Kudos + Comments counts ── */}
      {(kudosCount > 0 || commentsCount > 0) && (
        <View style={styles.countsRow}>
          {kudosCount > 0 && (
            <View style={styles.countItem}>
              <Ionicons name="flash" size={13} color={c.primary} />
              <Text style={styles.countText}>{kudosCount} boost{kudosCount !== 1 ? 's' : ''}</Text>
            </View>
          )}
          {commentsCount > 0 && (
            <TouchableOpacity style={styles.countItem} onPress={() => setCommentsVisible(true)}>
              <Ionicons name="chatbubble" size={12} color={c.mutedForeground} />
              <Text style={styles.countText}>{commentsCount} comentário{commentsCount !== 1 ? 's' : ''}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Actions row ── */}
      <View style={styles.actionsRow}>
        {/* Boost */}
        <Animated.View style={{ transform: [{ scale: boostScale }] }}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleBoost} activeOpacity={0.7}>
            <Ionicons
              name={boosted ? 'flash' : 'flash-outline'}
              size={24}
              color={boosted ? c.primary : c.mutedForeground}
            />
            {boosted && <View style={styles.boostGlow} />}
          </TouchableOpacity>
        </Animated.View>

        {/* Comments */}
        <TouchableOpacity style={styles.actionBtn} onPress={() => setCommentsVisible(true)} activeOpacity={0.7}>
          <Ionicons name="chatbubble-outline" size={22} color={c.mutedForeground} />
        </TouchableOpacity>

        {/* Share */}
        <TouchableOpacity style={styles.actionBtn} onPress={() => setShareVisible(true)} activeOpacity={0.7}>
          <Ionicons name="share-social-outline" size={22} color={c.mutedForeground} />
        </TouchableOpacity>

        {/* Spacer + open activity */}
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={styles.openActivityBtn} onPress={openActivity} activeOpacity={0.7}>
          <Text style={styles.openActivityText}>{t('post_view_activity')}</Text>
          <Ionicons name="chevron-forward" size={14} color={c.primary} />
        </TouchableOpacity>
      </View>

      {/* ── Comment preview link ── */}
      {commentsCount > 0 && (
        <TouchableOpacity style={styles.commentsLink} onPress={() => setCommentsVisible(true)} activeOpacity={0.6}>
          <Text style={styles.commentsLinkText}>
            {commentsCount === 1 ? t('post_view_comments_one') : t('post_view_comments_other', { count: commentsCount })}
          </Text>
        </TouchableOpacity>
      )}

      {/* ── Separator ── */}
      <View style={styles.hairline} />

      {/* ── Modals ── */}
      <CommentsSheet
        activityId={activity.id}
        visible={commentsVisible}
        onClose={() => setCommentsVisible(false)}
        onCountChange={setCommentsCount}
      />
      <ShareSheet
        data={shareData}
        visible={shareVisible}
        onClose={() => setShareVisible(false)}
      />
    </View>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const makeStyles = (c: Colors) => StyleSheet.create({
  card: { backgroundColor: c.background },

  // Author
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  authorInfo: { flex: 1, minWidth: 0 },
  authorTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  authorName: { ...typography.bodyBold, fontSize: 15, color: c.foreground, flexShrink: 1 },
  authorMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  authorMeta: { ...typography.body, fontSize: 12, color: c.mutedForeground },
  activityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: withAlpha(c.primary, 0.1),
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  activityPillText: {
    fontFamily: 'Barlow_600SemiBold',
    fontSize: 10,
    color: c.primary,
  },
  dotsBtn: { padding: 4 },

  // Title
  titleRow: { paddingHorizontal: 14, paddingBottom: 8 },
  postTitle: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 18,
    color: c.foreground,
    lineHeight: 22,
  },

  // Placeholder (posts sem rota nem foto)
  placeholderSlide: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: withAlpha(c.primary, 0.08),
  },
  placeholderLabel: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 16,
    letterSpacing: 2,
    color: c.primary,
    textTransform: 'uppercase',
  },

  /** Cartão gerado: PNG transparente, precisa de fundo escuro para se ler. */
  generatedSlide: { backgroundColor: '#0c0c0c' },

  // Burst do double-tap
  burst: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
  },

  // Pagination dots
  dotsRow: {
    position: 'absolute',
    bottom: 8,
    left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: '#FFFFFF', width: 14, height: 5, borderRadius: 3 },

  // Stats — bloco entre o título e a media
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  statDivider: { width: StyleSheet.hairlineWidth, backgroundColor: c.border, marginVertical: 10 },

  // Description
  descRow: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 },
  descText: { ...typography.body, fontSize: 14, color: c.foreground, lineHeight: 20 },
  descToggle: { ...typography.bodyMedium, fontSize: 12, color: c.primary, marginTop: 2 },

  // Counts
  countsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 2,
  },
  countItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  countText: { ...typography.body, fontSize: 12, color: c.mutedForeground },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionBtn: { padding: 8, position: 'relative' },
  boostGlow: {
    position: 'absolute',
    top: 4, left: 4, right: 4, bottom: 4,
    borderRadius: 20,
    backgroundColor: withAlpha(c.primary, 0.15),
  },
  openActivityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
    paddingLeft: 8,
  },
  openActivityText: {
    fontFamily: 'Barlow_600SemiBold',
    fontSize: 12,
    color: c.primary,
  },

  // Comments link
  commentsLink: { paddingHorizontal: 14, paddingBottom: 10 },
  commentsLinkText: { ...typography.body, fontSize: 13, color: c.mutedForeground },

  // Separator
  hairline: {
    height: 8,
    backgroundColor: withAlpha(c.foreground, 0.04),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
});
