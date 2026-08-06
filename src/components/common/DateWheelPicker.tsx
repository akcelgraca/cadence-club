import { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Platform,
} from 'react-native';
import { colors, typography } from '../../lib/theme';
import { useTranslation } from 'react-i18next';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const ITEM_HEIGHT = 40;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const HALF_PADDING = PICKER_HEIGHT / 2 - ITEM_HEIGHT / 2;

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_START = 1930;
const YEARS = Array.from({ length: CURRENT_YEAR - YEAR_START + 1 }, (_, i) => CURRENT_YEAR - i);

function getDaysInMonth(monthIndex: number, year: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

interface DateWheelPickerProps {
  visible: boolean;
  value: string; // "YYYY-MM-DD"
  onConfirm: (date: string) => void;
  onCancel: () => void;
}

export default function DateWheelPicker({ visible, value, onConfirm, onCancel }: DateWheelPickerProps) {
  const { t } = useTranslation();
  const parsed = useMemo(() => {
    const parts = value.split('-');
    const y = parts[0] ? parseInt(parts[0], 10) : 2000;
    const m = parts[1] ? parseInt(parts[1], 10) - 1 : 0;
    const d = parts[2] ? parseInt(parts[2], 10) : 1;
    return {
      year: YEARS.includes(y) ? y : CURRENT_YEAR,
      month: m >= 0 && m < 12 ? m : 0,
      day: d >= 1 && d <= 31 ? d : 1,
    };
  }, [value]);

  const [selectedDay, setSelectedDay] = useState(parsed.day);
  const [selectedMonth, setSelectedMonth] = useState(parsed.month);
  const [selectedYear, setSelectedYear] = useState(parsed.year);

  const dayListRef = useRef<FlatList>(null);
  const monthListRef = useRef<FlatList>(null);
  const yearListRef = useRef<FlatList>(null);

  const initialOffsets = useRef({
    day: Math.max(0, parsed.day - 1),
    month: parsed.month,
    year: YEARS.indexOf(parsed.year),
  });

  const daysInMonth = useMemo(
    () => getDaysInMonth(selectedMonth, selectedYear),
    [selectedMonth, selectedYear],
  );

  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

  // Clamp day if it exceeds the new month's days
  const safeDay = useMemo(() => {
    return selectedDay > daysInMonth ? daysInMonth : selectedDay;
  }, [selectedDay, daysInMonth]);

  const formatDate = (day: number, month: number, year: number): string => {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  };

  const handleConfirm = () => {
    onConfirm(formatDate(safeDay, selectedMonth, selectedYear));
  };

  const scrollToInitial = useCallback(() => {
    setTimeout(() => {
      dayListRef.current?.scrollToOffset({ offset: initialOffsets.current.day * ITEM_HEIGHT, animated: false });
      monthListRef.current?.scrollToOffset({ offset: initialOffsets.current.month * ITEM_HEIGHT, animated: false });
      yearListRef.current?.scrollToOffset({ offset: initialOffsets.current.year * ITEM_HEIGHT, animated: false });
    }, 50);
  }, []);

  const makeMomentumHandler = (
    setter: (val: any) => void,
    data: any[],
    extractor?: (item: any, index: number) => any,
  ) =>
    (e: { nativeEvent: { contentOffset: { y: number } } }) => {
      const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
      if (index >= 0 && index < data.length) {
        const item = extractor ? extractor(data[index], index) : data[index];
        setter(item);
      }
    };

  const renderItem = (
    item: string | number,
    isSelected: boolean,
  ) => (
    <View style={styles.item}>
      <Text style={[styles.itemText, isSelected && styles.selectedItemText]}>
        {item}
      </Text>
    </View>
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    [],
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onShow={scrollToInitial}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onCancel} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.cancelText}>{t('cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{t('edit_profile_birth_date')}</Text>
            <TouchableOpacity onPress={handleConfirm} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.confirmText}>{t('ok')}</Text>
            </TouchableOpacity>
          </View>

          {/* Picker area — relative so highlight aligns to the columns */}
          <View style={styles.pickerWrapper}>
            <View style={styles.pickerRow}>
              {/* Day */}
              <View style={styles.column}>
                <FlatList
                  ref={dayListRef}
                  data={days}
                  keyExtractor={(item) => `d-${item}`}
                  renderItem={({ item }) => renderItem(item, item === safeDay)}
                  getItemLayout={getItemLayout}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={ITEM_HEIGHT}
                  decelerationRate="fast"
                  contentContainerStyle={{ paddingVertical: HALF_PADDING }}
                  onMomentumScrollEnd={makeMomentumHandler(setSelectedDay, days)}
                />
              </View>

              {/* Month */}
              <View style={styles.column}>
                <FlatList
                  ref={monthListRef}
                  data={MONTHS}
                  keyExtractor={(item) => `m-${item}`}
                  renderItem={({ item, index }) => renderItem(item, index === selectedMonth)}
                  getItemLayout={getItemLayout}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={ITEM_HEIGHT}
                  decelerationRate="fast"
                  contentContainerStyle={{ paddingVertical: HALF_PADDING }}
                  onMomentumScrollEnd={makeMomentumHandler(
                    setSelectedMonth,
                    MONTHS,
                    (_item, index) => index,
                  )}
                />
              </View>

              {/* Year */}
              <View style={styles.column}>
                <FlatList
                  ref={yearListRef}
                  data={YEARS}
                  keyExtractor={(item) => `y-${item}`}
                  renderItem={({ item }) => renderItem(item, item === selectedYear)}
                  getItemLayout={getItemLayout}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={ITEM_HEIGHT}
                  decelerationRate="fast"
                  contentContainerStyle={{ paddingVertical: HALF_PADDING }}
                  onMomentumScrollEnd={makeMomentumHandler(setSelectedYear, YEARS)}
                />
              </View>
            </View>

            {/* Highlight overlay — positioned relative to pickerWrapper */}
            <View style={styles.highlightBar} pointerEvents="none">
              <View style={styles.highlightLine} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: {
    ...typography.bodyBold,
    fontSize: 16,
    color: colors.foreground,
  },
  cancelText: {
    ...typography.body,
    fontSize: 15,
    color: colors.mutedForeground,
  },
  confirmText: {
    ...typography.bodyBold,
    fontSize: 15,
    color: colors.primary,
  },
  pickerWrapper: {
    position: 'relative',
    height: PICKER_HEIGHT,
  },
  pickerRow: {
    flexDirection: 'row',
    height: PICKER_HEIGHT,
  },
  column: {
    flex: 1,
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    ...typography.body,
    fontSize: 17,
    color: colors.mutedForeground,
  },
  selectedItemText: {
    ...typography.bodyBold,
    fontSize: 18,
    color: colors.foreground,
  },
  highlightBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  highlightLine: {
    height: ITEM_HEIGHT,
    width: '100%',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
});
