import { Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIcon } from '../common/ActivityIcon';
import { ACTIVITY_CATEGORIES } from '../../lib/constants';
import { colors, typography, withAlpha } from '../../lib/theme';
import type { ActivityCategory } from '../../lib/types';

export type CategoryFilter = ActivityCategory | 'all';

/** Ícone representativo de cada categoria, para o chip. */
const CATEGORY_SAMPLE: Record<string, string> = {
  foot: 'run', cycling: 'cycle', strength: 'weight_training',
  racquet: 'tennis', water: 'swimming', winter: 'snowboard',
  team: 'football', other: 'yoga',
};

interface FilterPillsProps {
  selected: CategoryFilter;
  onSelect: (filter: CategoryFilter) => void;
  /** Só aparecem categorias que o utilizador praticou — filtros vazios não servem. */
  availableCategories: Set<ActivityCategory>;
}

export function FilterPills({ selected, onSelect, availableCategories }: FilterPillsProps) {
  const { t } = useTranslation();

  // Com uma só modalidade não há nada para filtrar
  if (availableCategories.size < 2) return null;

  const options = ACTIVITY_CATEGORIES.filter((c) =>
    availableCategories.has(c.key as ActivityCategory),
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      <TouchableOpacity
        style={[styles.pill, selected === 'all' ? styles.pillActive : styles.pillInactive]}
        onPress={() => onSelect('all')}
      >
        <Ionicons
          name="apps"
          size={13}
          color={selected === 'all' ? colors.primaryForeground : colors.mutedForeground}
        />
        <Text style={[styles.pillText, selected === 'all' ? styles.pillTextActive : styles.pillTextInactive]}>
          {t('filter_all')}
        </Text>
      </TouchableOpacity>

      {options.map((cat) => {
        const isActive = selected === cat.key;
        const sample = CATEGORY_SAMPLE[cat.key];
        return (
          <TouchableOpacity
            key={cat.key}
            style={[styles.pill, isActive ? styles.pillActive : styles.pillInactive]}
            onPress={() => onSelect(cat.key as ActivityCategory)}
          >
            {sample && (
              <ActivityIcon
                activityKey={sample}
                size={13}
                tintColor={isActive ? colors.primaryForeground : colors.mutedForeground}
              />
            )}
            <Text style={[styles.pillText, isActive ? styles.pillTextActive : styles.pillTextInactive]}>
              {t(cat.i18n_key as any)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
  },
  pillActive: { backgroundColor: colors.primary },
  pillInactive: { backgroundColor: withAlpha(colors.foreground, 0.06) },
  pillText: { ...typography.bodyMedium, fontSize: 12 },
  pillTextActive: { color: colors.primaryForeground },
  pillTextInactive: { color: colors.mutedForeground },
});
