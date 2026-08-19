import { useMemo } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useColors } from '../../hooks/useColors';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useActivityStore } from '../../store/activityStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuth } from '../../hooks/useAuth';
import { formatDuration } from '../../utils/dateHelpers';
import { formatDistance } from '../../utils/formatDistance';
import { formatPace, formatSpeed, formatElevation } from '../../utils/formatPace';
import { calculateActivityCalories } from '../../utils/calculateCalories';
import { type Colors } from '../../lib/theme';
import { makeStyles } from './recordStyles';

export function PausedView() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
  const resume = useActivityStore((s) => s.resume);
  const finish = useActivityStore((s) => s.finish);
  const reset = useActivityStore((s) => s.reset);
  const elapsedTime = useActivityStore((s) => s.elapsedTime);
  const distance = useActivityStore((s) => s.distance);
  const currentPace = useActivityStore((s) => s.currentPace);
  const avgPace = useActivityStore((s) => s.avgPace);
  const elevationGain = useActivityStore((s) => s.elevationGain);
  const type = useActivityStore((s) => s.type);
  const unitSystem = useSettingsStore((s) => s.settings.unitSystem);
  const { profile } = useAuth();

  const liveCalories = Math.round(
    calculateActivityCalories(
      { type: type!, duration: elapsedTime, distance, avg_pace: avgPace } as any,
      profile?.weight_kg ?? 70,
    ),
  );

  const handleDiscard = () => {
    Alert.alert(
      t('activity_discard_confirm'),
      t('activity_discard_message'),
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('activity_discard'), style: 'destructive', onPress: reset },
      ]
    );
  };

  return (
    <View style={[styles.container, styles.pausedContainer]}>
      {/* Paused indicator */}
      <View style={styles.pausedIndicator}>
        <Ionicons name="pause-circle" size={18} color={c.warning} />
        <Text style={styles.pausedTitle}>{t('activity_paused')}</Text>
      </View>

      {/* Primary metric: elapsed time */}
      <View style={styles.metricTimeRow}>
        <Text style={styles.metricTime}>{formatDuration(elapsedTime)}</Text>
      </View>

      {/* Distância + ritmo médio */}
      <View style={styles.metricMainRow}>
        <View style={styles.metricMainItem}>
          <Text style={styles.metricMainValue}>
            {formatDistance(distance, unitSystem)}
          </Text>
          <Text style={styles.metricMainLabel}>{t('distance')}</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricMainItem}>
          <Text style={styles.metricMainValue}>
            {formatPace(avgPace, unitSystem)}
          </Text>
          <Text style={styles.metricMainLabel}>{t('activity_avg_pace_label')}</Text>
        </View>
      </View>

      {/* Métricas secundárias — sem repetir o que já está acima */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricGridItem}>
          <Text style={styles.metricGridValue}>{formatPace(currentPace, unitSystem)}</Text>
          <Text style={styles.metricGridLabel}>{t('activity_current_pace_label')}</Text>
        </View>
        <View style={styles.metricGridItem}>
          <Text style={styles.metricGridValue}>{formatSpeed(currentPace, unitSystem)}</Text>
          <Text style={styles.metricGridLabel}>{t('activity_speed')}</Text>
        </View>
        <View style={styles.metricGridItem}>
          <Text style={styles.metricGridValue}>{formatElevation(elevationGain, unitSystem)}</Text>
          <Text style={styles.metricGridLabel}>{t('activity_elevation')}</Text>
        </View>
        <View style={styles.metricGridItem}>
          <Text style={styles.metricGridValue}>{liveCalories}</Text>
          <Text style={styles.metricGridLabel}>{t('activity_calories')}</Text>
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.pausedButtons}>
        <TouchableOpacity style={styles.discardButton} onPress={handleDiscard} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={16} color={c.destructive} />
          <Text style={styles.discardButtonText}>{t('activity_discard')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.resumeButton} onPress={resume} activeOpacity={0.7}>
          <Ionicons name="play" size={16} color={c.gpsGood} />
          <Text style={styles.resumeButtonText}>{t('activity_resume')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.finishButton} onPress={finish} activeOpacity={0.85}>
          <Ionicons name="stop" size={16} color={c.primaryForeground} />
          <Text style={styles.finishButtonText}>{t('activity_finish')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

