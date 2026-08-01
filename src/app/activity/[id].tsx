import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Image,
  TouchableOpacity, Alert, useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { deleteActivity } from '../../services/activities';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getActivity, getActivityPoints, getPaceComparison } from '../../services/activities';
import { hasKudosed } from '../../services/social';
import { SplitsTable } from '../../components/activity/SplitsTable';
import { ActivitySegments } from '../../components/activity/ActivitySegments';
import { Ionicons } from '@expo/vector-icons';
import { withAlpha } from '../../lib/theme';
import { formatDistance } from '../../utils/formatDistance';
import { formatPace } from '../../utils/formatPace';
import { useSettingsStore } from '../../store/settingsStore';
import { formatDuration, formatDate } from '../../utils/dateHelpers';
import { Avatar } from '../../components/common/Avatar';
import { BoostButton } from '../../components/social/BoostButton';
import { CommentThread } from '../../components/social/CommentThread';
import { ActivityMap } from '../../components/activity/ActivityMap';
import { ElevationProfile } from '../../components/activity/ElevationProfile';
import { ActivityIcon } from '../../components/common/ActivityIcon';
import { colors, typography } from '../../lib/theme';

const MOOD_IMAGES: Record<number, any> = {
  1: require('../../../assets/images/moods/sentimento-1-muito-mal.png'),
  2: require('../../../assets/images/moods/sentimento-2-mal.png'),
  3: require('../../../assets/images/moods/sentimento-3-neutro.png'),
  4: require('../../../assets/images/moods/sentimento-4-bem.png'),
  5: require('../../../assets/images/moods/sentimento-5-muito-bem.png'),
};

