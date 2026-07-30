import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatDuration } from '../../utils/dateHelpers';
import { formatDistance } from '../../utils/formatDistance';
import { formatPace } from '../../utils/formatPace';
import { useSettingsStore } from '../../store/settingsStore';
import { colors, typography } from '../../lib/theme';

interface LiveTrackerProps {
  elapsedTime: number;
  distance: number;
  currentPace: number | null;
  gpsSignal: 'none' | 'weak' | 'good';
}

export function LiveTracker({ elapsedTime, distance, currentPace, gpsSignal }: LiveTrackerProps) {
  const { t } = useTranslation();
  const unitSystem = useSettingsStore((s) => s.settings.unitSystem);

  return (
    <View style={styles.container}>
      <View style={styles.gpsRow}>
        <View style={[
          styles.gpsDot,
          gpsSignal === 'good' ? styles.gpsGood :
          gpsSignal === 'weak' ? styles.gpsWeak :
          styles.gpsNone
        ]} />
        <Text style={styles.gpsText}>
          {gpsSignal === 'good' ? t('activity_gps_ok') : gpsSignal === 'weak' ? t('activity_gps_weak') : t('activity_no_gps')}
        </Text>
      </View>

      <Text style={styles.time}>{formatDuration(elapsedTime)}</Text>
      <Text style={styles.distance}>{formatDistance(distance, unitSystem)}</Text>
      <Text style={styles.pace}>{formatPace(currentPace, unitSystem)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  gpsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  gpsDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  gpsGood: { backgroundColor: colors.gpsGood },
  gpsWeak: { backgroundColor: colors.gpsWeak },
  gpsNone: { backgroundColor: colors.destructive },
  gpsText: { ...typography.mono, color: colors.foreground, fontSize: 12 },
  time: { ...typography.statNumber, fontSize: 56, color: colors.foreground, fontVariant: ['tabular-nums'] },
  distance: { ...typography.statNumber, fontSize: 28, color: colors.foreground, marginTop: 4 },
  pace: { ...typography.mono, fontSize: 20, color: colors.mutedForeground, marginTop: 8 },
});
