import { useMemo, useState } from 'react';
import { useColors } from '../../../hooks/useColors';
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
import { typography, withAlpha, type Colors } from '../../../lib/theme';
import { useTranslation } from 'react-i18next';
import { goBackOr } from '../../../lib/navigation';

/**
 * Cria um troço a partir de um pedaço desta atividade.
 *
 * O intervalo escolhe-se por quilómetro (ou milha) em vez de por coordenadas:
 * é a unidade que as pessoas usam para falar de percursos ("do km 2 ao 5").
 */
export default function NewSegmentScreen() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
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
      Alert.alert(t('segment_new_name_required_title'), t('segment_new_name_required_body'));
      return;
    }
    if (segmentMeters < 200) {
      Alert.alert(t('segment_new_too_short_title'), t('segment_new_too_short_body'));
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
      Alert.alert(e?.message ?? t('segment_new_error'));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <ActivityIndicator size="large" color={c.primary} />
      </SafeAreaView>
    );
  }

  if (!isOwner || totalUnits < 1) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <Text style={styles.errorText}>
          {isOwner
            ? t('segment_new_no_gps')
            : t('segment_new_not_yours')}
        </Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => goBackOr(`/activity/${id}`)}>
          <Text style={styles.backBtnText}>{t('route_creator_back')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOr(`/activity/${id}`)} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={c.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('activity_create_segment')}</Text>
        <TouchableOpacity onPress={handleCreate} disabled={saving || !name.trim()} hitSlop={12}>
          {saving
            ? <ActivityIndicator size="small" color={c.primary} />
            : <Text style={[styles.saveText, !name.trim() && styles.saveTextOff]}>{t('create')}</Text>}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <View style={styles.notice}>
            <Ionicons name="people-outline" size={14} color={c.mutedForeground} />
            <Text style={styles.noticeText}>
              Os troços são partilhados com a comunidade. Quem passar por aqui vê o próprio
              tempo e a média do grupo — não há classificações.
            </Text>
          </View>

          <Text style={styles.label}>{t('segment_new_name_label')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('segment_new_name_placeholder')}
            placeholderTextColor={c.mutedForeground}
            value={name}
            onChangeText={setName}
            maxLength={120}
            autoFocus
          />

          <Text style={styles.label}>{t('segment_new_start')}</Text>
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
                  {i === 0 ? t('segment_new_start') : `${i} ${unitLabel}`}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>{t('segment_new_end')}</Text>
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
            <Ionicons name="git-commit-outline" size={16} color={c.primary} />
            <Text style={styles.summaryText}>
              {startUnit === 0
                ? t('segment_new_range_from_start', {
                    distance: formatDistance(segmentMeters, unitSystem),
                    unit: unitLabel,
                    to: endUnit + 1,
                  })
                : t('segment_new_range', {
                    distance: formatDistance(segmentMeters, unitSystem),
                    unit: unitLabel,
                    from: startUnit,
                    to: endUnit + 1,
                  })}
            </Text>
          </View>

          <Text style={styles.label}>{t('activity_description_label')}</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            placeholder={t('segment_new_notes_placeholder')}
            placeholderTextColor={c.mutedForeground}
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
              ? <ActivityIndicator color={c.primaryForeground} />
              : <Text style={styles.createBtnText}>{t('activity_create_segment')}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32, gap: 14, backgroundColor: c.background,
  },
  errorText: { ...typography.body, fontSize: 15, color: c.mutedForeground, textAlign: 'center' },
  backBtn: {
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 20, backgroundColor: c.primary,
  },
  backBtnText: { fontFamily: 'Barlow_600SemiBold', fontSize: 13, color: c.primaryForeground },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
  },
  headerTitle: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 18, color: c.foreground },
  saveText: { fontFamily: 'Barlow_600SemiBold', fontSize: 15, color: c.primary },
  saveTextOff: { color: c.mutedForeground },

  form: { padding: 16, paddingBottom: 48 },

  notice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    padding: 12, borderRadius: 12,
    backgroundColor: withAlpha(c.primary, 0.07),
  },
  noticeText: {
    ...typography.body, fontSize: 12, color: c.mutedForeground,
    flex: 1, lineHeight: 17,
  },

  label: {
    fontFamily: 'Barlow_600SemiBold', fontSize: 13,
    color: c.foreground, marginTop: 20, marginBottom: 8,
  },
  input: {
    ...typography.body, fontSize: 15, color: c.foreground,
    backgroundColor: c.card, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
  },
  inputMulti: { minHeight: 80, paddingTop: 12 },

  chipRow: { gap: 8, paddingRight: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18,
    backgroundColor: withAlpha(c.foreground, 0.06),
  },
  chipActive: { backgroundColor: c.primary },
  chipDisabled: { opacity: 0.35 },
  chipText: { fontFamily: 'DMMono_400Regular', fontSize: 12, color: c.mutedForeground },
  chipTextActive: { color: c.primaryForeground },

  summary: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 18, padding: 14, borderRadius: 12,
    backgroundColor: c.card,
    borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
  },
  summaryText: { ...typography.bodyMedium, fontSize: 14, color: c.foreground, flex: 1 },

  createBtn: {
    backgroundColor: c.primary, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', marginTop: 28,
  },
  createBtnOff: { opacity: 0.45 },
  createBtnText: { fontFamily: 'Barlow_600SemiBold', fontSize: 16, color: c.primaryForeground },
});
