import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatDistance } from '../../utils/formatDistance';
import { useSettingsStore } from '../../store/settingsStore';
import { useTranslation } from 'react-i18next';
import type { TrainingPlanDay } from '../../lib/types';
import { colors, typography } from '../../lib/theme';

interface TodayGoalCardProps {
  todayPlan: TrainingPlanDay | null;
  isLoading: boolean;
}

export function TodayGoalCard({ todayPlan, isLoading }: TodayGoalCardProps) {
  const { t } = useTranslation();
  const unitSystem = useSettingsStore((s) => s.settings.unitSystem);
  if (isLoading) {
    return (
      <View style={styles.card}>
        <Text style={styles.label}>{t('today_goal')}</Text>
        <ActivityIndicator size="small" color={colors.primaryForeground} style={{ marginTop: 12 }} />
      </View>
    );
  }

  if (!todayPlan || todayPlan.activity_type === 'rest') {
    return (
      <View style={styles.card}>
        <Text style={styles.label}>{t('today_goal')}</Text>
        <View style={styles.goalRow}>
          <Text style={styles.number}>--</Text>
          <Text style={styles.unit}>
            {todayPlan?.activity_type === 'rest' ? t('training_rest_day') : t('today_no_goal')}
          </Text>
        </View>
        <View style={styles.actionRow}>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => router.push('/record')}
          >
            <Ionicons name="play" size={14} color={colors.primaryForeground} />
            <Text style={styles.startText}>
              {todayPlan?.activity_type === 'rest' ? t('today_train_anyway') : t('activity_start')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const targetKm = todayPlan.target_distance ?? 0;
  const actualKm = (todayPlan.actual_distance ?? 0) / 1000;
  const progress = targetKm > 0 ? Math.min(actualKm / targetKm, 1) : 0;
  const progressPct = Math.round(progress * 100);

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{t('today_goal')}</Text>
      <View style={styles.goalRow}>
        <Text style={styles.number}>{targetKm}</Text>
        <Text style={styles.unit}>km {todayPlan.label.toLowerCase()}</Text>
      </View>
      <View style={styles.progressRow}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {actualKm.toFixed(1).replace('.', ',')} / {targetKm} {t('km_completed')}
        </Text>
      </View>
      <View style={styles.actionRow}>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={styles.startButton}
          onPress={() => router.push('/record')}
        >
          <Ionicons name="play" size={14} color={colors.primaryForeground} />
          <Text style={styles.startText}>{t('activity_start')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    overflow: 'hidden',
  },
  label: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 12,
    color: colors.primaryForeground,
    opacity: 0.7,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  goalRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 12 },
  number: {
    fontFamily: 'BarlowCondensed_900Black',
    fontSize: 48,
    color: colors.primaryForeground,
    lineHeight: 48,
  },
  unit: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 20,
    color: colors.primaryForeground,
    opacity: 0.8,
    marginBottom: 4,
  },
  progressRow: { marginBottom: 12 },
  progressBar: {
    height: 4,
    backgroundColor: colors.overlayDark,
    borderRadius: 2,
    marginBottom: 4,
  },
  progressFill: {
    height: 4,
    backgroundColor: colors.primaryForeground,
    borderRadius: 2,
  },
  progressText: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 12,
    color: colors.primaryForeground,
    opacity: 0.6,
  },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    borderWidth: 1.5,
    borderColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  startText: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 14,
    color: colors.primaryForeground,
    textTransform: 'uppercase',
  },
});
