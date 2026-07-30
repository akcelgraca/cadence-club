import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { colors, typography } from '../../lib/theme';

const MOOD_IMAGES = [
  { value: 1, image: require('../../../assets/images/moods/mood_1.png'), label: 'Muito difícil' },
  { value: 2, image: require('../../../assets/images/moods/mood_2.png'), label: 'Difícil' },
  { value: 3, image: require('../../../assets/images/moods/mood_3.png'), label: 'Normal' },
  { value: 4, image: require('../../../assets/images/moods/mood_4.png'), label: 'Boa' },
  { value: 5, image: require('../../../assets/images/moods/mood_5.png'), label: 'Excelente' },
];

interface MoodSelectorProps {
  selected: number | null;
  onSelect: (mood: number) => void;
}

export function MoodSelector({ selected, onSelect }: MoodSelectorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Como te sentiste?</Text>
      <View style={styles.row}>
        {MOOD_IMAGES.map((m) => (
          <TouchableOpacity
            key={m.value}
            style={[styles.button, selected === m.value && styles.buttonSelected]}
            onPress={() => onSelect(m.value)}
          >
            <Image source={m.image} style={styles.moodImage} />
            <Text style={styles.label}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  title: { ...typography.bodyMedium, fontSize: 16, marginBottom: 12, color: colors.foreground },
  row: { flexDirection: 'row', gap: 8 },
  button: {
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.card,
  },
  buttonSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  moodImage: { width: 44, height: 44, borderRadius: 22, marginBottom: 4 },
  label: { ...typography.body, fontSize: 10, color: colors.mutedForeground },
});
