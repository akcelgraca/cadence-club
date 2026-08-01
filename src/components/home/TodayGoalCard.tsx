import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { TrainingPlanDay } from '../../lib/types';
import { colors } from '../../lib/theme';

/**
 * O herói do ecrã Hoje: responde a "o que faço hoje?" numa só olhada e
 * arranca o registo. Verde da marca — a única superfície saturada do ecrã.
 */

interface TodayGoalCardProps {
  todayPlan: TrainingPlanDay | null;
  isLoading: boolean;
}

function StartButton({ label }: { label: string }) {
  return (
    <TouchableOpacity
      style={styles.startButton}
      onPress={() => router.push('/record')}
      activeOpacity={0.85}
    >
      <Ionicons name="play" size={13} color={colors.primary} />
      <Text style={styles.startText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function TodayGoalCard({ todayPlan, isLoading }: TodayGoalCardProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <View style={[styles.card, styles.cardLoading]}>
        <Text style={styles.label}>{t('today_goal')}</Text>
        <ActivityIndicator size="small" color={colors.primaryForeground} style={{ marginTop: 12 }} />
      </View>
    );
  }

  const isRest = todayPlan?.activity_type === 'rest';

  // Dia de descanso ou sem plano: nada de "--" — o cartão continua a ser um convite
  if (!todayPlan || isRest) {
    return (
      <View style={styles.card}>
        <Text style={styles.label}>{isRest ? t('training_rest_day') : t('today_goal')}</Text>
        <Text style={styles.restTitle}>
          {isRest ? 'Descanso' : 'Sem treino planeado'}
        </Text>
        <Text style={styles.restSub}>
          {isRest
            ? 'Recuperar também é treinar. Se te apetecer mexer, força.'
            : 'Não tens nada marcado para hoje — sai à rua na mesma.'}
        </Text>
        <View style={styles.actionRow}>
          <StartButton label={isRest ? t('today_train_anyway') : t('activity_start')} />
        </View>
      </View>
    );
  }

  // A meta segue a métrica que faz sentido para a modalidade: quem corre
  // conta quilómetros, quem faz ioga ou musculação conta minutos.
  const targetKm = todayPlan.target_distance ?? 0;
  const targetMinutes = Math.round((todayPlan.target_duration ?? 0) / 60);
  const usesDistance = targetKm > 0;

  // Sessão sem meta medível (nem distância nem tempo): mostra só a modalidade
  if (!usesDistance && targetMinutes === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.label}>{t('today_goal')}</Text>
        <Text style={styles.restTitle}>{todayPlan.label}</Text>
        <Text style={styles.restSub}>Sem meta definida — faz o que o corpo pedir.</Text>
        <View style={styles.actionRow}>
          <StartButton label={t('activity_start')} />
        </View>
      </View>
    );
  }

  const goalValue = usesDistance ? targetKm : targetMinutes;
  const goalUnit = usesDistance ? 'km' : 'min';

  const actualKm = (todayPlan.actual_distance ?? 0) / 1000;
  const actualMinutes = (todayPlan.actual_duration ?? 0) / 60;
  const actualValue = usesDistance ? actualKm : actualMinutes;

  const progress = goalValue > 0 ? Math.min(actualValue / goalValue, 1) : 0;
  const progressPct = Math.round(progress * 100);
  const isDone = progress >= 1;

  const progressLabel = usesDistance
    ? `${actualKm.toFixed(1).replace('.', ',')} / ${targetKm} ${t('km_completed')}`
    : `${Math.round(actualMinutes)} / ${targetMinutes} min feitos`;

  return (
    <View style={styles.card}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{t('today_goal')}</Text>
        {isDone && (
          <View style={styles.donePill}>
            <Ionicons name="checkmark" size={11} color={colors.primary} />
            <Text style={styles.doneText}>Cumprido</Text>
          </View>
        )}
      </View>

      <View style={styles.goalRow}>
        <Text style={styles.number}>{goalValue}</Text>
        <Text style={styles.unit}>{goalUnit} · {todayPlan.label.toLowerCase()}</Text>
      </View>

      <View style={styles.progressRow}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>
        <Text style={styles.progressText}>{progressLabel}</Text>
      </View>

      <View style={styles.actionRow}>
        <StartButton label={isDone ? 'Treinar mais' : t('activity_start')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardLoading: { minHeight: 120 },

  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 12,
    color: colors.primaryForeground,
    opacity: 0.75,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  donePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primaryForeground,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  doneText: {
    fontFamily: 'Barlow_600SemiBold',
    fontSize: 10,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  goalRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 6, marginBottom: 14 },
  number: {
    fontFamily: 'BarlowCondensed_900Black',
    fontSize: 60,
    lineHeight: 58,
    letterSpacing: -1,
    color: colors.primaryForeground,
  },
  unit: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 19,
    color: colors.primaryForeground,
    opacity: 0.85,
    marginBottom: 6,
    flexShrink: 1,
  },

  // Estado de descanso / sem plano
  restTitle: {
    fontFamily: 'BarlowCondensed_900Black',
    fontSize: 38,
    lineHeight: 40,
    color: colors.primaryForeground,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  restSub: {
    fontFamily: 'Barlow_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: colors.primaryForeground,
    opacity: 0.85,
    marginTop: 4,
    marginBottom: 4,
  },

  progressRow: { marginBottom: 14 },
  progressBar: {
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderRadius: 3,
    marginBottom: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: 5,
    backgroundColor: colors.primaryForeground,
    borderRadius: 3,
  },
  progressText: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 12,
    color: colors.primaryForeground,
    opacity: 0.8,
  },

  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryForeground,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
  },
  startText: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 14,
    letterSpacing: 0.5,
    color: colors.primary,
    textTransform: 'uppercase',
  },
});
