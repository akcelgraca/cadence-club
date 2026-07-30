import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../../store/authStore';
import { useCreateEquipment } from '../../../hooks/useEquipment';
import { EQUIPMENT_TYPES } from '../../../lib/constants';
import { colors, typography } from '../../../lib/theme';
import type { EquipmentType } from '../../../lib/types';

export default function AddEquipmentScreen() {
  const { profile } = useAuthStore();
  const createMutation = useCreateEquipment();

  const [name, setName] = useState('');
  const [type, setType] = useState<EquipmentType | null>(null);
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [initialDistance, setInitialDistance] = useState('');
  const [notes, setNotes] = useState('');

  const handleSave = async () => {
    if (!name.trim() || !type) {
      Alert.alert('Erro', 'Nome e tipo são obrigatórios.');
      return;
    }
    if (!profile) return;

    try {
      await createMutation.mutateAsync({
        user_id: profile.id,
        name: name.trim(),
        type,
        brand: brand.trim() || undefined,
        model: model.trim() || undefined,
        notes: notes.trim() || undefined,
        initial_distance: initialDistance ? parseFloat(initialDistance) : 0,
      });
      router.back();
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Algo correu mal.');
    }
  };

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

      <TouchableOpacity
        style={[styles.saveButton, createMutation.isPending && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={createMutation.isPending}
      >
        <Text style={styles.saveButtonText}>
          {createMutation.isPending ? 'A guardar...' : 'Adicionar equipamento'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24 },
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
  saveButton: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 32 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { ...typography.bodyBold, color: colors.primaryForeground, fontSize: 16 },
});
