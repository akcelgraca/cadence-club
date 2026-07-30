import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, typography } from '../../lib/theme';

const filters = ['Todas', 'Leve', 'Intenso', 'Longo'] as const;
export type IntensityFilter = (typeof filters)[number];

interface FilterPillsProps {
  selected: IntensityFilter;
  onSelect: (filter: IntensityFilter) => void;
}

export function FilterPills({ selected, onSelect }: FilterPillsProps) {
  return (
    <View style={styles.row}>
      {filters.map((f) => (
        <TouchableOpacity
          key={f}
          style={[styles.pill, selected === f ? styles.pillActive : styles.pillInactive]}
          onPress={() => onSelect(f)}
        >
          <Text
            style={[
              styles.pillText,
              selected === f ? styles.pillTextActive : styles.pillTextInactive,
            ]}
          >
            {f}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 4,
    marginBottom: 16,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillInactive: {
    backgroundColor: colors.card,
    borderColor: colors.border,
  },
  pillText: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pillTextActive: { color: colors.primaryForeground },
  pillTextInactive: { color: colors.mutedForeground },
});
