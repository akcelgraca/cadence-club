import { View, Text, TouchableOpacity } from 'react-native';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useActivityStore } from '../../store/activityStore';
import { colors } from '../../lib/theme';
import { styles } from './recordStyles';

export function NonDistanceRecordingView() {
  const { t } = useTranslation();
  const pause = useActivityStore((s) => s.pause);
  const elapsedTime = useActivityStore((s) => s.elapsedTime);
  const [now, setNow] = useState(new Date());

  // Keep clock and elapsed time updated
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
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
    <View style={styles.nonDistanceContainer}>
      {/* Clock + label — absolutely centered */}
      <View style={styles.nonDistanceClockCenter}>
        <Text style={styles.nonDistanceClock}>
          {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        <Text style={styles.nonDistanceClockLabel}>{t('time_of_day')}</Text>
      </View>

      {/* Elapsed timer — absolutely positioned, never moves */}
      <Text style={styles.nonDistanceTimer}>
        {(() => {
          const totalSec = Math.floor(elapsedTime);
          const h = Math.floor(totalSec / 3600);
          const m = Math.floor((totalSec % 3600) / 60);
          const s = totalSec % 60;
          return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        })()}
      </Text>

      {/* Pause button — at the bottom */}
      <View style={styles.nonDistanceBottom}>
        <TouchableOpacity style={styles.pauseButton} onPress={pause} activeOpacity={0.7}>
          <Ionicons name="pause" size={18} color={colors.foreground} />
          <Text style={styles.pauseButtonText}>{t('activity_pause_button')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

