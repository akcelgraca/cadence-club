import { useState, useMemo } from 'react';
import { useColors } from '../../hooks/useColors';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { typography, withAlpha, type Colors } from '../../lib/theme';
import { ACTIVITY_CATEGORIES } from '../../lib/constants';
import { ActivityIcon } from '../common/ActivityIcon';
import { getActivityImage } from '../../lib/activityImages';
import type { ActivityType, RouteDifficulty, SurfaceType, RouteFilters } from '../../lib/types';

interface FilterBarProps {
  filters: RouteFilters;
  onFiltersChange: (filters: RouteFilters) => void;
}

export function FilterBar({ filters, onFiltersChange }: FilterBarProps) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { top, bottom } = useSafeAreaInsets();
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  const activityOptions = useMemo(() => {
    const all: { key: ActivityType | undefined; label: string; icon: string }[] = [
      { key: undefined, label: t('route_all'), icon: 'apps' },
    ];
    for (const cat of ACTIVITY_CATEGORIES) {
      for (const act of cat.activities) {
        all.push({ key: act.key, label: t(act.i18n_key as any), icon: act.icon });
      }
    }
    return all;
  }, [t]);

  const difficultyOptions: { key: RouteDifficulty | undefined; label: string }[] = useMemo(() => [
    { key: undefined, label: t('route_all') },
    { key: 'easy', label: t('route_difficulty_easy') },
    { key: 'moderate', label: t('route_difficulty_moderate') },
    { key: 'hard', label: t('route_difficulty_hard') },
    { key: 'expert', label: t('route_difficulty_expert') },
  ], [t]);

  const surfaceOptions: { key: SurfaceType | undefined; label: string }[] = useMemo(() => [
    { key: undefined, label: t('route_all') },
    { key: 'road', label: t('route_surface_road') },
    { key: 'trail', label: t('route_surface_trail') },
    { key: 'mixed', label: t('route_surface_mixed') },
    { key: 'track', label: t('route_surface_track') },
  ], [t]);

  const activeCount = useMemo(() => {
    let count = 0;
    if (filters.activity_type) count++;
    if (filters.difficulty) count++;
    if (filters.surface_type) count++;
    return count;
  }, [filters]);

  const updateFilter = <K extends keyof RouteFilters>(key: K, value: RouteFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({});
    setVisible(false);
  };

  const selectedLabel = useMemo(() => {
    const parts: string[] = [];
    const act = activityOptions.find((o) => o.key === filters.activity_type);
    if (act?.key) parts.push(act.label);
    const diff = difficultyOptions.find((o) => o.key === filters.difficulty);
    if (diff?.key) parts.push(diff.label);
    const surf = surfaceOptions.find((o) => o.key === filters.surface_type);
    if (surf?.key) parts.push(surf.label);
    return parts.length > 0 ? parts.join(' · ') : t('routes_filters');
  }, [filters]);

  return (
    <>
      {/* Floating filter button */}
      <TouchableOpacity
        style={[styles.fab, { top: top + 8 }]}
        onPress={() => setVisible(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="options-outline" size={18} color={activeCount > 0 ? c.primary : c.foreground} />
        {activeCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{activeCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Filter modal */}
      <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <View />
        </Pressable>
        <View style={[styles.sheet, { paddingBottom: bottom + 16 }]}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{t('routes_filters')}</Text>
            <View style={styles.sheetHeaderActions}>
              {activeCount > 0 && (
                <TouchableOpacity onPress={clearFilters} style={styles.clearBtn}>
                  <Text style={styles.clearBtnText}>{t('routes_clear_filters')}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={c.foreground} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {/* Activity type */}
            <Text style={styles.sectionLabel}>{t('routes_activity')}</Text>
            <View style={styles.chipRow}>
              {activityOptions.map((opt) => {
                const isActive = filters.activity_type === opt.key;
                return (
                  <TouchableOpacity
                    key={`act-${opt.label}`}
                    style={[styles.chip, isActive && styles.chipActive]}
                    onPress={() => {
                      updateFilter('activity_type', opt.key);
                      setVisible(false);
                    }}
                  >
                    {opt.key && getActivityImage(opt.key, 'white')
                      ? <ActivityIcon activityKey={opt.key} size={14} tintColor={isActive ? c.primaryForeground : c.foreground} />
                      : <Ionicons name={opt.icon as any} size={14} color={isActive ? c.primaryForeground : c.foreground} />
                    }
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Difficulty */}
            <Text style={styles.sectionLabel}>{t('routes_difficulty')}</Text>
            <View style={styles.chipRow}>
              {difficultyOptions.map((opt) => {
                const isActive = filters.difficulty === opt.key;
                return (
                  <TouchableOpacity
                    key={`diff-${opt.label}`}
                    style={[styles.chip, isActive && styles.chipActive]}
                    onPress={() => {
                      updateFilter('difficulty', opt.key);
                      setVisible(false);
                    }}
                  >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Surface type */}
            <Text style={styles.sectionLabel}>{t('routes_surface')}</Text>
            <View style={styles.chipRow}>
              {surfaceOptions.map((opt) => {
                const isActive = filters.surface_type === opt.key;
                return (
                  <TouchableOpacity
                    key={`surf-${opt.label}`}
                    style={[styles.chip, isActive && styles.chipActive]}
                    onPress={() => {
                      updateFilter('surface_type', opt.key);
                      setVisible(false);
                    }}
                  >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  fab: {
    position: 'absolute',
    top: 8,
    left: 12,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    // Fundo claro com sombra — sobre mapas claros um fundo escuro
    // translúcido com ícone escuro fica ilegível
    backgroundColor: c.card,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: c.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    fontFamily: 'DMMono_500Medium',
    fontSize: 10,
    color: c.primaryForeground,
  },
  backdrop: {
    flex: 1,
    backgroundColor: c.overlayDark,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '70%',
    backgroundColor: c.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderColor: c.border,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    ...typography.bodyBold,
    color: c.foreground,
    fontSize: 18,
  },
  sheetHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: withAlpha(c.foreground, 0.08),
  },
  clearBtnText: {
    ...typography.body,
    fontSize: 12,
    color: c.primary,
  },
  closeBtn: {
    padding: 4,
  },
  sectionLabel: {
    ...typography.mono,
    fontSize: 11,
    color: c.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: withAlpha(c.foreground, 0.06),
  },
  chipActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  chipText: {
    ...typography.body,
    fontSize: 13,
    color: c.foreground,
  },
  chipTextActive: {
    color: c.primaryForeground,
    fontFamily: 'Barlow_600SemiBold',
  },
});
