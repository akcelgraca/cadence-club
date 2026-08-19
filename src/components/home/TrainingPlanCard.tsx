import { useState, useMemo } from 'react';
import { useColors } from '../../hooks/useColors';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { TrainingPlanDay } from '../../lib/types';
import { typography, type Colors } from '../../lib/theme';
import { formatDuration } from '../../utils/dateHelpers';
import { getActivityByKey } from '../../lib/constants';
import { ActivityIcon } from '../common/ActivityIcon';
import i18n from '../../lib/i18n';

const DAY_LABELS = [
  i18n.t('training_day_mon'),
  i18n.t('training_day_tue'),
  i18n.t('training_day_wed'),
  i18n.t('training_day_thu'),
  i18n.t('training_day_fri'),
  i18n.t('training_day_sat'),
  i18n.t('training_day_sun'),
];

const FULL_DAY_NAMES = [
  i18n.t('training_day_full_mon'),
  i18n.t('training_day_full_tue'),
  i18n.t('training_day_full_wed'),
  i18n.t('training_day_full_thu'),
  i18n.t('training_day_full_fri'),
  i18n.t('training_day_full_sat'),
  i18n.t('training_day_full_sun'),
];

const REST_CONFIG = { icon: 'bed' as const, labelKey: 'training_rest_day' as const };

interface TrainingPlanCardProps {
  plan: TrainingPlanDay[];
  isLoading: boolean;
}

