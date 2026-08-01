import { View, Text } from 'react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useActivityStore } from '../../store/activityStore';
import { styles } from './recordStyles';

export function CountdownView() {
  const { t } = useTranslation();
  const countdown = useActivityStore((s) => s.countdown);
  const tickCountdown = useActivityStore((s) => s.tickCountdown);

  useEffect(() => {
    const interval = setInterval(() => {
      tickCountdown();
    }, 1000);
    return () => clearInterval(interval);
  }, [tickCountdown]);

  return (
    <View style={[styles.container, styles.countdownContainer]}>
      <Text style={styles.countdownNumber}>{countdown}</Text>
      <Text style={styles.countdownLabel}>{t('activity_countdown')}</Text>
      {/* Dot indicators: filled dots = elapsed seconds (3 - countdown) */}
      <View style={styles.countdownDots}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[
              styles.countdownDot,
              i < 3 - countdown && styles.countdownDotFilled,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

