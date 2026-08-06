import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { getActivitySegments, percentFaster } from '../../services/segments';
import { formatDuration } from '../../utils/dateHelpers';
import { colors, typography, withAlpha } from '../../lib/theme';
import type { ActivitySegment } from '../../lib/types';
import { useTranslation } from 'react-i18next';

/**
 * Troços percorridos nesta atividade.
 *
 * Mostra o tempo desta passagem comparado com o teu melhor e com a média da
 * comunidade — sem classificações nem posições.
 */

function Comparison({ label, value, diff }: { label: string; value: string; diff: number | null }) {
  const { t } = useTranslation();
  const faster = diff != null && diff > 0;
  return (
    <View style={styles.compareItem}>
      <Text style={styles.compareLabel}>{label}</Text>
      <Text style={styles.compareValue}>{value}</Text>
      {diff != null && Math.abs(diff) >= 1 && (
        <Text style={[styles.compareDiff, faster && styles.compareDiffFaster]}>
          {faster ? '−' : '+'}{Math.abs(diff).toFixed(0)}%
        </Text>
      )}
    </View>
  );
}

function SegmentRow({ segment }: { segment: ActivitySegment }) {
  const { t } = useTranslation();
  const vsBest = percentFaster(segment.duration, segment.my_best);
  const vsCommunity = percentFaster(segment.duration, segment.community_avg);
  const isPersonalBest = segment.my_best != null && segment.duration <= segment.my_best;

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => router.push(`/segment/${segment.segment_id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.rowHeader}>
        <View style={styles.nameWrap}>
          <Text style={styles.name} numberOfLines={1}>{segment.name}</Text>
          <Text style={styles.meta}>
            {(segment.distance / 1000).toFixed(2).replace('.', ',')} km
            {segment.elevation_gain >= 1 ? ` · +${Math.round(segment.elevation_gain)} m` : ''}
          </Text>
        </View>
        <View style={styles.timeWrap}>
          <Text style={styles.time}>{formatDuration(segment.duration)}</Text>
          {isPersonalBest && segment.my_attempts > 1 && (
            <View style={styles.pbPill}>
              <Ionicons name="trophy" size={9} color={colors.primary} />
              <Text style={styles.pbText}>{t('segment_record')}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.compareRow}>
        {segment.my_attempts > 1 && segment.my_best != null && (
          <Comparison
            label={`O teu melhor (${segment.my_attempts}×)`}
            value={formatDuration(segment.my_best)}
            diff={vsBest}
          />
        )}
        {segment.community_avg != null && segment.community_people > 1 && (
          <Comparison
            label={`Média de ${segment.community_people} atletas`}
            value={formatDuration(segment.community_avg)}
            diff={vsCommunity}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

export function ActivitySegments({ activityId }: { activityId: string }) {
  const { data: segments = [] } = useQuery({
    queryKey: ['activitySegments', activityId],
    queryFn: () => getActivitySegments(activityId),
    enabled: !!activityId,
  });

  if (segments.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Troços <Text style={styles.count}>{segments.length}</Text>
      </Text>
      {segments.map((segment) => (
        <SegmentRow key={segment.segment_id} segment={segment} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  title: { ...typography.headline, fontSize: 18, color: colors.foreground, marginBottom: 4 },
  count: { fontFamily: 'DMMono_400Regular', fontSize: 14, color: colors.mutedForeground },

  row: {
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  nameWrap: { flex: 1, minWidth: 0 },
  name: { ...typography.bodyBold, fontSize: 15, color: colors.foreground },
  meta: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  timeWrap: { alignItems: 'flex-end', gap: 4 },
  time: {
    fontFamily: 'BarlowCondensed_900Black',
    fontSize: 22,
    lineHeight: 24,
    color: colors.foreground,
  },
  pbPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
    backgroundColor: withAlpha(colors.primary, 0.12),
  },
  pbText: {
    fontFamily: 'Barlow_600SemiBold',
    fontSize: 9,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  compareRow: { flexDirection: 'row', gap: 20, marginTop: 10 },
  compareItem: { flexShrink: 1 },
  compareLabel: {
    fontFamily: 'Barlow_500Medium',
    fontSize: 10,
    letterSpacing: 0.5,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
  },
  compareValue: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 13,
    color: colors.foreground,
    marginTop: 2,
  },
  compareDiff: {
    fontFamily: 'Barlow_600SemiBold',
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 1,
  },
  compareDiffFaster: { color: colors.primary },
});
