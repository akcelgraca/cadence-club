import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../store/authStore';
import { useEquipment } from '../../../hooks/useEquipment';
import { useSettingsStore } from '../../../store/settingsStore';
import { useColors } from '../../../hooks/useColors';
import { EQUIPMENT_TYPES } from '../../../lib/constants';
import { typography } from '../../../lib/theme';
import { formatDistance } from '../../../utils/formatDistance';
import type { Equipment } from '../../../lib/types';

function getEquipmentIcon(type: string): string {
  const eq = EQUIPMENT_TYPES.find((e) => e.key === type);
  return eq?.icon ?? 'cube';
}

export default function EquipmentListScreen() {
  const { t } = useTranslation();
  const c = useColors();
  const profile = useAuthStore((s) => s.profile);
  const unitSystem = useSettingsStore((s) => s.settings.unitSystem);
  const { data: equipment, isLoading, isError } = useEquipment(profile?.id);

  const renderItem = ({ item }: { item: Equipment }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: c.inputBackground, borderColor: c.border }, item.is_retired && styles.retired]}
      onPress={() => router.push(`/profile/equipment/${item.id}/edit`)}
      activeOpacity={0.7}
    >
      <Ionicons
        name={getEquipmentIcon(item.type) as any}
        size={28}
        color={item.is_retired ? c.mutedForeground : c.primary}
        style={styles.icon}
      />
      <View style={styles.info}>
        <Text style={[styles.name, { color: c.foreground }]}>
          {item.name}
          {item.is_retired ? ` ${t('equipment_retired')}` : ''}
        </Text>
        {item.brand ? (
          <Text style={[styles.detail, { color: c.mutedForeground }]}>
            {[item.brand, item.model].filter(Boolean).join(' ')}
          </Text>
        ) : null}
        <Text style={[styles.distance, { color: c.primary }]}>
          {t('equipment_distance')}: {formatDistance(item.initial_distance, unitSystem)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.mutedForeground} />
    </TouchableOpacity>
  );

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.empty}>
        <Ionicons name="cube-outline" size={48} color={c.mutedForeground} />
        <Text style={[styles.emptyText, { color: c.mutedForeground }]}>{t('equipment_empty')}</Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      ) : isError ? (
        <View style={styles.empty}>
          <Ionicons name="alert-circle-outline" size={48} color={c.destructive} />
          <Text style={[styles.emptyText, { color: c.mutedForeground }]}>{t('error_loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={equipment ?? []}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <View style={[styles.bottom, { borderTopColor: c.border }]}>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: c.primary }]}
          onPress={() => router.push('/profile/equipment/add')}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={22} color={c.primaryForeground} />
          <Text style={[styles.addButtonText, { color: c.primaryForeground }]}>{t('equipment_add_button')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, flexGrow: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  retired: { opacity: 0.4 },
  icon: { fontSize: 28 },
  info: { flex: 1 },
  name: { ...typography.bodyBold, fontSize: 16 },
  detail: { ...typography.body, fontSize: 13, marginTop: 2 },
  distance: { ...typography.mono, fontSize: 13, marginTop: 2 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingVertical: 80 },
  emptyText: { ...typography.body, fontSize: 14, textAlign: 'center' },
  bottom: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  addButtonText: { ...typography.bodyBold, fontSize: 16 },
});
