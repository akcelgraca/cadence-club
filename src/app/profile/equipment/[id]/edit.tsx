import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { getEquipment } from '../../../../services/equipment';
import { useAuthStore } from '../../../../store/authStore';
import { useUpdateEquipment, useDeleteEquipment } from '../../../../hooks/useEquipment';
import { EQUIPMENT_TYPES } from '../../../../lib/constants';
import { colors, typography } from '../../../../lib/theme';
import type { EquipmentType, Equipment } from '../../../../lib/types';

export default function EditEquipmentScreen() {
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
      Alert.alert('Erro', 'Nome e tipo são obrigatórios.');
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
      router.back();
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Algo correu mal.');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Eliminar equipamento',
      'Tens a certeza que queres eliminar este equipamento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync(id!);
              router.back();
            } catch (err: any) {
              Alert.alert('Erro', err.message || 'Algo correu mal.');
            }
          },
        },
      ]
    );
  };

  if (!equipment) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Nome *</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Ex: Nike Pegasus 40"
        placeholderTextColor={colors.mutedForeground}
      />

      <Text style={styles.label}>Tipo *</Text>
      <View style={styles.chipGrid}>
        {EQUIPMENT_TYPES.map((et) => (
          <TouchableOpacity
            key={et.key}
            style={[styles.chip, type === et.key && styles.chipSelected]}
            onPress={() => setType(type === et.key ? null : et.key)}
          >
            <Ionicons name={(et.icon as any) ?? 'cube'} size={24} color={type === et.key ? colors.primary : colors.foreground} />
            <Text style={[styles.chipLabel, type === et.key && styles.chipLabelSelected]}>
              {et.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Marca</Text>
      <TextInput
        style={styles.input}
        value={brand}
        onChangeText={setBrand}
        placeholder="Ex: Nike"
        placeholderTextColor={colors.mutedForeground}
      />

      <Text style={styles.label}>Modelo</Text>
      <TextInput
        style={styles.input}
        value={model}
        onChangeText={setModel}
        placeholder="Ex: Pegasus 40"
        placeholderTextColor={colors.mutedForeground}
      />

      <Text style={styles.label}>Distância inicial (metros)</Text>
      <TextInput
        style={styles.input}
        value={initialDistance}
        onChangeText={setInitialDistance}
        keyboardType="numeric"
        placeholder="Ex: 0"
        placeholderTextColor={colors.mutedForeground}
      />

      <Text style={styles.label}>Notas</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
        placeholder="Notas opcionais..."
        placeholderTextColor={colors.mutedForeground}
      />

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Equipamento retirado</Text>
        <TouchableOpacity
          style={[styles.toggleButton, isRetired && styles.toggleButtonActive]}
          onPress={() => setIsRetired(!isRetired)}
        >
          <Text style={[styles.toggleText, isRetired && styles.toggleTextActive]}>
            {isRetired ? 'Sim' : 'Não'}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.saveButton, updateMutation.isPending && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={updateMutation.isPending}
      >
        <Text style={styles.saveButtonText}>
          {updateMutation.isPending ? 'A guardar...' : 'Guardar alterações'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={handleDelete}
        disabled={deleteMutation.isPending}
      >
        <Text style={styles.deleteButtonText}>
          {deleteMutation.isPending ? 'A eliminar...' : 'Eliminar equipamento'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  label: { ...typography.bodyMedium, fontSize: 14, marginBottom: 6, marginTop: 16, color: colors.foreground },
  input: {
    ...typography.body,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: colors.inputBackground,
    color: colors.foreground,
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 4,
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.inputBackground },
  chipIcon: { fontSize: 16 },
  chipLabel: { ...typography.bodyMedium, fontSize: 13, color: colors.mutedForeground },
  chipLabelSelected: { color: colors.primary },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, paddingVertical: 12, borderTopWidth: 1, borderColor: colors.border },
  switchLabel: { ...typography.body, fontSize: 16, color: colors.foreground },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.inputBackground,
  },
  toggleButtonActive: { backgroundColor: colors.destructive },
  toggleText: { ...typography.bodyMedium, fontSize: 14, color: colors.mutedForeground },
  toggleTextActive: { color: colors.destructiveForeground },
  saveButton: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 32 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { ...typography.bodyBold, color: colors.primaryForeground, fontSize: 16 },
  deleteButton: { backgroundColor: 'transparent', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 12 },
  deleteButtonText: { ...typography.bodyBold, color: colors.destructive, fontSize: 16 },
});
