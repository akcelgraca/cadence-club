import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, typography, healthColors } from '../../lib/theme';

interface MetricItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
}

export function HealthMetrics() {
  const { t } = useTranslation();
  const metrics: MetricItem[] = [
    { icon: 'heart-outline', label: 'Freq. cardíaca em repouso', value: '52 bpm', color: healthColors.heart },
    { icon: 'fitness-outline', label: 'VO2 Max estimado', value: '56 ml/kg/min', color: healthColors.vo2max },
    { icon: 'flash-outline', label: 'Índice de forma', value: 'Alta', color: healthColors.shape },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>{t('health_section_title')}</Text>
      <View style={styles.list}>
        {metrics.map((item) => (
          <View key={item.label} style={styles.row}>
            <View style={styles.iconGroup}>
              <Ionicons name={item.icon} size={16} color={item.color} />
              <Text style={styles.label}>{item.label}</Text>
            </View>
            <Text style={[styles.value, { color: item.color }]}>{item.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: { ...typography.headline, fontSize: 18, marginBottom: 12, color: colors.foreground },
  list: { gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    padding: 12,
  },
  iconGroup: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: {
    fontFamily: 'Barlow_500Medium',
    fontSize: 14,
    color: colors.foreground,
  },
  value: {
    fontFamily: 'BarlowCondensed_900Black',
    fontSize: 14,
  },
});
