import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../hooks/useColors';
import { useAppTranslation } from '../../hooks/useAppTranslation';
import { typography } from '../../lib/theme';
import { DAYS_OF_WEEK, SESSION_DURATIONS, FITNESS_LEVELS, WEEKLY_FREQUENCIES, PREFERRED_TIMES, TRAINING_FOCUSES, ACTIVITY_CATEGORIES } from '../../lib/constants';
import type { QuestionnairePreferences, SessionDuration, FitnessLevel, PreferredTime, TrainingFocus } from '../../lib/types';
import { setPickerConfig } from '../../app/profile/settings/picker';

// ============================================================
// Props
// ============================================================
interface QuestionnaireFormProps {
  initialValues?: Partial<QuestionnairePreferences> | null;
  onSave: (prefs: QuestionnairePreferences) => void | Promise<void>;
  saving?: boolean;
}

// ============================================================
// Component
// ============================================================
export default function QuestionnaireForm({ initialValues, onSave, saving }: QuestionnaireFormProps) {
  const c = useColors();
  const { t } = useAppTranslation();

  const [availableDays, setAvailableDays] = useState<number[]>(
    initialValues?.available_days ?? [],
  );
  const [preferredActivities, setPreferredActivities] = useState<string[]>(
    initialValues?.preferred_activities ?? [],
  );
  const [sessionDuration, setSessionDuration] = useState<SessionDuration | null>(
    initialValues?.session_duration ?? null,
  );
  const [fitnessLevel, setFitnessLevel] = useState<FitnessLevel | null>(
    initialValues?.fitness_level ?? null,
  );
  const [weeklyFrequency, setWeeklyFrequency] = useState<number | null>(
    initialValues?.weekly_frequency ?? null,
  );
  const [preferredTime, setPreferredTime] = useState<PreferredTime | null>(
    initialValues?.preferred_time ?? null,
  );
  const [trainingFocus, setTrainingFocus] = useState<TrainingFocus | null>(
    initialValues?.training_focus ?? null,
  );

  // --- Picker openers ---

  const openDayPicker = useCallback(() => {
    setPickerConfig({
      title: t('questionnaire_days_title'),
      options: DAYS_OF_WEEK.map((d) => ({
        key: String(d.key),
        label: t(d.full_key as any),
      })),
      selectedKey: '',
      multiSelect: true,
      selectedKeys: availableDays.map(String),
      onSelect: () => {},
      onMultiSelect: (keys) => {
        setAvailableDays(keys.map(Number).sort());
      },
    });
    router.push('/profile/settings/picker');
  }, [availableDays, t]);

  const openActivityPicker = useCallback(() => {
    const sections = ACTIVITY_CATEGORIES.map((cat) => ({
      title: t(cat.i18n_key as any),
      options: cat.activities.map((a) => ({
        key: a.key,
        label: t(a.i18n_key as any),
        icon: a.icon,
      })),
    }));

    setPickerConfig({
      title: t('questionnaire_activities_title'),
      sections,
      selectedKey: '',
      multiSelect: true,
      selectedKeys: preferredActivities,
      onSelect: () => {},
      onMultiSelect: (keys) => {
        setPreferredActivities(keys);
      },
    });
    router.push('/profile/settings/picker');
  }, [preferredActivities, t]);

  const openDurationPicker = useCallback(() => {
    setPickerConfig({
      title: t('questionnaire_duration_title'),
      options: SESSION_DURATIONS.map((d) => ({
        key: d.key,
        label: t(d.i18n_key as any),
      })),
      selectedKey: sessionDuration ?? '',
      onSelect: (key) => setSessionDuration(key as SessionDuration),
    });
    router.push('/profile/settings/picker');
  }, [sessionDuration, t]);

  const openFitnessPicker = useCallback(() => {
    setPickerConfig({
      title: t('questionnaire_fitness_title'),
      options: FITNESS_LEVELS.map((l) => ({
        key: l.key,
        label: t(l.i18n_key as any),
      })),
      selectedKey: fitnessLevel ?? '',
      onSelect: (key) => setFitnessLevel(key as FitnessLevel),
    });
    router.push('/profile/settings/picker');
  }, [fitnessLevel, t]);

  const openFrequencyPicker = useCallback(() => {
    setPickerConfig({
      title: t('questionnaire_frequency_title'),
      options: WEEKLY_FREQUENCIES.map((f) => ({
        key: String(f.key),
        label: t(f.i18n_key as any),
      })),
      selectedKey: weeklyFrequency !== null ? String(weeklyFrequency) : '',
      onSelect: (key) => setWeeklyFrequency(Number(key)),
    });
    router.push('/profile/settings/picker');
  }, [weeklyFrequency, t]);

  const openTimePicker = useCallback(() => {
    setPickerConfig({
      title: t('questionnaire_time_title'),
      options: PREFERRED_TIMES.map((pt) => ({
        key: pt.key,
        label: t(pt.i18n_key as any),
        icon: pt.icon,
      })),
      selectedKey: preferredTime ?? '',
      onSelect: (key) => setPreferredTime(key as PreferredTime),
    });
    router.push('/profile/settings/picker');
  }, [preferredTime, t]);

  const openFocusPicker = useCallback(() => {
    setPickerConfig({
      title: t('questionnaire_focus_title'),
      options: TRAINING_FOCUSES.map((tf) => ({
        key: tf.key,
        label: t(tf.i18n_key as any),
        icon: tf.icon,
      })),
      selectedKey: trainingFocus ?? '',
      onSelect: (key) => setTrainingFocus(key as TrainingFocus),
    });
    router.push('/profile/settings/picker');
  }, [trainingFocus, t]);

  // --- Save ---

  const handleSave = () => {
    if (availableDays.length === 0) {
      Alert.alert('', t('questionnaire_select_at_least_one_day'));
      return;
    }
    if (preferredActivities.length === 0) {
      Alert.alert('', t('questionnaire_select_at_least_one_activity'));
      return;
    }

    onSave({
      available_days: availableDays,
      preferred_activities: preferredActivities,
      session_duration: sessionDuration ?? 'medium',
      fitness_level: fitnessLevel ?? 'beginner',
      weekly_frequency: weeklyFrequency ?? undefined,
      preferred_time: preferredTime ?? undefined,
      training_focus: trainingFocus ?? undefined,
    });
  };

  // --- Helpers for displaying selected values ---

  const styles = createStyles(c);

  const selectedDurationLabel = SESSION_DURATIONS.find((d) => d.key === sessionDuration);
  const selectedFitnessLabel = FITNESS_LEVELS.find((l) => l.key === fitnessLevel);
  const selectedFrequencyLabel = WEEKLY_FREQUENCIES.find((f) => String(f.key) === String(weeklyFrequency));
  const selectedTimeLabel = PREFERRED_TIMES.find((pt) => pt.key === preferredTime);
  const selectedFocusLabel = TRAINING_FOCUSES.find((tf) => tf.key === trainingFocus);

  // --- Row component ---

  const renderPickerRow = (
    label: string,
    value: string,
    onPress: () => void,
  ) => (
    <TouchableOpacity
      style={[styles.card, styles.pickerRow]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.pickerRowContent}>
        <Text style={styles.pickerRowLabel}>{label}</Text>
        <Text style={styles.pickerRowValue}>{value}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={c.mutedForeground} />
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Section 1: Days */}
      {renderPickerRow(
        t('questionnaire_days_title'),
        availableDays.length > 0
          ? t('questionnaire_days_count', { count: availableDays.length })
          : t('questionnaire_days_subtitle'),
        openDayPicker,
      )}

      {/* Section 2: Activities */}
      {renderPickerRow(
        t('questionnaire_activities_title'),
        preferredActivities.length > 0
          ? t('questionnaire_activities_count', { count: preferredActivities.length })
          : t('questionnaire_activities_subtitle'),
        openActivityPicker,
      )}

      {/* Section 3: Duration */}
      {renderPickerRow(
        t('questionnaire_duration_title'),
        selectedDurationLabel
          ? t(selectedDurationLabel.i18n_key as any)
          : t('questionnaire_duration_subtitle'),
        openDurationPicker,
      )}

      {/* Section 4: Fitness Level */}
      {renderPickerRow(
        t('questionnaire_fitness_title'),
        selectedFitnessLabel
          ? t(selectedFitnessLabel.i18n_key as any)
          : t('questionnaire_fitness_subtitle'),
        openFitnessPicker,
      )}

      {/* Section 5: Weekly Frequency */}
      {renderPickerRow(
        t('questionnaire_frequency_title'),
        selectedFrequencyLabel
          ? t(selectedFrequencyLabel.i18n_key as any)
          : t('questionnaire_frequency_subtitle'),
        openFrequencyPicker,
      )}

      {/* Section 6: Preferred Time */}
      {renderPickerRow(
        t('questionnaire_time_title'),
        selectedTimeLabel
          ? t(selectedTimeLabel.i18n_key as any)
          : t('questionnaire_time_subtitle'),
        openTimePicker,
      )}

      {/* Section 7: Training Focus */}
      {renderPickerRow(
        t('questionnaire_focus_title'),
        selectedFocusLabel
          ? t(selectedFocusLabel.i18n_key as any)
          : t('questionnaire_focus_subtitle'),
        openFocusPicker,
      )}

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.8}
      >
        {saving ? (
          <ActivityIndicator size="small" color={c.primaryForeground} />
        ) : (
          <Text style={styles.saveButtonText}>{t('questionnaire_save')}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ============================================================
// Styles
// ============================================================

function createStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 24, paddingBottom: 48 },
    card: {
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    pickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    pickerRowContent: {
      flex: 1,
      gap: 4,
    },
    pickerRowLabel: {
      ...typography.bodyBold,
      fontSize: 15,
      color: c.foreground,
    },
    pickerRowValue: {
      ...typography.body,
      fontSize: 13,
      color: c.primary,
    },
    saveButton: {
      backgroundColor: c.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
      minHeight: 52,
    },
    saveButtonDisabled: { opacity: 0.6 },
    saveButtonText: {
      ...typography.bodyBold,
      fontSize: 16,
      color: c.primaryForeground,
    },
  });
}
