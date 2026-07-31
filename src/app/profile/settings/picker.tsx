import { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../../hooks/useColors';
import { typography } from '../../../lib/theme';
import { ActivityIcon } from '../../../components/common/ActivityIcon';
import { getActivityImage } from '../../../lib/activityImages';
import { getFocoImage } from '../../../lib/focoImages';

// ============================================================
// Module-level config — set before router.push() and consumed on mount
// ============================================================

interface PickerOption {
  key: string;
  label: string;
  icon?: string;
}

interface PickerSection {
  title: string;
  options: PickerOption[];
}

interface PickerConfig {
  title: string;
  options?: PickerOption[];
  sections?: PickerSection[];
  selectedKey: string;
  onSelect: (key: string) => void;
  /** Enable multi-select mode. selectedKey is ignored; pass selectedKeys instead. */
  multiSelect?: boolean;
  selectedKeys?: string[];
  /** Called when back is pressed in multi-select mode with the full selected array. */
  onMultiSelect?: (keys: string[]) => void;
}

let _config: PickerConfig | null = null;

export function setPickerConfig(config: PickerConfig) {
  _config = config;
}

// ============================================================
// Screen
// ============================================================

export default function PickerScreen() {
  const c = useColors();

  if (!_config) {
    // Nothing to show — dismiss
    router.back();
    return null;
  }

  const { options, sections, selectedKey, onSelect, multiSelect, selectedKeys, onMultiSelect } = _config;

  // Local multi-select state
  const [multiSelected, setMultiSelected] = useState<string[]>(selectedKeys ?? []);
  const multiSelectedRef = useRef(multiSelected);
  multiSelectedRef.current = multiSelected;

  const handleSelect = (key: string) => {
    if (multiSelect) {
      setMultiSelected((prev) =>
        prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
      );
      return;
    }
    // Single-select: consume before navigating back so re-renders don't re-fire
    _config = null;
    onSelect(key);
    router.back();
  };

  // On unmount (back press), commit multi-select and clear config
  useEffect(() => {
    return () => {
      if (_config?.multiSelect && _config.onMultiSelect) {
        _config.onMultiSelect(multiSelectedRef.current);
      }
      _config = null;
    };
  }, []);

  const isItemSelected = (key: string) => {
    if (multiSelect) return multiSelected.includes(key);
    return key === selectedKey;
  };

  const renderOption = (opt: PickerOption) => {
    const isSelected = isItemSelected(opt.key);
    return (
      <TouchableOpacity
        key={opt.key}
        style={[
          styles.option,
          { borderBottomColor: c.border },
          isSelected && { backgroundColor: c.inputBackground },
        ]}
        onPress={() => handleSelect(opt.key)}
      >
        <View style={styles.optionContent}>
          {opt.icon && (() => {
            const color = isSelected ? c.primary : '#FFFFFF';
            if (getActivityImage(opt.key, 'white')) {
              return <ActivityIcon activityKey={opt.key} size={20} tintColor={color} />;
            }
            const focoImg = getFocoImage(opt.key);
            if (focoImg) {
              return <Image source={focoImg} style={{ width: 20, height: 20, tintColor: color }} resizeMode="contain" />;
            }
            return <Ionicons name={opt.icon as any} size={20} color={color} />;
          })()}
          <Text style={[styles.optionText, isSelected && styles.optionTextSelected, !isSelected && { color: '#FFFFFF' }]}>
            {opt.label}
          </Text>
        </View>
        {isSelected && (
          <Ionicons name="checkmark" size={22} color={c.primary} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Stack.Screen options={{ title: _config.title }} />
      <ScrollView style={styles.scrollContainer}>
        {sections
          ? sections.map((section) => (
              <View key={section.title}>
                <Text style={[styles.sectionHeader, { color: c.mutedForeground }]}>
                  {section.title}
                </Text>
                {section.options.map(renderOption)}
              </View>
            ))
          : (options ?? []).map(renderOption)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    paddingTop: 8,
  },
  sectionHeader: {
    ...typography.bodyBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    opacity: 0.7,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionText: {
    ...typography.body,
    fontSize: 16,
  },
  optionTextSelected: {
    ...typography.bodyBold,
    color: '#C7F732', // primary — can't use useColors here since it wouldn't be dynamic per-item
  },
});