export default function ActivityDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const unitSystem = useSettingsStore((s) => s.settings.unitSystem);
  const myId = useAuthStore((s) => s.profile?.id);
  const [photoIndex, setPhotoIndex] = useState(0);
  const { width: screenW } = useWindowDimensions();
  const galleryWidth = screenW - 32; // o conteúdo tem 16 de padding de cada lado

  const { data: activity, isLoading } = useQuery({
    queryKey: ['activity', id],
    queryFn: () => getActivity(id),
    enabled: !!id,
  });

  const { data: kudosed = false } = useQuery({
    queryKey: ['hasKudosed', id],
    queryFn: () => hasKudosed(id),
    enabled: !!id,
  });

  const { data: activityPoints = [] } = useQuery({
    queryKey: ['activityPoints', id],
    queryFn: () => getActivityPoints(id),
    enabled: !!id,
  });

  const { data: paceComparison } = useQuery({
    queryKey: ['paceComparison', id],
    queryFn: () =>
      getPaceComparison(activity!.user_id, id, activity!.type, activity!.avg_pace),
    enabled: !!activity?.user_id && !!activity?.avg_pace && activity.avg_pace > 0,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!activity) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t('activity_not_found')}</Text>
      </View>
    );
  }

  const isOwner = !!myId && activity.user_id === myId;

  // Galeria (migração 037); a capa serve de recurso para dados antigos.
  // O cartão gerado vai para o fim e mostra-se sobre fundo escuro.
  const gallery = activity.photos?.length
    ? [...activity.photos].sort((a, b) => {
        if (!!a.is_generated !== !!b.is_generated) return a.is_generated ? 1 : -1;
        return a.position - b.position;
      })
    : activity.photo_url
      ? [{ url: activity.photo_url, is_generated: false } as any]
      : [];

  const handleOwnerMenu = () => {
    Alert.alert(activity.title || t('activity_detail_screen'), undefined, [
      { text: 'Editar', onPress: () => router.push(`/activity/${id}/edit`) },
      ...(activityPoints.length >= 2
        ? [{ text: 'Criar troço', onPress: () => router.push(`/activity/${id}/segment-new`) }]
        : []),
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: () => Alert.alert('Apagar atividade', 'Esta ação não pode ser desfeita.', [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Apagar',
            style: 'destructive',
            onPress: async () => {
              try { await deleteActivity(id); router.back(); }
              catch { Alert.alert('Erro', 'Não foi possível apagar a atividade.'); }
            },
          },
        ]),
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {isOwner && (
        <Stack.Screen
          options={{
            headerRight: () => (
              <TouchableOpacity onPress={handleOwnerMenu} hitSlop={12} accessibilityLabel="Gerir atividade">
                <Ionicons name="ellipsis-horizontal" size={20} color={colors.foreground} />
              </TouchableOpacity>
            ),
          }}
        />
      )}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.userRow}>
          <Avatar
            uri={activity.profile?.avatar_url}
            name={activity.profile?.full_name}
            size={48}
          />
          <View>
            <Text style={styles.userName}>{activity.profile?.full_name ?? 'User'}</Text>
            <Text style={styles.date}>{formatDate(activity.start_time)}</Text>
          </View>
        </View>
        <Text style={styles.typeIcon}>
          <ActivityIcon activityKey={activity.type} size={32} tintColor={colors.primary} />
        </Text>
      </View>

      {/* Metrics */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricItem}>
          <Text style={styles.metricValue}>{formatDistance(activity.distance, unitSystem)}</Text>
          <Text style={styles.metricLabel}>{t('distance')}</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricValue}>{formatDuration(activity.duration)}</Text>
          <Text style={styles.metricLabel}>{t('duration')}</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricValue}>{formatPace(activity.avg_pace, unitSystem)}</Text>
          <Text style={styles.metricLabel}>{t('avg_pace')}</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricValue}>{Math.round(activity.elevation_gain)}m</Text>
          <Text style={styles.metricLabel}>{t('elevation')}</Text>
        </View>
      </View>

      {/* Comparação com a média do próprio utilizador na mesma modalidade */}
      {paceComparison && Math.abs(paceComparison.percentDiff) >= 1 && (
        <View style={styles.comparisonRow}>
          <Ionicons
            name={paceComparison.percentDiff > 0 ? 'trending-up' : 'trending-down'}
            size={15}
            color={paceComparison.percentDiff > 0 ? colors.primary : colors.mutedForeground}
          />
          <Text style={styles.comparisonText}>
            <Text style={paceComparison.percentDiff > 0 ? styles.comparisonStrong : undefined}>
              {Math.abs(paceComparison.percentDiff).toFixed(0)}% {paceComparison.percentDiff > 0 ? 'mais rápido' : 'mais lento'}
            </Text>
            {' '}que a tua média ({formatPace(paceComparison.averagePace, unitSystem)})
          </Text>
        </View>
      )}

      {/* Mood */}
      {activity.mood && (
        <View style={styles.moodSection}>
          <Text style={styles.moodLabel}>{t('activity_how_was_it')}</Text>
          <Image source={MOOD_IMAGES[activity.mood]} style={styles.moodImage} />
        </View>
      )}

      {/* Title / Description */}
      {activity.title && <Text style={styles.title}>{activity.title}</Text>}
      {activity.description && <Text style={styles.description}>{activity.description}</Text>}

      {/* Activity Photo */}
      {gallery.length === 1 ? (
        <Image
          source={{ uri: gallery[0].url }}
          style={[styles.activityPhoto, gallery[0].is_generated && styles.generatedPhoto]}
          resizeMode={gallery[0].is_generated ? 'contain' : 'cover'}
        />
      ) : gallery.length > 1 ? (
        <View style={styles.gallery}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) =>
              setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / galleryWidth))
            }
          >
            {gallery.map((photo, i) => (
              <Image
                key={`${photo.url}-${i}`}
                source={{ uri: photo.url }}
                style={[
                  { width: galleryWidth, height: galleryWidth * 1.25 },
                  photo.is_generated && styles.generatedPhoto,
                ]}
                resizeMode={photo.is_generated ? 'contain' : 'cover'}
              />
            ))}
          </ScrollView>
          <View style={styles.galleryDots} pointerEvents="none">
            {gallery.map((_, i) => (
              <View key={i} style={[styles.galleryDot, i === photoIndex && styles.galleryDotActive]} />
            ))}
          </View>
        </View>
      ) : null}

      {/* Map */}
      {activity.route_summary && (
        <View style={{ marginBottom: 16 }}>
          <ActivityMap
            points={activity.route_summary.map((p) => ({ lat: p[0], lng: p[1] }))}
            height={200}
            terrain={true}
            hillshade={true}
            showContours={true}
          />
        </View>
      )}

      {/* Troços percorridos */}
      <ActivitySegments activityId={id} />

      {/* Parciais por quilómetro */}
      {activityPoints.length >= 2 && (
        <View style={styles.splitsSection}>
          <Text style={styles.splitsTitle}>Parciais</Text>
          <SplitsTable
            points={activityPoints.map((p) => ({
              lat: p.lat,
              lng: p.lng,
              elevation: p.elevation,
              timestamp: p.timestamp,
            }))}
          />
        </View>
      )}

      {/* Elevation Profile */}
      {activityPoints.length >= 2 && (
        <ElevationProfile
          points={activityPoints
            .filter((p) => p.elevation != null)
            .map((p) => ({ lat: p.lat, lng: p.lng, elevation: p.elevation! }))}
          height={160}
        />
      )}

      {/* Social row */}
      <View style={styles.socialRow}>
        <BoostButton
          activityId={activity.id}
          initialBoosted={kudosed}
          initialCount={activity.kudos_count ?? 0}
        />
      </View>

      {/* Comments */}
      <CommentThread activityId={activity.id} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  errorText: { ...typography.body, fontSize: 16, color: colors.destructive },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  userName: { ...typography.bodyBold, fontSize: 16, color: colors.foreground },
  date: { ...typography.body, fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
  typeIcon: { fontSize: 32 },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  metricItem: {
    width: '50%',
    paddingVertical: 16,
    alignItems: 'center',
  },
  metricValue: { ...typography.statNumber, fontSize: 28, color: colors.foreground, letterSpacing: 0.3 },
  metricLabel: {
    fontFamily: 'Barlow_500Medium',
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.mutedForeground,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: withAlpha(colors.primary, 0.07),
  },
  comparisonText: {
    ...typography.body,
    fontSize: 13,
    color: colors.mutedForeground,
    flex: 1,
    lineHeight: 18,
  },
  comparisonStrong: { fontFamily: 'Barlow_600SemiBold', color: colors.foreground },

  splitsSection: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  splitsTitle: { ...typography.headline, fontSize: 18, color: colors.foreground, marginBottom: 12 },

  moodSection: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  moodLabel: { ...typography.body, fontSize: 14, color: colors.mutedForeground },
  moodImage: { width: 32, height: 32, borderRadius: 16, tintColor: '#FFFFFF' },
  title: { ...typography.bodyBold, fontSize: 20, marginBottom: 8, color: colors.foreground },
  description: { ...typography.body, fontSize: 15, color: colors.mutedForeground, marginBottom: 16, lineHeight: 22 },
  activityPhoto: { width: '100%', aspectRatio: 4 / 5, borderRadius: 12, marginBottom: 16 },
  gallery: { borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
  /** Cartão gerado: PNG transparente, precisa de fundo escuro. */
  generatedPhoto: { backgroundColor: '#0c0c0c' },
  galleryDots: {
    position: 'absolute',
    bottom: 10, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 5,
  },
  galleryDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  galleryDotActive: { backgroundColor: '#FFFFFF', width: 16 },
  socialRow: { paddingVertical: 12, borderTopWidth: 1, borderColor: colors.border },
});
