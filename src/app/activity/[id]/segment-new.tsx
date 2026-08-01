import { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { getActivity, getActivityPoints } from '../../../services/activities';
import { createSegmentFromActivity } from '../../../services/segments';
import { useAuthStore } from '../../../store/authStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { computeSplits } from '../../../utils/splits';
import { formatDistance } from '../../../utils/formatDistance';
import { colors, typography, withAlpha } from '../../../lib/theme';

/**
 * Cria um troço a partir de um pedaço desta atividade.
 *
 * O intervalo escolhe-se por quilómetro (ou milha) em vez de por coordenadas:
 * é a unidade que as pessoas usam para falar de percursos ("do km 2 ao 5").
 */
export default function NewSegmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const myId = useAuthStore((s) => s.profile?.id);
  const unitSystem = useSettingsStore((s) => s.settings.unitSystem);
  const unitMeters = unitSystem === 'imperial' ? 1609.344 : 1000;
  const unitLabel = unitSystem === 'imperial' ? 'mi' : 'km';

  const { data: activity } = useQuery({
    queryKey: ['activity', id],
    queryFn: () => getActivity(id),
    enabled: !!id,
  });

  const { data: points = [], isLoading } = useQuery({
    queryKey: ['activityPoints', id],
    queryFn: () => getActivityPoints(id),
    enabled: !!id,
  });

  const splits = useMemo(
    () => computeSplits(
      points.map((p) => ({
        lat: p.lat, lng: p.lng, elevation: p.elevation, timestamp: p.timestamp,
      })),
      unitSystem,
    ),
    [points, unitSystem],
  );

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startUnit, setStartUnit] = useState(0);
  const [endUnit, setEndUnit] = useState(1);
  const [saving, setSaving] = useState(false);

  const totalUnits = splits.length;
  const isOwner = !!activity && activity.user_id === myId;

  // Metros reais do intervalo, somando as distâncias de cada parcial
  const startMeters = splits.slice(0, startUnit).reduce((sum, s) => sum + s.distance, 0);
  const endMeters = splits.slice(0, endUnit + 1).reduce((sum, s) => sum + s.distance, 0);
  const segmentMeters = Math.max(0, endMeters - startMeters);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Nome obrigatório', 'Dá um nome ao troço.');
      return;
    }
    if (segmentMeters < 200) {
      Alert.alert('Troço demasiado curto', 'Escolhe um intervalo com pelo menos 200 metros.');
      return;
    }
    setSaving(true);
    try {
      const segmentId = await createSegmentFromActivity({
        activityId: id,
        name: name.trim(),
        startMeters,
        endMeters,
        description: description.trim() || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['activitySegments', id] });
      router.replace(`/segment/${segmentId}`);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível criar o troço.');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!isOwner || totalUnits < 1) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <Text style={styles.errorText}>
          {isOwner
            ? 'Esta atividade não tem GPS suficiente para criar um troço.'
            : 'Só podes criar troços a partir das tuas atividades.'}
        </Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Voltar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Criar troço</Text>
        <TouchableOpacity onPress={handleCreate} disabled={saving || !name.trim()} hitSlop={12}>
          {saving
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Text style={[styles.saveText, !name.trim() && styles.saveTextOff]}>Criar</Text>}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <View style={styles.notice}>
            <Ionicons name="people-outline" size={14} color={colors.mutedForeground} />
            <Text style={styles.noticeText}>
              Os troços são partilhados com a comunidade. Quem passar por aqui vê o próprio
              tempo e a média do grupo — não há classificações.
            </Text>
          </View>

          <Text style={styles.label}>Nome do troço *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Subida do Parque"
            placeholderTextColor={colors.mutedForeground}
            value={name}
            onChangeText={setName}
            maxLength={120}
            autoFocus
          />

          <Text style={styles.label}>Início</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {splits.map((_, i) => (
              <TouchableOpacity
                key={`s-${i}`}
                style={[styles.chip, startUnit === i && styles.chipActive]}
                onPress={() => {
                  setStartUnit(i);
                  if (endUnit < i) setEndUnit(i);
                }}
              >
                <Text style={[styles.chipText, startUnit === i && styles.chipTextActive]}>
                  {i === 0 ? 'Início' : `${i} ${unitLabel}`}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Fim</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {splits.map((_, i) => (
              <TouchableOpacity
                key={`e-${i}`}
                disabled={i < startUnit}
                style={[
                  styles.chip,
                  endUnit === i && styles.chipActive,
                  i < startUnit && styles.chipDisabled,
                ]}
                onPress={() => setEndUnit(i)}
              >
                <Text style={[styles.chipText, endUnit === i && styles.chipTextActive]}>
                  {i + 1} {unitLabel}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.summary}>
            <Ionicons name="git-commit-outline" size={16} color={colors.primary} />
            <Text style={styles.summaryText}>
              {formatDistance(segmentMeters, unitSystem)} — do{' '}
              {startUnit === 0 ? 'início' : `${unitLabel} ${startUnit}`} ao {unitLabel} {endUnit + 1}
            </Text>
          </View>

          <Text style={styles.label}>Descrição</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            placeholder="Piso, inclinação, o que esperar..."
            placeholderTextColor={colors.mutedForeground}
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={300}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.createBtn, (saving || !name.trim()) && styles.createBtnOff]}
            onPress={handleCreate}
            disabled={saving || !name.trim()}
          >
            {saving
              ? <ActivityIndicator color={colors.primaryForeground} />
              : <Text style={styles.createBtnText}>Criar troço</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32, gap: 14, backgroundColor: colors.background,
  },
  errorText: { ...typography.body, fontSize: 15, color: colors.mutedForeground, textAlign: 'center' },
  backBtn: {
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 20, backgroundColor: colors.primary,
  },
  backBtnText: { fontFamily: 'Barlow_600SemiBold', fontSize: 13, color: colors.primaryForeground },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  headerTitle: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 18, color: colors.foreground },
  saveText: { fontFamily: 'Barlow_600SemiBold', fontSize: 15, color: colors.primary },
  saveTextOff: { color: colors.mutedForeground },

  form: { padding: 16, paddingBottom: 48 },

  notice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    padding: 12, borderRadius: 12,
    backgroundColor: withAlpha(colors.primary, 0.07),
  },
  noticeText: {
    ...typography.body, fontSize: 12, color: colors.mutedForeground,
    flex: 1, lineHeight: 17,
  },

  label: {
    fontFamily: 'Barlow_600SemiBold', fontSize: 13,
    color: colors.foreground, marginTop: 20, marginBottom: 8,
  },
  input: {
    ...typography.body, fontSize: 15, color: colors.foreground,
    backgroundColor: colors.card, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  inputMulti: { minHeight: 80, paddingTop: 12 },

  chipRow: { gap: 8, paddingRight: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18,
    backgroundColor: withAlpha(colors.foreground, 0.06),
  },
  chipActive: { backgroundColor: colors.primary },
  chipDisabled: { opacity: 0.35 },
  chipText: { fontFamily: 'DMMono_400Regular', fontSize: 12, color: colors.mutedForeground },
  chipTextActive: { color: colors.primaryForeground },

  summary: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 18, padding: 14, borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  summaryText: { ...typography.bodyMedium, fontSize: 14, color: colors.foreground, flex: 1 },

  createBtn: {
    backgroundColor: colors.primary, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', marginTop: 28,
  },
  createBtnOff: { opacity: 0.45 },
  createBtnText: { fontFamily: 'Barlow_600SemiBold', fontSize: 16, color: colors.primaryForeground },
});
