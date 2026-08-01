import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useActivityStore } from '../../store/activityStore';
import { colors } from '../../lib/theme';
import { styles } from './recordStyles';

export function NonDistancePausedView() {
  const { t } = useTranslation();
  const resume = useActivityStore((s) => s.resume);
  const finish = useActivityStore((s) => s.finish);
  const reset = useActivityStore((s) => s.reset);
  const elapsedTime = useActivityStore((s) => s.elapsedTime);
  const [now, setNow] = useState(new Date());

  // Keep clock updated
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

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
    <View style={styles.nonDistanceContainer}>
      {/* Paused indicator — absolute top */}
      <View style={styles.pausedIndicatorTop}>
        <Ionicons name="pause-circle" size={18} color={colors.warning} />
        <Text style={styles.pausedTitle}>{t('activity_paused')}</Text>
      </View>

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

      {/* Action buttons — at the bottom */}
      <View style={styles.nonDistanceBottom}>
        <View style={styles.pausedButtons}>
          <TouchableOpacity style={styles.discardButton} onPress={handleDiscard} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={16} color={colors.destructive} />
            <Text style={styles.discardButtonText}>{t('activity_discard')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.resumeButton} onPress={resume} activeOpacity={0.7}>
            <Ionicons name="play" size={16} color={colors.gpsGood} />
            <Text style={styles.resumeButtonText}>{t('activity_resume')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.finishButton} onPress={finish} activeOpacity={0.85}>
            <Ionicons name="stop" size={16} color={colors.primaryForeground} />
            <Text style={styles.finishButtonText}>{t('activity_finish')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

