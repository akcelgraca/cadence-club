import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../lib/theme';
import { useAuthStore } from '../../store/authStore';
import { useWeeklySummary } from '../../hooks/useProfileStats';

function formatMinutes(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.round((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}`;
  return `${mins}`;
}

export function StatsRow() {
  const profile = useAuthStore((s) => s.profile);
  const { data: weekly } = useWeeklySummary(profile?.id);

  // Calories estimate: MET for running ~10 × weight_kg × hours
  const weight = profile?.weight_kg ?? 70;
  const weeklyHours = (weekly?.total_duration ?? 0) / 3600;
  const estCalories = Math.round(weight * weeklyHours * 7); // 7 MET average for mixed running/walking

  const stats = [
    {
      icon: 'flame-outline' as const,
      label: 'Calorias',
      value: estCalories > 0 ? estCalories.toLocaleString() : '--',
      unit: 'kcal',
    },
    {
      icon: 'time-outline' as const,
      label: 'Tempo',
      value: weekly?.total_duration ? formatMinutes(weekly.total_duration) : '--',
      unit: 'min',
    },
    {
      icon: 'flash-outline' as const,
      label: 'Ritmo avg',
      value: weekly?.total_distance && weekly.total_duration
        ? `${Math.round(weekly.total_duration / (weekly.total_distance / 1000) / 60)}:${String(Math.round((weekly.total_duration / (weekly.total_distance / 1000)) % 60)).padStart(2, '0')}`
        : '--',
      unit: '/km',
    },
  ];

  return (
    <View style={styles.row}>
      {stats.map((item) => (
        <View key={item.label} style={styles.card}>
          <Ionicons name={item.icon} size={16} color={colors.primary} />
          <Text style={styles.value}>{item.value}</Text>
          <Text style={styles.unit}>{item.unit}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 12,
    gap: 4,
  },
  value: {
    fontFamily: 'BarlowCondensed_900Black',
    fontSize: 18,
    color: colors.foreground,
    lineHeight: 20,
  },
  unit: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 10,
    color: colors.mutedForeground,
  },
});
