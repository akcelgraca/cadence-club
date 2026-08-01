import { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { createClubEvent } from '../../../services/events';
import { ActivityIcon } from '../../../components/common/ActivityIcon';
import { ACTIVITY_CATEGORIES } from '../../../lib/constants';
import { colors, typography, withAlpha } from '../../../lib/theme';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** Próximos 60 dias, para escolha rápida sem picker nativo. */
function buildDays(): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 60 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });
}

/** Horas de 06:00 a 22:30, de 30 em 30 minutos. */
function buildTimes(): string[] {
  const out: string[] = [];
  for (let h = 6; h <= 22; h++) {
    out.push(`${String(h).padStart(2, '0')}:00`);
    out.push(`${String(h).padStart(2, '0')}:30`);
  }
  return out;
}

// Atividades sugeridas — as mais comuns em encontros de clube
const SUGGESTED_ACTIVITIES = ['run', 'trail_run', 'walk', 'cycle', 'mtb', 'swimming', 'yoga'];

export default function NewClubEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const days = useMemo(buildDays, []);
  const times = useMemo(buildTimes, []);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [activityType, setActivityType] = useState<string | null>('run');
  const [dayIndex, setDayIndex] = useState(1); // amanhã por defeito
  const [time, setTime] = useState('09:00');
  const [saving, setSaving] = useState(false);

  const activityOptions = useMemo(() => {
    const all = ACTIVITY_CATEGORIES.flatMap((c) => c.activities);
    return SUGGESTED_ACTIVITIES
      .map((key) => all.find((a) => a.key === key))
      .filter((a): a is NonNullable<typeof a> => !!a);
  }, []);

  const startsAt = useMemo(() => {
    const d = new Date(days[dayIndex]);
    const [h, m] = time.split(':').map(Number);
    d.setHours(h, m, 0, 0);
    return d;
  }, [days, dayIndex, time]);

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Título obrigatório', 'Dá um nome ao encontro.');
      return;
    }
    if (startsAt.getTime() < Date.now()) {
      Alert.alert('Data inválida', 'Escolhe uma data e hora no futuro.');
      return;
    }
    setSaving(true);
    try {
      const km = parseFloat(distanceKm.replace(',', '.'));
      await createClubEvent({
        club_id: id,
        title: title.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        activity_type: activityType ?? undefined,
        distance: Number.isFinite(km) && km > 0 ? km * 1000 : undefined,
        starts_at: startsAt.toISOString(),
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível criar o evento.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Novo evento</Text>
        <TouchableOpacity onPress={handleCreate} disabled={!title.trim() || saving} hitSlop={12}>
          {saving
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Text style={[styles.saveText, !title.trim() && styles.saveTextDisabled]}>Criar</Text>}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          {/* Título */}
          <Text style={styles.label}>Nome do encontro *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Corrida de sábado no parque"
            placeholderTextColor={colors.mutedForeground}
            value={title}
            onChangeText={setTitle}
            maxLength={120}
            autoFocus
          />

          {/* Data */}
          <Text style={styles.label}>Dia</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {days.map((d, i) => {
              const active = i === dayIndex;
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.dayChip, active && styles.dayChipActive]}
                  onPress={() => setDayIndex(i)}
                >
                  <Text style={[styles.dayWeek, active && styles.dayTextActive]}>
                    {i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : WEEKDAYS[d.getDay()]}
                  </Text>
                  <Text style={[styles.dayNum, active && styles.dayTextActive]}>{d.getDate()}</Text>
                  <Text style={[styles.dayMonth, active && styles.dayTextActive]}>{MONTHS[d.getMonth()]}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Hora */}
          <Text style={styles.label}>Hora</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {times.map((tm) => {
              const active = tm === time;
              return (
                <TouchableOpacity
                  key={tm}
                  style={[styles.timeChip, active && styles.timeChipActive]}
                  onPress={() => setTime(tm)}
                >
                  <Text style={[styles.timeText, active && styles.dayTextActive]}>{tm}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Modalidade */}
          <Text style={styles.label}>Modalidade</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {activityOptions.map((a) => {
              const active = activityType === a.key;
              return (
                <TouchableOpacity
                  key={a.key}
                  style={[styles.actChip, active && styles.actChipActive]}
                  onPress={() => setActivityType(active ? null : a.key)}
                >
                  <ActivityIcon
                    activityKey={a.key}
                    size={13}
                    tintColor={active ? colors.primaryForeground : colors.mutedForeground}
                  />
                  <Text style={[styles.actText, active && styles.dayTextActive]}>{a.key.replace('_', ' ')}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Local */}
          <Text style={styles.label}>Ponto de encontro</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Entrada do Parque da Cidade"
            placeholderTextColor={colors.mutedForeground}
            value={location}
            onChangeText={setLocation}
            maxLength={120}
          />

          {/* Distância */}
          <Text style={styles.label}>Distância prevista (km)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: 10"
            placeholderTextColor={colors.mutedForeground}
            value={distanceKm}
            onChangeText={setDistanceKm}
            keyboardType="decimal-pad"
            maxLength={6}
          />

          {/* Descrição */}
          <Text style={styles.label}>Detalhes</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            placeholder="Ritmo, nível, o que levar..."
            placeholderTextColor={colors.mutedForeground}
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />

          {/* Resumo */}
          <View style={styles.summary}>
            <Ionicons name="calendar-outline" size={16} color={colors.primary} />
            <Text style={styles.summaryText}>
              {startsAt.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })} às {time}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.createBtn, (!title.trim() || saving) && styles.createBtnDisabled]}
            onPress={handleCreate}
            disabled={!title.trim() || saving}
          >
            {saving
              ? <ActivityIndicator color={colors.primaryForeground} />
              : <Text style={styles.createBtnText}>Criar evento</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 18, color: colors.foreground },
  saveText: { fontFamily: 'Barlow_600SemiBold', fontSize: 15, color: colors.primary },
  saveTextDisabled: { color: colors.mutedForeground },

  form: { padding: 16, paddingBottom: 40 },
  label: {
    fontFamily: 'Barlow_600SemiBold', fontSize: 13,
    color: colors.foreground, marginBottom: 8, marginTop: 18,
  },
  input: {
    ...typography.body, fontSize: 15, color: colors.foreground,
    backgroundColor: colors.card, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  inputMulti: { minHeight: 90, paddingTop: 12 },

  chipRow: { gap: 8, paddingVertical: 2, paddingRight: 8 },
  dayChip: {
    width: 58, paddingVertical: 8, borderRadius: 14,
    alignItems: 'center',
    backgroundColor: withAlpha(colors.foreground, 0.06),
  },
  dayChipActive: { backgroundColor: colors.primary },
  dayWeek: { fontFamily: 'Barlow_500Medium', fontSize: 10, color: colors.mutedForeground, textTransform: 'uppercase' },
  dayNum: { fontFamily: 'BarlowCondensed_900Black', fontSize: 20, color: colors.foreground, lineHeight: 22 },
  dayMonth: { fontFamily: 'Barlow_500Medium', fontSize: 10, color: colors.mutedForeground, textTransform: 'uppercase' },
  dayTextActive: { color: colors.primaryForeground },

  timeChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
    backgroundColor: withAlpha(colors.foreground, 0.06),
  },
  timeChipActive: { backgroundColor: colors.primary },
  timeText: { fontFamily: 'DMMono_400Regular', fontSize: 13, color: colors.foreground },

  actChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16,
    backgroundColor: withAlpha(colors.foreground, 0.06),
  },
  actChipActive: { backgroundColor: colors.primary },
  actText: {
    fontFamily: 'Barlow_500Medium', fontSize: 12,
    color: colors.mutedForeground, textTransform: 'capitalize',
  },

  summary: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 24, padding: 14, borderRadius: 12,
    backgroundColor: withAlpha(colors.primary, 0.08),
  },
  summaryText: { ...typography.bodyMedium, fontSize: 14, color: colors.foreground, flex: 1 },

  createBtn: {
    backgroundColor: colors.primary, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', marginTop: 16,
  },
  createBtnDisabled: { opacity: 0.45 },
  createBtnText: { fontFamily: 'Barlow_600SemiBold', fontSize: 16, color: colors.primaryForeground },
});