export function TrainingPlanCard({ plan, isLoading }: TrainingPlanCardProps) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
  const [selectedDay, setSelectedDay] = useState<TrainingPlanDay | null>(null);

  if (isLoading) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('training_plan_title')}</Text>
        </View>
        <ActivityIndicator size="small" color={c.primary} style={{ marginTop: 12 }} />
      </View>
    );
  }

  // Fill in missing days for the week
  const fullWeek: (TrainingPlanDay | null)[] = Array.from({ length: 7 }, (_, i) => {
    return plan.find((d) => d.day_of_week === i) ?? null;
  });

  const completedCount = plan.filter((d) => d.is_completed).length;
  const hasPlan = plan.length > 0;

  const selectedActivity = selectedDay && selectedDay.activity_type !== 'rest'
    ? getActivityByKey(selectedDay.activity_type)
    : null;

  return (
    <>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('training_plan_title')}</Text>
          <Text style={styles.count}>{hasPlan ? `${completedCount}/7` : '--'}</Text>
        </View>
        <View style={styles.pillsRow}>
          {fullWeek.map((item, i) => {
            if (!item) {
              // No plan for this day
              return (
                <View key={i} style={[styles.pill, styles.pillPending]}>
                  <Text style={[styles.pillDay, styles.pillDayMuted]}>{DAY_LABELS[i]}</Text>
                  <View style={styles.emptyDot} />
                </View>
              );
            }

            const isRest = item.activity_type === 'rest';
            const isToday = item.today;

            return (
              <TouchableOpacity
                key={i}
                style={[
                  styles.pill,
                  isToday ? styles.pillToday
                    : item.is_completed ? styles.pillDone
                    : isRest ? styles.pillRest
                    : styles.pillPending,
                ]}
                onPress={() => setSelectedDay(item)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.pillDay,
                    isToday ? styles.pillDayToday : styles.pillDayMuted,
                  ]}
                >
                  {DAY_LABELS[i]}
                </Text>
                {item.is_completed ? (
                  <Ionicons name="checkmark" size={11} color={c.primary} />
                ) : isToday ? (
                  <View style={styles.pulse} />
                ) : isRest ? (
                  <View style={styles.restDot} />
                ) : (
                  <View style={styles.emptyDot} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <Modal
        visible={!!selectedDay}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedDay(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedDay(null)}
        >
          <View style={styles.modalContent}>
            {/* Day name header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalDayName}>
                {selectedDay ? FULL_DAY_NAMES[selectedDay.day_of_week] : ''}
              </Text>
              {selectedDay?.today && (
                <View style={styles.todayBadge}>
                  <Text style={styles.todayBadgeText}>{t('training_today')}</Text>
                </View>
              )}
            </View>

            {/* Activity type */}
            {selectedDay?.activity_type === 'rest' ? (
              <View style={styles.activityRow}>
                <Ionicons name={REST_CONFIG.icon} size={28} color={c.primary} />
                <Text style={styles.activityLabel}>{t(REST_CONFIG.labelKey)}</Text>
              </View>
            ) : selectedActivity ? (
              <View style={styles.activityRow}>
                <ActivityIcon activityKey={selectedActivity.key} size={28} tintColor={c.primary} />
                <Text style={styles.activityLabel}>{t(selectedActivity.i18n_key as any)}</Text>
              </View>
            ) : null}

            {/* Plan label */}
            {selectedDay?.label && selectedDay.activity_type !== 'rest' && (
              <Text style={styles.planLabel}>{t(selectedDay.label as any)}</Text>
            )}

            {/* Metrics grid */}
            {selectedDay && selectedDay.activity_type !== 'rest' && (
              <View style={styles.metricsGrid}>
                {selectedDay.target_distance != null && (
                  <View style={styles.metricItem}>
                    <Ionicons name="flag" size={16} color={c.mutedForeground} />
                    <Text style={styles.metricValue}>{selectedDay.target_distance} km</Text>
                    <Text style={styles.metricLabel}>{t('distance')}</Text>
                  </View>
                )}
                {selectedDay.target_duration != null && (
                  <View style={styles.metricItem}>
                    <Ionicons name="time-outline" size={16} color={c.mutedForeground} />
                    <Text style={styles.metricValue}>{formatDuration(selectedDay.target_duration)}</Text>
                    <Text style={styles.metricLabel}>{t('duration')}</Text>
                  </View>
                )}
                {/* O realizado segue a métrica da meta: km para quem se desloca,
                    minutos para treinos parados */}
                {selectedDay.is_completed && (
                  <View style={styles.metricItem}>
                    <Ionicons name="checkmark-circle" size={16} color={c.success} />
                    <Text style={[styles.metricValue, styles.metricDone]}>
                      {selectedDay.target_distance != null
                        ? `${((selectedDay.actual_distance ?? 0) / 1000).toFixed(2)} km`
                        : formatDuration(selectedDay.actual_duration ?? 0)}
                    </Text>
                    <Text style={styles.metricLabel}>{t('training_actual')}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Rest day message */}
            {selectedDay?.activity_type === 'rest' && (
              <Text style={styles.restMessage}>
                {t('training_rest_message')}
              </Text>
            )}

            {/* Completed badge */}
            {selectedDay?.is_completed && (
              <View style={styles.completedBadge}>
                <Ionicons name="checkmark-circle" size={18} color={c.success} />
                <Text style={styles.completedText}>{t('training_completed')}</Text>
              </View>
            )}

            {/* Close button */}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setSelectedDay(null)}
            >
              <Text style={styles.modalCloseText}>{t('training_close')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  card: {
    backgroundColor: c.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontFamily: 'BarlowCondensed_900Black',
    fontSize: 18,
    color: c.foreground,
    textTransform: 'uppercase',
  },
  count: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 12,
    color: c.mutedForeground,
  },
  pillsRow: { flexDirection: 'row', gap: 6 },
  pill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  pillToday: {
    borderColor: c.primary,
    backgroundColor: c.primary + '1a',
  },
  pillDone: {
    borderColor: c.border,
    backgroundColor: c.card,
  },
  pillPending: {
    borderColor: c.border,
  },
  pillRest: {
    borderColor: c.border,
    opacity: 0.5,
  },
  pillDay: {
    fontFamily: 'BarlowCondensed_900Black',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  pillDayToday: { color: c.primary },
  pillDayMuted: { color: c.mutedForeground },
  pulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: c.primary,
  },
  emptyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: c.border,
  },
  restDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.mutedForeground,
    opacity: 0.4,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: c.overlayDark,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalContent: {
    backgroundColor: c.card,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  modalDayName: {
    fontFamily: 'BarlowCondensed_900Black',
    fontSize: 24,
    color: c.primary,
    textTransform: 'uppercase',
  },
  todayBadge: {
    backgroundColor: c.primary + '1a',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  todayBadgeText: {
    fontFamily: 'BarlowCondensed_900Black',
    fontSize: 12,
    color: c.primary,
    textTransform: 'uppercase',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  activityLabel: {
    ...typography.bodyBold,
    fontSize: 16,
    color: c.foreground,
  },
  planLabel: {
    ...typography.body,
    fontSize: 14,
    color: c.mutedForeground,
    marginBottom: 20,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    marginBottom: 20,
  },
  metricItem: {
    alignItems: 'center',
    backgroundColor: c.background,
    borderRadius: 12,
    padding: 12,
    minWidth: 80,
  },
  metricValue: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 16,
    color: c.foreground,
    marginTop: 4,
  },
  metricDone: {
    color: c.success,
  },
  metricLabel: {
    fontFamily: 'BarlowCondensed_900Black',
    fontSize: 10,
    color: c.mutedForeground,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  restMessage: {
    ...typography.body,
    fontSize: 14,
    color: c.mutedForeground,
    textAlign: 'center',
    marginBottom: 20,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  completedText: {
    fontFamily: 'BarlowCondensed_900Black',
    fontSize: 14,
    color: c.success,
    textTransform: 'uppercase',
  },
  modalCloseButton: {
    backgroundColor: c.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginTop: 4,
  },
  modalCloseText: {
    ...typography.bodyBold,
    color: c.primaryForeground,
  },
});
