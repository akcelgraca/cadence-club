import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ActivityIcon } from '../common/ActivityIcon';
import { formatDistance } from '../../utils/formatDistance';
import { useSettingsStore } from '../../store/settingsStore';
import { colors, typography, withAlpha } from '../../lib/theme';
import type { NearbyRoute } from '../../lib/types';

const DIFFICULTY_KEY: Record<string, string> = {
  easy: 'route_difficulty_easy', moderate: 'route_difficulty_moderate',
  hard: 'route_difficulty_hard', expert: 'route_difficulty_expert',
};

const SURFACE_KEY: Record<string, string> = {
  road: 'route_surface_road', trail: 'route_surface_trail',
  mixed: 'route_surface_mixed', track: 'route_surface_track',
};

interface RouteCarouselCardProps {
  route: NearbyRoute;
  width: number;
  isActive: boolean;
  isSaved: boolean;
  onToggleSave: () => void;
  onDetails: () => void;
  onFollow: () => void;
}

export function RouteCarouselCard({
  route, width, isActive, isSaved, onToggleSave, onDetails, onFollow,
}: RouteCarouselCardProps) {
  const { t } = useTranslation();
  const unitSystem = useSettingsStore((s) => s.settings.unitSystem);

  return (
    <TouchableOpacity
      style={[styles.card, { width }, isActive && styles.cardActive]}
      onPress={onDetails}
      activeOpacity={0.9}
    >
      {/* Linha de topo: nome + guardar */}
      <View style={styles.topRow}>
        <View style={styles.iconWrap}>
          <ActivityIcon activityKey={route.activity_type} size={16} tintColor={colors.primary} />
        </View>
        <Text style={styles.name} numberOfLines={1}>{route.name}</Text>
        <TouchableOpacity onPress={onToggleSave} hitSlop={10} style={styles.saveBtn}>
          <Ionicons
            name={isSaved ? 'bookmark' : 'bookmark-outline'}
            size={18}
            color={isSaved ? colors.primary : colors.mutedForeground}
          />
        </TouchableOpacity>
      </View>

      {/* Métricas */}
      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{formatDistance(route.distance, unitSystem)}</Text>
          <Text style={styles.metricLabel}>{t('stat_distance_lower2')}</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{Math.round(route.elevation_gain)} m</Text>
          <Text style={styles.metricLabel}>{t('stat_climb_lower')}</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <Text style={styles.metricValue}>
            {(route.distance_meters / 1000).toFixed(1).replace('.', ',')} km
          </Text>
          <Text style={styles.metricLabel}>{t('routes_away_from_you')}</Text>
        </View>
      </View>

      {/* Rodapé: etiquetas + ação */}
      <View style={styles.footer}>
        <View style={styles.tags}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{DIFFICULTY_KEY[route.difficulty] ? t(DIFFICULTY_KEY[route.difficulty] as any) : route.difficulty}</Text>
          </View>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{SURFACE_KEY[route.surface_type] ? t(SURFACE_KEY[route.surface_type] as any) : route.surface_type}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.followBtn} onPress={onFollow}>
          <Ionicons name="play" size={12} color={colors.primaryForeground} />
          <Text style={styles.followText}>{t('follow')}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  cardActive: { borderColor: colors.primary },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  iconWrap: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: withAlpha(colors.primary, 0.12),
    alignItems: 'center', justifyContent: 'center',
  },
  name: { ...typography.bodyBold, fontSize: 15, color: colors.foreground, flex: 1 },
  saveBtn: { padding: 2 },

  metrics: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  metric: { flex: 1, alignItems: 'center' },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
    backgroundColor: colors.border,
  },
  metricValue: {
    fontFamily: 'BarlowCondensed_900Black',
    fontSize: 19,
    lineHeight: 21,
    color: colors.foreground,
  },
  metricLabel: {
    fontFamily: 'Barlow_500Medium',
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
  },

  footer: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  tags: { flexDirection: 'row', gap: 6, flex: 1, flexWrap: 'wrap' },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: withAlpha(colors.foreground, 0.06),
  },
  tagText: {
    fontFamily: 'Barlow_500Medium',
    fontSize: 10,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: colors.primary,
  },
  followText: {
    fontFamily: 'Barlow_600SemiBold',
    fontSize: 12,
    color: colors.primaryForeground,
  },
});
