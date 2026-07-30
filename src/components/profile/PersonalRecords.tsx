import { View, Text, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../store/settingsStore';
import { formatPace } from '../../utils/formatPace';
import { colors, typography } from '../../lib/theme';
import { getPersonalRecords } from '../../services/profileStats';

function formatRecordValue(record: { distance_category: string; best_duration: number; best_pace: number }, unitSystem: 'metric' | 'imperial'): string {
  if (record.distance_category === 'Meia') {
    // For half marathon, show total time
    const hours = Math.floor(record.best_duration / 3600);
    const mins = Math.floor((record.best_duration % 3600) / 60);
    const secs = Math.round(record.best_duration % 60);
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  // For shorter distances, show pace
  return formatPace(record.best_pace, unitSystem);
}

interface PersonalRecordsProps {
  userId?: string;
}

export function PersonalRecords({ userId }: PersonalRecordsProps) {
  const { t } = useTranslation();
  const unitSystem = useSettingsStore((s) => s.settings.unitSystem);
  const { data: records = [] } = useQuery({
    queryKey: ['personalRecords', userId],
    queryFn: () => getPersonalRecords(userId!),
    enabled: !!userId,
  });

  if (records.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>{t('personal_records_title')}</Text>
      <View style={styles.grid}>
        {records.map((record) => (
          <View key={record.distance_category} style={styles.card}>
            <Ionicons name="trophy-outline" size={18} color={colors.primary} />
            <View>
              <Text style={styles.recordLabel}>{record.distance_category}</Text>
              <Text style={styles.recordValue}>{formatRecordValue(record, unitSystem)}</Text>
            </View>
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '47%',
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recordLabel: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 12,
    color: colors.mutedForeground,
  },
  recordValue: {
    fontFamily: 'BarlowCondensed_900Black',
    fontSize: 20,
    color: colors.foreground,
    lineHeight: 22,
  },
});
