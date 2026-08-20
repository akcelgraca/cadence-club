import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useColors } from '../../hooks/useColors';
import { Ionicons } from '@expo/vector-icons';
import { typography, withAlpha, type Colors } from '../../lib/theme';
import { formatDistance } from '../../utils/formatDistance';
import { formatDuration } from '../../utils/dateHelpers';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../store/settingsStore';
import { getActivityByKey } from '../../lib/constants';
import type { NearbyRoute, RouteWaypoint } from '../../lib/types';

interface RouteDetailSheetProps {
  route: NearbyRoute | null;
  visible: boolean;
  onClose: () => void;
  onFollow: (route: NearbyRoute) => void;
  onDelete?: (route: NearbyRoute) => void;
  isOwner?: boolean;
}

export function RouteDetailSheet({
  route,
  visible,
  onClose,
  onFollow,
  onDelete,
  isOwner = false,
}: RouteDetailSheetProps) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const unitSystem = useSettingsStore((s) => s.settings.unitSystem);
  const { t } = useTranslation();

  const DIFFICULTY_LABELS: Record<string, string> = {
    easy: t('route_difficulty_easy'),
    moderate: t('route_difficulty_moderate'),
    hard: t('route_difficulty_hard'),
    expert: t('route_difficulty_expert'),
  };

  const SURFACE_LABELS: Record<string, string> = {
    road: t('route_surface_road'),
    trail: t('route_surface_trail'),
    mixed: t('route_surface_mixed'),
    track: t('route_surface_track'),
  };

  if (!route) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.routeName}>{route.name}</Text>
              <Text style={styles.routeCity}>{route.city}</Text>
            </View>

            {/* Activity type tag */}
            <View style={styles.tagRow}>
              <View style={styles.tag}>
                <Ionicons name="footsteps" size={12} color={c.primary} />
                <Text style={styles.tagText}>
                  {(() => {
                    const def = getActivityByKey(route.activity_type);
                    return def ? t(def.i18n_key as any) : route.activity_type;
                  })()}
                </Text>
              </View>
              <View style={styles.tag}>
                <Ionicons name="speedometer" size={12} color={c.primary} />
                <Text style={styles.tagText}>{DIFFICULTY_LABELS[route.difficulty] ?? route.difficulty}</Text>
              </View>
              <View style={styles.tag}>
                <Ionicons name="earth" size={12} color={c.primary} />
                <Text style={styles.tagText}>{SURFACE_LABELS[route.surface_type] ?? route.surface_type}</Text>
              </View>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{formatDistance(route.distance, unitSystem)}</Text>
                <Text style={styles.statLabel}>{t('distance')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{Math.round(route.elevation_gain)}m</Text>
                <Text style={styles.statLabel}>{t('elevation')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {route.estimated_duration ? formatDuration(route.estimated_duration) : '--'}
                </Text>
                <Text style={styles.statLabel}>{t('duration')}</Text>
              </View>
            </View>

            {/* Description */}
            {route.description ? (
              <Text style={styles.description}>{route.description}</Text>
            ) : null}

            {/* Distance from user */}
            <Text style={styles.distanceHint}>
              {t('route_distance_from_you', { distance: (route.distance_meters / 1000).toFixed(1) })}
            </Text>
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.followButton}
              onPress={() => {
                onClose();
                onFollow(route);
              }}
            >
              <Ionicons name="navigate" size={18} color={c.primaryForeground} />
              <Text style={styles.followButtonText}>{t('route_follow')}</Text>
            </TouchableOpacity>

            {isOwner && onDelete && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => {
                  onClose();
                  onDelete(route);
                }}
              >
                <Ionicons name="trash" size={18} color={c.destructive} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: c.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
    paddingHorizontal: 20,
    paddingBottom: 34,
    borderBottomWidth: 0,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: c.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  header: {
    marginBottom: 12,
  },
  routeName: {
    ...typography.headline,
    fontSize: 24,
    color: c.foreground,
  },
  routeCity: {
    ...typography.body,
    fontSize: 14,
    color: c.mutedForeground,
    marginTop: 2,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.inputBackground,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  tagText: {
    ...typography.body,
    fontSize: 12,
    color: c.foreground,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    backgroundColor: c.inputBackground,
    borderRadius: 12,
    padding: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    ...typography.statNumber,
    fontSize: 18,
    color: c.foreground,
  },
  statLabel: {
    ...typography.mono,
    fontSize: 10,
    color: c.mutedForeground,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  description: {
    ...typography.body,
    fontSize: 14,
    color: c.mutedForeground,
    lineHeight: 20,
    marginBottom: 12,
  },
  distanceHint: {
    ...typography.body,
    fontSize: 12,
    color: c.mutedForeground,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  followButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: c.primary,
    borderRadius: 16,
    padding: 14,
  },
  followButtonText: {
    ...typography.bodyBold,
    fontSize: 16,
    color: c.primaryForeground,
  },
  deleteButton: {
    backgroundColor: withAlpha(c.destructive, 0.15),
    borderRadius: 16,
    padding: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
