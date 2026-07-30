import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatDistance } from '../../utils/formatDistance';
import { formatDuration, formatRelativeTime } from '../../utils/dateHelpers';
import { useSettingsStore } from '../../store/settingsStore';
import { ActivityMap } from '../activity/ActivityMap';
import type { Activity } from '../../lib/types';
import { ACTIVITY_TYPES } from '../../lib/constants';
import { colors, typography } from '../../lib/theme';

interface RoutesSectionProps {
  activities: Activity[] | undefined;
  isLoading: boolean;
}

export function RoutesSection({ activities, isLoading }: RoutesSectionProps) {
  const unitSystem = useSettingsStore((s) => s.settings.unitSystem);
  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Rotas</Text>
        <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 16 }} />
      </View>
    );
  }

  const routesWithMap = activities?.filter((a) => a.route_summary && a.route_summary.length > 0) ?? [];

  if (routesWithMap.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Rotas</Text>
        <Text style={styles.emptyText}>Ainda sem rotas registadas.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rotas</Text>
      {routesWithMap.map((activity) => (
        <TouchableOpacity
          key={activity.id}
          style={styles.routeCard}
          onPress={() => router.push(`/activity/${activity.id}`)}
        >
          <View style={styles.mapPreview}>
            <ActivityMap
              points={activity.route_summary!.map((p) => ({ lat: p[0], lng: p[1] }))}
              height={80}
            />
          </View>
          <View style={styles.routeInfo}>
            <View style={styles.routeTypeRow}>
              <Ionicons name={(ACTIVITY_TYPES.find(t => t.key === activity.type)?.icon ?? 'footsteps') as any} size={14} color={colors.foreground} />
              <Text style={styles.routeType}>
                {activity.type === 'run' ? 'Corrida' :
                 activity.type === 'cycle' ? 'Ciclismo' : 'Caminhada'}
              </Text>
            </View>
            <Text style={styles.routeStats}>
              {formatDistance(activity.distance, unitSystem)} · {formatDuration(activity.duration)}
            </Text>
            <Text style={styles.routeDate}>{formatRelativeTime(activity.created_at)}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
  },
  title: { ...typography.headline, fontSize: 18, marginBottom: 12, color: colors.foreground },
  emptyText: { ...typography.body, fontSize: 14, color: colors.mutedForeground, textAlign: 'center', paddingVertical: 16 },
  routeCard: {
    flexDirection: 'row',
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  mapPreview: {
    width: 80,
    height: 80,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 12,
  },
  routeInfo: { flex: 1, justifyContent: 'center' },
  routeType: { ...typography.bodyBold, fontSize: 15, color: colors.foreground },
  routeTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  routeStats: { ...typography.body, fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
  routeDate: { ...typography.body, fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
});
