import { useState, useEffect, useMemo } from 'react';
import { useColors } from '../../../../hooks/useColors';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { getEquipment } from '../../../../services/equipment';
import { useAuthStore } from '../../../../store/authStore';
import { useUpdateEquipment, useDeleteEquipment } from '../../../../hooks/useEquipment';
import { EQUIPMENT_TYPES } from '../../../../lib/constants';
import { useTranslation } from 'react-i18next';
import { typography, type Colors } from '../../../../lib/theme';
import type { EquipmentType, Equipment } from '../../../../lib/types';
import { goBackOr } from '../../../../lib/navigation';

export default function EditEquipmentScreen() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuthStore();
  const updateMutation = useUpdateEquipment();
  const deleteMutation = useDeleteEquipment();

  const { data: allEquipment } = useQuery({
    queryKey: ['equipment', profile?.id],
    queryFn: () => getEquipment(profile!.id),
    enabled: !!profile?.id,
  });

  const equipment = allEquipment?.find((e) => e.id === id);

  const [name, setName] = useState('');
  const [type, setType] = useState<EquipmentType | null>(null);
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [initialDistance, setInitialDistance] = useState('');
  const [notes, setNotes] = useState('');
  const [isRetired, setIsRetired] = useState(false);

  useEffect(() => {
    if (equipment) {
      setName(equipment.name);
      setType(equipment.type);
      setBrand(equipment.brand ?? '');
      setModel(equipment.model ?? '');
      setInitialDistance(equipment.initial_distance ? String(equipment.initial_distance) : '');
      setNotes(equipment.notes ?? '');
      setIsRetired(equipment.is_retired);
    }
  }, [equipment]);

  const handleSave = async () => {
    if (!name.trim() || !type) {
      Alert.alert(t('equipment_required'));
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: id!,
        data: {
          name: name.trim(),
          type,
          brand: brand.trim() || undefined,
          model: model.trim() || undefined,
          notes: notes.trim() || undefined,
          initial_distance: initialDistance ? parseFloat(initialDistance) : 0,
          is_retired: isRetired,
        },
      });
      goBackOr('/profile/equipment');
    } catch (err: any) {
      Alert.alert(err.message || t('error_generic'));
    }
  };

  const handleDelete = () => {
    Alert.alert(
      t('equipment_delete'),
      t('equipment_delete_confirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync(id!);
              goBackOr('/profile/equipment');
            } catch (err: any) {
              Alert.alert(err.message || t('error_generic'));
            }
          },
        },
      ]
    );
  };

  if (!equipment) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>{t('register_first_name')}</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder={t('equipment_name_placeholder')}
        placeholderTextColor={c.mutedForeground}
      />

      <Text style={styles.label}>{t('equipment_type_label')}</Text>
      <View style={styles.chipGrid}>
        {EQUIPMENT_TYPES.map((et) => (
          <TouchableOpacity
            key={et.key}
            style={[styles.chip, type === et.key && styles.chipSelected]}
            onPress={() => setType(type === et.key ? null : et.key)}
          >
            <Ionicons name={(et.icon as any) ?? 'cube'} size={24} color={type === et.key ? c.primary : c.foreground} />
            <Text style={[styles.chipLabel, type === et.key && styles.chipLabelSelected]}>
              {t(et.i18n_key as any)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>{t('equipment_brand')}</Text>
      <TextInput
        style={styles.input}
        value={brand}
        onChangeText={setBrand}
        placeholder={t('equipment_brand_placeholder')}
        placeholderTextColor={c.mutedForeground}
      />

      <Text style={styles.label}>{t('equipment_model')}</Text>
      <TextInput
        style={styles.input}
        value={model}
        onChangeText={setModel}
        placeholder={t('equipment_model_placeholder')}
        placeholderTextColor={c.mutedForeground}
      />

      <Text style={styles.label}>{t('equipment_initial_distance')}</Text>
      <TextInput
        style={styles.input}
        value={initialDistance}
        onChangeText={setInitialDistance}
        keyboardType="numeric"
        placeholder={t('equipment_distance_placeholder')}
        placeholderTextColor={c.mutedForeground}
      />

      <Text style={styles.label}>{t('equipment_notes')}</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
        placeholder={t('equipment_notes_placeholder')}
        placeholderTextColor={c.mutedForeground}
      />

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>{t('equipment_retired_label')}</Text>
        <TouchableOpacity
          style={[styles.toggleButton, isRetired && styles.toggleButtonActive]}
          onPress={() => setIsRetired(!isRetired)}
        >
          <Text style={[styles.toggleText, isRetired && styles.toggleTextActive]}>
            {isRetired ? 'Sim' : t('equipment_no')}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.saveButton, updateMutation.isPending && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={updateMutation.isPending}
      >
        <Text style={styles.saveButtonText}>
          {updateMutation.isPending ? t('equipment_saving') : t('equipment_save_changes')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={handleDelete}
        disabled={deleteMutation.isPending}
      >
        <Text style={styles.deleteButtonText}>
          {deleteMutation.isPending ? t('equipment_deleting') : t('equipment_delete')}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.background },
  label: { ...typography.bodyMedium, fontSize: 14, marginBottom: 6, marginTop: 16, color: c.foreground },
  input: {
    ...typography.body,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: c.inputBackground,
    color: c.foreground,
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: c.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 4,
  },
  chipSelected: { borderColor: c.primary, backgroundColor: c.inputBackground },
  chipIcon: { fontSize: 16 },
  chipLabel: { ...typography.bodyMedium, fontSize: 13, color: c.mutedForeground },
  chipLabelSelected: { color: c.primary },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, paddingVertical: 12, borderTopWidth: 1, borderColor: c.border },
  switchLabel: { ...typography.body, fontSize: 16, color: c.foreground },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: c.inputBackground,
  },
  toggleButtonActive: { backgroundColor: c.destructive },
  toggleText: { ...typography.bodyMedium, fontSize: 14, color: c.mutedForeground },
  toggleTextActive: { color: c.destructiveForeground },
  saveButton: { backgroundColor: c.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 32 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { ...typography.bodyBold, color: c.primaryForeground, fontSize: 16 },
  deleteButton: { backgroundColor: 'transparent', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 12 },
  deleteButtonText: { ...typography.bodyBold, color: c.destructive, fontSize: 16 },
});
