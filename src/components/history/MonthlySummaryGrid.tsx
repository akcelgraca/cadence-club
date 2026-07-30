import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, typography } from '../../lib/theme';
import { formatDistance } from '../../utils/formatDistance';
import { formatDuration } from '../../utils/dateHelpers';
import { calculateMonthlyCalories } from '../../utils/calculateCalories';
import type { MonthlyStat } from '../../lib/types';
import type { UnitSystem } from '../../lib/types';
import type { Activity } from '../../lib/types';

interface Props {
  monthlyStats: MonthlyStat[] | undefined;
  unitSystem: UnitSystem;
  isLoading?: boolean;
  activities?: Activity[];
  weightKg?: number | null;
}

export function MonthlySummaryGrid({ monthlyStats, unitSystem, isLoading, activities, weightKg }: Props) {
  const { t } = useTranslation();

  // Compute totals from the current month's data
  const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const thisMonth = (monthlyStats ?? []).find((m) => m.month_year === currentMonth);

  // Calculate monthly calories from activities
  const monthlyCalories = calculateMonthlyCalories(activities ?? [], weightKg, currentMonth);
  const caloriesValue = monthlyCalories > 0
    ? `${Math.round(monthlyCalories).toLocaleString()} kcal`
    : '--';

  const items = [
    {
      icon: 'trending-up-outline' as const,
      label: t('monthly_total'),
      value: thisMonth
        ? formatDistance(thisMonth.total_distance, unitSystem)
        : '--',
    },
    {
      icon: 'trophy-outline' as const,
      label: t('profile_activities'),
      value: thisMonth ? String(thisMonth.activity_count) : '--',
    },
    {
      icon: 'flame-outline' as const,
      label: t('monthly_calories'),
      value: caloriesValue,
    },
    {
      icon: 'time-outline' as const,
      label: t('monthly_time'),
      value: thisMonth
        ? formatDuration(thisMonth.total_duration)
        : '--',
    },
  ];

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <View key={item.label} style={styles.card}>
          <Ionicons name={item.icon} size={16} color={colors.primary} />
          <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
            {item.value}
          </Text>
          <Text style={styles.label}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  card: {
    width: '47%',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
  value: {
    fontFamily: 'BarlowCondensed_900Black',
    fontSize: 20,
    color: colors.foreground,
    lineHeight: 22,
  },
  label: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 12,
    color: colors.mutedForeground,
  },
});
