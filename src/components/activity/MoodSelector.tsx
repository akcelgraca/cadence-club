import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useColors } from '../../hooks/useColors';
import { typography, type Colors } from '../../lib/theme';
import { useTranslation } from 'react-i18next';

const MOOD_IMAGES = [
  { value: 1, image: require('../../../assets/images/moods/mood_1.png'), i18n_key: 'activity_mood_1' },
  { value: 2, image: require('../../../assets/images/moods/mood_2.png'), i18n_key: 'activity_mood_2' },
  { value: 3, image: require('../../../assets/images/moods/mood_3.png'), i18n_key: 'activity_mood_3' },
  { value: 4, image: require('../../../assets/images/moods/mood_4.png'), i18n_key: 'activity_mood_4' },
  { value: 5, image: require('../../../assets/images/moods/mood_5.png'), i18n_key: 'activity_mood_5' },
];

interface MoodSelectorProps {
  selected: number | null;
  onSelect: (mood: number) => void;
}

export function MoodSelector({ selected, onSelect }: MoodSelectorProps) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('activity_how_was_it')}</Text>
      <View style={styles.row}>
        {MOOD_IMAGES.map((m) => (
          <TouchableOpacity
            key={m.value}
            style={[styles.button, selected === m.value && styles.buttonSelected]}
            onPress={() => onSelect(m.value)}
          >
            <Image source={m.image} style={styles.moodImage} />
            <Text style={styles.label}>{t(m.i18n_key as any)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { alignItems: 'center' },
  title: { ...typography.bodyMedium, fontSize: 16, marginBottom: 12, color: c.foreground },
  row: { flexDirection: 'row', gap: 8 },
  button: {
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: c.card,
  },
  buttonSelected: { backgroundColor: c.primary, borderColor: c.primary },
  moodImage: { width: 44, height: 44, borderRadius: 22, marginBottom: 4 },
  label: { ...typography.body, fontSize: 10, color: c.mutedForeground },
});
