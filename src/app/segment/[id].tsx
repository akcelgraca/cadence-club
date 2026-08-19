import { useEffect, useMemo } from 'react';
import { useColors } from '../../hooks/useColors';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { getSegmentDetail, getMySegmentEfforts, percentFaster } from '../../services/segments';
import { ActivityIcon } from '../../components/common/ActivityIcon';
import { formatDuration, formatDate } from '../../utils/dateHelpers';
import { formatPace } from '../../utils/formatPace';
import { useSettingsStore } from '../../store/settingsStore';
import { typography, withAlpha, type Colors } from '../../lib/theme';
import { useTranslation } from 'react-i18next';
import { track } from '../../lib/analytics';

/**
 * Detalhe de um troço.
 *
 * Deliberadamente sem classificação: mostra a tua evolução neste troço e a
 * média da comunidade como referência, não como competição.
 */
export default function SegmentScreen() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const unitSystem = useSettingsStore((s) => s.settings.unitSystem);

  const { data: segment, isLoading } = useQuery({
    queryKey: ['segment', id],
    queryFn: () => getSegmentDetail(id),
    enabled: !!id,
  });

  const { data: efforts = [] } = useQuery({
    queryKey: ['segmentEfforts', id],
    queryFn: () => getMySegmentEfforts(id),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  if (!segment) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t('segment_not_found')}</Text>
      </View>
    );
  }

  const vsCommunity = percentFaster(segment.my_best ?? 0, segment.community_avg);
  // Barras do histórico proporcionais ao pior tempo
  const slowest = efforts.length > 0 ? Math.max(...efforts.map((e) => e.duration)) : 0;

  // O histórico de passagens é o que fica atrás do paywall — só conta quando
  // há mais do que uma, que é quando passa a ter valor.
  useEffect(() => {
    if (efforts.length > 1) track('premium_feature_used', { feature: 'segment_history' });
  }, [efforts.length]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: segment.name }} />

      {/* Identidade do troço */}
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <ActivityIcon activityKey={segment.activity_type} size={22} tintColor={c.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{segment.name}</Text>
          <Text style={styles.meta}>
            {(segment.distance / 1000).toFixed(2).replace('.', ',')} km
            {segment.elevation_gain >= 1 ? ` · +${Math.round(segment.elevation_gain)} m` : ''}
            {segment.city ? ` · ${segment.city}` : ''}
          </Text>
        </View>
      </View>

      {!!segment.description && (
        <Text style={styles.description}>{segment.description}</Text>
      )}

      {/* Os meus números */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('segment_your_history')}</Text>

        {segment.my_attempts === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="footsteps-outline" size={32} color={c.mutedForeground} />
            <Text style={styles.emptyTitle}>{t('segment_never_run')}</Text>
            <Text style={styles.emptySub}>
              {t('segment_never_run_body')}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{formatDuration(segment.my_best ?? 0)}</Text>
                <Text style={styles.statLabel}>{t('segment_best')}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>{formatDuration(segment.my_average ?? 0)}</Text>
                <Text style={styles.statLabel}>{t('segment_average')}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>{segment.my_attempts}</Text>
                <Text style={styles.statLabel}>
                  {segment.my_attempts === 1 ? 'passagem' : 'passagens'}
                </Text>
              </View>
            </View>

            {/* Histórico: barra por passagem, da mais recente para trás */}
            {efforts.length > 1 && (
              <View style={styles.history}>
                {efforts.map((effort) => {
                  const isBest = effort.duration === segment.my_best;
                  const width = slowest > 0 ? (effort.duration / slowest) * 100 : 100;
                  return (
                    <TouchableOpacity
                      key={effort.id}
                      style={styles.effortRow}
                      onPress={() => router.push(`/activity/${effort.activity_id}`)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.effortDate}>{formatDate(effort.started_at)}</Text>
                      <View style={styles.effortBarTrack}>
                        <View
                          style={[
                            styles.effortBar,
                            { width: `${width}%` },
                            isBest && styles.effortBarBest,
                          ]}
                        />
                      </View>
                      <Text style={[styles.effortTime, isBest && styles.effortTimeBest]}>
                        {formatDuration(effort.duration)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}
      </View>

      {/* Referência da comunidade — média, nunca classificação */}
      {segment.community_avg != null && segment.community_people > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('segment_community')}</Text>
          <View style={styles.communityRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.communityValue}>{formatDuration(segment.community_avg)}</Text>
              <Text style={styles.communityLabel}>
                média de {segment.community_people}{' '}
                {segment.community_people === 1 ? 'atleta' : 'atletas'}
              </Text>
            </View>
            {segment.my_best != null && vsCommunity != null && Math.abs(vsCommunity) >= 1 && (
              <View style={styles.communityDiff}>
                <Ionicons
                  name={vsCommunity > 0 ? 'trending-up' : 'trending-down'}
                  size={14}
                  color={vsCommunity > 0 ? c.primary : c.mutedForeground}
                />
                <Text style={[styles.communityDiffText, vsCommunity > 0 && styles.communityDiffFaster]}>
                  {Math.abs(vsCommunity).toFixed(0)}% {vsCommunity > 0 ? t('activity_faster') : t('activity_slower')}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.communityNote}>
            {t('segment_community_body')}
          </Text>
        </View>
      )}

      {segment.my_best != null && (
        <Text style={styles.paceNote}>
          Ritmo do teu melhor tempo:{' '}
          {formatPace(segment.my_best / (segment.distance / 1000), unitSystem)}
        </Text>
      )}
    </ScrollView>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: 16, paddingBottom: 40 },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.background, padding: 32,
  },
  errorText: { ...typography.body, fontSize: 15, color: c.mutedForeground },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  iconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: withAlpha(c.primary, 0.12),
    alignItems: 'center', justifyContent: 'center',
  },
  name: {
    fontFamily: 'BarlowCondensed_900Black',
    fontSize: 24,
    color: c.foreground,
    textTransform: 'uppercase',
  },
  meta: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 12,
    color: c.mutedForeground,
    marginTop: 2,
  },
  description: {
    ...typography.body, fontSize: 14, color: c.mutedForeground,
    lineHeight: 20, marginBottom: 16,
  },

  card: {
    backgroundColor: c.card,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  cardTitle: { ...typography.headline, fontSize: 17, color: c.foreground, marginBottom: 14 },

  statsRow: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center' },
  statDivider: {
    width: StyleSheet.hairlineWidth, height: 30, backgroundColor: c.border,
  },
  statValue: {
    fontFamily: 'BarlowCondensed_900Black', fontSize: 24, color: c.foreground,
  },
  statLabel: {
    fontFamily: 'Barlow_500Medium', fontSize: 9, letterSpacing: 0.8,
    color: c.mutedForeground, textTransform: 'uppercase', marginTop: 1,
  },

  history: {
    marginTop: 18, paddingTop: 14, gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border,
  },
  effortRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  effortDate: {
    width: 74,
    fontFamily: 'DMMono_400Regular', fontSize: 11, color: c.mutedForeground,
  },
  effortBarTrack: {
    flex: 1, height: 8, borderRadius: 4,
    backgroundColor: withAlpha(c.foreground, 0.06),
    overflow: 'hidden',
  },
  effortBar: { height: 8, borderRadius: 4, backgroundColor: withAlpha(c.primary, 0.4) },
  effortBarBest: { backgroundColor: c.primary },
  effortTime: {
    width: 58, textAlign: 'right',
    fontFamily: 'DMMono_400Regular', fontSize: 12, color: c.foreground,
  },
  effortTimeBest: { color: c.primary, fontFamily: 'DMMono_500Medium' },

  empty: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  emptyTitle: { ...typography.bodyBold, fontSize: 15, color: c.foreground },
  emptySub: {
    ...typography.body, fontSize: 13, color: c.mutedForeground,
    textAlign: 'center', lineHeight: 18,
  },

  communityRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  communityValue: {
    fontFamily: 'BarlowCondensed_900Black', fontSize: 26, color: c.foreground,
  },
  communityLabel: {
    ...typography.body, fontSize: 12, color: c.mutedForeground, marginTop: 1,
  },
  communityDiff: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  communityDiffText: {
    fontFamily: 'Barlow_600SemiBold', fontSize: 12, color: c.mutedForeground,
  },
  communityDiffFaster: { color: c.primary },
  communityNote: {
    ...typography.body, fontSize: 11, lineHeight: 15,
    color: c.mutedForeground,
    marginTop: 14, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: withAlpha(c.foreground, 0.08),
  },

  paceNote: {
    ...typography.body, fontSize: 12, color: c.mutedForeground,
    textAlign: 'center', marginTop: 20,
  },
});
