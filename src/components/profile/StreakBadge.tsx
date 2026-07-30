import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, typography, withAlpha } from '../../lib/theme';

interface StreakBadgeProps {
  currentStreak: number;
  longestStreak: number;
  isActive?: boolean;
}

/** Render the 7 day-of-week dots. Filled up to `filled` days. */
function WeekDots({ filled }: { filled: number }) {
  return (
    <View style={styles.weekDots}>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <View
          key={i}
          style={[
            styles.weekDot,
            i < filled && styles.weekDotFilled,
          ]}
        />
      ))}
    </View>
  );
}

export function StreakBadge({ currentStreak, longestStreak, isActive }: StreakBadgeProps) {
  const { t } = useTranslation();

  // Show week dots for current streak (max 7 dots)
  const weekFilled = Math.min(currentStreak % 7 || 7, 7);

  return (
    <View style={styles.container}>
      {/* Top section: flame icon + current streak */}
      <View style={styles.topSection}>
        <View style={styles.flameContainer}>
          <Ionicons name="flame" size={32} color={colors.warning} />
        </View>
        <View style={styles.streakInfo}>
          <View style={styles.streakRow}>
            <Text style={styles.streakValue}>{currentStreak}</Text>
            <Text style={styles.streakUnit}> {t('streak_days')}</Text>
          </View>
          <Text style={styles.streakLabel}>{t('streak_current')}</Text>
        </View>
      </View>

      {/* Week dots visualization */}
      <WeekDots filled={weekFilled} />

      {/* Active indicator */}
      {isActive && (
        <View style={styles.activeRow}>
          <View style={styles.activeDot} />
          <Text style={styles.activeText}>{t('streak_active')}</Text>
        </View>
      )}

      {/* Divider */}
      <View style={styles.divider} />

      {/* Bottom: personal record */}
      <View style={styles.recordRow}>
        <Ionicons name="trophy-outline" size={14} color={colors.mutedForeground} />
        <Text style={styles.recordLabel}>{t('streak_longest')}</Text>
        <Text style={styles.recordValue}>{longestStreak} {t('streak_days')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    // Subtle inner glow
    shadowColor: colors.warning,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },

  // ---- Top section ----
  topSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  flameContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: withAlpha(colors.warning, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakInfo: {
    flex: 1,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  streakValue: {
    ...typography.statNumber,
    fontSize: 44,
    color: colors.warning,
    lineHeight: 48,
  },
  streakUnit: {
    ...typography.body,
    fontSize: 16,
    color: colors.mutedForeground,
  },
  streakLabel: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.foreground,
    marginTop: 2,
  },

  // ---- Week dots ----
  weekDots: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  weekDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: withAlpha(colors.foreground, 0.08),
  },
  weekDotFilled: {
    backgroundColor: colors.warning,
  },

  // ---- Active ----
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  activeText: {
    ...typography.mono,
    fontSize: 11,
    color: colors.success,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // ---- Divider ----
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 14,
  },

  // ---- Record row ----
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recordLabel: {
    ...typography.body,
    fontSize: 13,
    color: colors.mutedForeground,
    flex: 1,
  },
  recordValue: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.foreground,
  },
});
