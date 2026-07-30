import { useState } from 'react';
import { View, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useColors } from '../../hooks/useColors';
import { useAppTranslation } from '../../hooks/useAppTranslation';
import QuestionnaireForm from '../../components/questionnaire/QuestionnaireForm';
import type { QuestionnairePreferences } from '../../lib/types';

export default function QuestionnaireScreen() {
  const c = useColors();
  const { t } = useAppTranslation();
  const { profile, updateProfile } = useAuthStore();
  const [saving, setSaving] = useState(false);

  const initialValues = profile
    ? {
        available_days: profile.available_days ?? undefined,
        preferred_activities: profile.preferred_activities ?? undefined,
        session_duration: profile.session_duration ?? undefined,
        fitness_level: profile.fitness_level ?? undefined,
        weekly_frequency: profile.weekly_frequency ?? undefined,
        preferred_time: profile.preferred_time ?? undefined,
        training_focus: profile.training_focus ?? undefined,
      }
    : null;

  const handleSave = async (prefs: QuestionnairePreferences) => {
    setSaving(true);
    try {
      await updateProfile({
        available_days: prefs.available_days,
        preferred_activities: prefs.preferred_activities,
        session_duration: prefs.session_duration,
        fitness_level: prefs.fitness_level,
        weekly_frequency: prefs.weekly_frequency ?? null,
        preferred_time: prefs.preferred_time ?? null,
        training_focus: prefs.training_focus ?? null,
        has_completed_questionnaire: true,
      });
      Alert.alert('', t('questionnaire_saved'));
      router.back();
    } catch {
      Alert.alert(t('onboarding_error_title'), t('error_generic'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <QuestionnaireForm
        initialValues={initialValues}
        onSave={handleSave}
        saving={saving}
      />
    </View>
  );
}
