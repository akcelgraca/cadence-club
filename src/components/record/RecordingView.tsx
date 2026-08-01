import { View, Text, TouchableOpacity } from 'react-native';
import { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useActivityStore } from '../../store/activityStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuth } from '../../hooks/useAuth';
import { formatDuration } from '../../utils/dateHelpers';
import { formatDistance } from '../../utils/formatDistance';
import { formatPace, formatSpeed, formatElevation } from '../../utils/formatPace';
import { calculateActivityCalories } from '../../utils/calculateCalories';
import { colors } from '../../lib/theme';
import { styles } from './recordStyles';

export function RecordingView({ startTracking }: { startTracking: () => Promise<void> }) {
  const { t } = useTranslation();
  const pause = useActivityStore((s) => s.pause);
  const elapsedTime = useActivityStore((s) => s.elapsedTime);
  const distance = useActivityStore((s) => s.distance);
  const currentPace = useActivityStore((s) => s.currentPace);
  const avgPace = useActivityStore((s) => s.avgPace);
  const elevationGain = useActivityStore((s) => s.elevationGain);
  const gpsSignal = useActivityStore((s) => s.gpsSignal);
  const type = useActivityStore((s) => s.type);
  const unitSystem = useSettingsStore((s) => s.settings.unitSystem);
  const { profile } = useAuth();

  // Calorias estimadas em tempo real (MET × peso × tempo)
  const liveCalories = Math.round(
    calculateActivityCalories(
      { type: type!, duration: elapsedTime, distance, avg_pace: avgPace } as any,
      profile?.weight_kg ?? 70,
    ),
  );

  // Start GPS tracking on mount
  useEffect(() => {
    startTracking();
  }, [startTracking]);

  // Keep elapsed time display updating every second (GPS callback only fires on new positions)
  useEffect(() => {
    const interval = setInterval(() => {
      const store = useActivityStore.getState();
      const startTime = store.startTime;
      if (startTime) {
        const elapsed = (Date.now() - new Date(startTime).getTime() - store.totalPausedDuration) / 1000;
        useActivityStore.setState({ elapsedTime: elapsed });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={[styles.container, styles.recordingContainer]}>
      {/* GPS status indicator */}
      <View style={styles.gpsRow}>
        <View style={[
          styles.gpsDot,
          gpsSignal === 'good' ? styles.gpsGood :
          gpsSignal === 'weak' ? styles.gpsWeak :
          styles.gpsNone
        ]} />
        <Text style={styles.gpsText}>
          {gpsSignal === 'good' ? t('activity_gps_ok') :
           gpsSignal === 'weak' ? t('activity_gps_weak_short') :
           t('activity_gps_none')}
        </Text>
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

      {/* Pausa — alvo grande, é o botão que se procura a correr */}
      <TouchableOpacity style={styles.pauseButton} onPress={pause} activeOpacity={0.7}>
        <Ionicons name="pause" size={22} color={colors.foreground} />
        <Text style={styles.pauseButtonText}>{t('activity_pause_button')}</Text>
      </TouchableOpacity>
    </View>
  );
}

