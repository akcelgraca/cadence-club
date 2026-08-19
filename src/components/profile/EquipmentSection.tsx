import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useColors } from '../../hooks/useColors';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatDistance } from '../../utils/formatDistance';
import { EQUIPMENT_TYPES } from '../../lib/constants';
import { useSettingsStore } from '../../store/settingsStore';
import type { Equipment } from '../../lib/types';
import { typography, type Colors } from '../../lib/theme';
import { useTranslation } from 'react-i18next';

interface EquipmentSectionProps {
  equipment: Equipment[] | undefined;
  isLoading: boolean;
  isError: boolean;
  isOwnProfile?: boolean;
}

function getEquipmentIcon(type: string): string {
  const eq = EQUIPMENT_TYPES.find((e) => e.key === type);
  return eq?.icon ?? 'cube';
}

export function EquipmentSection({
  equipment,
  isLoading,
  isError,
  isOwnProfile = false,
}: EquipmentSectionProps) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
  const unitSystem = useSettingsStore((s) => s.settings.unitSystem);
  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t('settings_equipment')}</Text>
        <ActivityIndicator size="small" color={c.primary} style={{ marginTop: 16 }} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t('settings_equipment')}</Text>
        <Text style={styles.emptyText}>{t('equipment_load_error')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t('settings_equipment')}</Text>
        {isOwnProfile && (
          <TouchableOpacity
            onPress={() => router.push('/profile/equipment/add')}
          >
            <Text style={styles.addButton}>{t('add_plus')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {!equipment || equipment.length === 0 ? (
        <View style={styles.emptyInner}>
          <Text style={styles.emptyText}>{t('equipment_empty')}</Text>
          {isOwnProfile && (
            <Text style={styles.emptySubtext}>
              {t('equipment_empty_body')}
            </Text>
          )}
        </View>
      ) : (
        equipment.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.equipmentCard, item.is_retired && styles.retired]}
            onPress={() => {
              if (isOwnProfile) {
                router.push(`/profile/equipment/${item.id}/edit`);
              }
            }}
            activeOpacity={isOwnProfile ? 0.7 : 1}
          >
            <Ionicons name={getEquipmentIcon(item.type) as any} size={28} color={c.primary} style={styles.equipmentIcon} />
            <View style={styles.equipmentInfo}>
              <Text style={styles.equipmentName}>
                {item.name}
                {item.is_retired ? ' (Retirado)' : ''}
              </Text>
              {item.brand ? (
                <Text style={styles.equipmentDetail}>
                  {[item.brand, item.model].filter(Boolean).join(' ')}
                </Text>
              ) : null}
              <Text style={styles.equipmentDistance}>
                Distância inicial: {formatDistance(item.initial_distance, unitSystem)}
              </Text>
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: {
    backgroundColor: c.card,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: { ...typography.headline, fontSize: 18, color: c.foreground },
  addButton: { ...typography.bodyBold, color: c.primary, fontSize: 14 },
  emptyInner: { alignItems: 'center', paddingVertical: 16 },
  emptyText: { ...typography.body, fontSize: 14, color: c.mutedForeground, textAlign: 'center' },
  emptySubtext: { ...typography.body, fontSize: 12, color: c.mutedForeground, textAlign: 'center', marginTop: 4 },
  equipmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.inputBackground,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  retired: { opacity: 0.4 },
  equipmentIcon: { fontSize: 28, marginRight: 12 },
  equipmentInfo: { flex: 1 },
  equipmentName: { ...typography.bodyBold, fontSize: 15, color: c.foreground },
  equipmentDetail: { ...typography.body, fontSize: 13, color: c.mutedForeground, marginTop: 2 },
  equipmentDistance: { ...typography.mono, fontSize: 12, color: c.primary, marginTop: 2 },
});
