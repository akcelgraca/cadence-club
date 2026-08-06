import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { ACTIVITY_GOALS, GENDERS } from '../../lib/constants';
import { CountryCodePicker } from '../../components/ui/CountryCodePicker';
import QuestionnaireForm from '../../components/questionnaire/QuestionnaireForm';
import DateWheelPicker from '../../components/common/DateWheelPicker';
import type { ActivityGoal, QuestionnairePreferences } from '../../lib/types';
import { colors, typography } from '../../lib/theme';

const STEPS = ['welcome', 'goal', 'questionnaire', 'profile'] as const;
type Step = (typeof STEPS)[number];

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('welcome');
  const [goal, setGoal] = useState<ActivityGoal | null>(null);
  const [weeklyKmTarget, setWeeklyKmTarget] = useState('');
  // Questionnaire state
  const [questionnairePrefs, setQuestionnairePrefs] = useState<QuestionnairePreferences | null>(null);
  // Profile form state
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [fullName, setFullName] = useState('');
  const [countryCode, setCountryCode] = useState('+351');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<string>('');
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const { createProfile, profile } = useAuthStore();

  const handleFinish = async () => {
    if (!username.trim() || !fullName.trim()) {
      Alert.alert(t('onboarding_error_title'), t('onboarding_fill_fields'));
      return;
    }

    setLoading(true);
    try {
      await createProfile({
        username: username.trim(),
        full_name: fullName.trim(),
        goal: goal ?? undefined,
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        phone: phone.trim() ? `${countryCode}${phone.trim()}` : undefined,
        birth_date: birthDate.trim() || undefined,
        gender: gender || undefined,
        weight_kg: weightKg.trim() ? parseFloat(weightKg.trim()) : undefined,
        height_cm: heightCm.trim() ? parseFloat(heightCm.trim()) : undefined,
        available_days: questionnairePrefs?.available_days ?? undefined,
        preferred_activities: questionnairePrefs?.preferred_activities ?? undefined,
        session_duration: questionnairePrefs?.session_duration ?? undefined,
        fitness_level: questionnairePrefs?.fitness_level ?? undefined,
        weekly_frequency: questionnairePrefs?.weekly_frequency ?? undefined,
        preferred_time: questionnairePrefs?.preferred_time ?? undefined,
        training_focus: questionnairePrefs?.training_focus ?? undefined,
        has_completed_questionnaire: questionnairePrefs != null,
        weekly_km_target: weeklyKmTarget.trim() ? parseFloat(weeklyKmTarget.trim()) : undefined,
      });
      router.replace('/(tabs)/feed');
    } catch (err: any) {
      Alert.alert(t('onboarding_error_title'), err.message || t('error_generic'));
    } finally {
      setLoading(false);
    }
  };

  // Welcome step
  if (step === 'welcome') {
    return (
      <SafeAreaView style={styles.outerContainer} edges={['top', 'bottom']}>
        <View style={styles.innerContainer}>
          <Ionicons name="barbell" size={64} color={colors.primary} style={styles.emoji} />
          <Text style={[styles.title, { color: colors.primary }]}>{t('onboarding_welcome_title')}</Text>
          <Text style={styles.subtitle}>{t('onboarding_welcome_subtitle')}</Text>
          <TouchableOpacity style={styles.button} onPress={() => setStep('goal')}>
            <Text style={styles.buttonText}>{t('onboarding_continue')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Goal selection step
  if (step === 'goal') {
    return (
      <SafeAreaView style={styles.outerContainer} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.goalScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.title}>{t('onboarding_goal_title')}</Text>
            <Text style={styles.subtitle}>{t('onboarding_goal_subtitle')}</Text>

            <View style={styles.goalGrid}>
              {ACTIVITY_GOALS.map((g) => (
                <TouchableOpacity
                  key={g.key}
                  style={[styles.goalCard, goal === g.key && styles.goalCardSelected]}
                  onPress={() => setGoal(g.key)}
                >
                  <Ionicons name={(g.icon as any) ?? 'flag'} size={32} color={goal === g.key ? colors.primary : colors.foreground} />
                  <Text style={styles.goalLabel}>{t(g.i18n_key as any)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {(goal === 'run_weekly_km' || goal === 'cycle_weekly_km') && (
              <TextInput
                style={styles.input}
                placeholder={t('register_weekly_target')}
                placeholderTextColor={colors.mutedForeground}
                value={weeklyKmTarget}
                onChangeText={setWeeklyKmTarget}
                keyboardType="numeric"
              />
            )}

            <TouchableOpacity
              style={[styles.button, !goal && styles.buttonDisabled]}
              onPress={() => {
                if (!goal) {
                  Alert.alert(t('onboarding_error_title'), t('onboarding_select_goal'));
                  return;
                }
                setStep('questionnaire');
              }}
            >
              <Text style={styles.buttonText}>{t('onboarding_continue')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Questionnaire step
  if (step === 'questionnaire') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <QuestionnaireForm
          initialValues={questionnairePrefs}
          onSave={(prefs) => {
            setQuestionnairePrefs(prefs);
            setStep('profile');
          }}
        />
        <TouchableOpacity
          style={styles.skipLink}
          onPress={() => setStep('profile')}
        >
          <Text style={styles.skipText}>{t('questionnaire_skip')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Profile creation step
  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} style={{ flex: 1, backgroundColor: colors.background }}>
      <Text style={styles.title}>{t('onboarding_profile_title')}</Text>
      <Text style={styles.subtitle}>{t('onboarding_profile_subtitle')}</Text>

      <TextInput
        style={styles.input}
        placeholder={t('edit_username') + ' *'}
        placeholderTextColor={colors.mutedForeground}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder={t('edit_name') + ' *'}
        placeholderTextColor={colors.mutedForeground}
        value={fullName}
        onChangeText={setFullName}
      />

      <TextInput
        style={styles.input}
        placeholder={t('onboarding_first_name')}
        placeholderTextColor={colors.mutedForeground}
        value={firstName}
        onChangeText={setFirstName}
      />

      <TextInput
        style={styles.input}
        placeholder={t('onboarding_last_name')}
        placeholderTextColor={colors.mutedForeground}
        value={lastName}
        onChangeText={setLastName}
      />

      <Text style={styles.sectionLabel}>{t('onboarding_phone_label')}</Text>
      <CountryCodePicker
        value={countryCode}
        onSelect={setCountryCode}
        phoneNumber={phone}
        onPhoneChange={setPhone}
      />

      <Text style={styles.sectionLabel}>{t('onboarding_birth_date')}</Text>
      <TouchableOpacity
        style={styles.dateRow}
        onPress={() => setShowDatePicker(true)}
      >
        <Text style={[styles.dateRowText, !birthDate && styles.dateRowPlaceholder]}>
          {birthDate
            ? (() => {
                const [y, m, d] = birthDate.split('-');
                const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                return `${d} ${months[parseInt(m, 10) - 1] ?? m} ${y}`;
              })()
            : t('onboarding_birth_date')}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>
      <DateWheelPicker
        visible={showDatePicker}
        value={birthDate}
        onConfirm={(date) => { setBirthDate(date); setShowDatePicker(false); }}
        onCancel={() => setShowDatePicker(false)}
      />

      {/* Gender selector */}
      <Text style={styles.sectionLabel}>{t('onboarding_gender')}</Text>
      <View style={styles.chipRow}>
        {GENDERS.map((g) => (
          <TouchableOpacity
            key={g.key}
            style={[styles.chip, gender === g.key && styles.chipActive]}
            onPress={() => setGender(g.key)}
          >
            <Text style={[styles.chipText, gender === g.key && styles.chipTextActive]}>
              {t(g.i18n_key as any)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricField}>
          <TextInput
            style={styles.input}
            placeholder={t('onboarding_weight')}
            placeholderTextColor={colors.mutedForeground}
            value={weightKg}
            onChangeText={setWeightKg}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={styles.metricField}>
          <TextInput
            style={styles.input}
            placeholder={t('onboarding_height')}
            placeholderTextColor={colors.mutedForeground}
            value={heightCm}
            onChangeText={setHeightCm}
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleFinish}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? t('onboarding_creating_profile') : t('onboarding_start')}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  outerContainer: { flex: 1, backgroundColor: colors.background },
  innerContainer: { flex: 1, justifyContent: 'center', padding: 24 },
  container: { flex: 1, padding: 24, backgroundColor: colors.background },
  scrollContainer: { justifyContent: 'center', padding: 24, paddingTop: 60, paddingBottom: 40, minHeight: '100%' },
  emoji: { fontSize: 64, textAlign: 'center', marginBottom: 16 },
  title: { ...typography.headline, fontSize: 28, textAlign: 'center', marginBottom: 8, color: colors.foreground },
  subtitle: { ...typography.body, fontSize: 16, color: colors.mutedForeground, textAlign: 'center', marginBottom: 32 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { ...typography.bodyBold, color: colors.primaryForeground, fontSize: 16 },
  goalScrollContent: { padding: 24, paddingBottom: 40 },
  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  goalCard: {
    width: '47%',
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  goalCardSelected: { borderColor: colors.primary, backgroundColor: colors.inputBackground },
  goalEmoji: { fontSize: 32, marginBottom: 8 },
  goalLabel: { ...typography.bodyBold, fontSize: 14, textAlign: 'center', color: colors.foreground },
  input: {
    ...typography.body,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: colors.inputBackground,
    color: colors.foreground,
  },
  sectionLabel: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.mutedForeground,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.card,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '20',
  },
  chipText: {
    ...typography.body,
    fontSize: 13,
    color: colors.foreground,
  },
  chipTextActive: {
    color: colors.primary,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  metricField: {
    flex: 1,
  },
  skipLink: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  skipText: {
    ...typography.body,
    fontSize: 14,
    color: colors.mutedForeground,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    backgroundColor: colors.inputBackground,
    marginBottom: 12,
  },
  dateRowText: {
    ...typography.body,
    fontSize: 15,
    color: colors.foreground,
    flex: 1,
  },
  dateRowPlaceholder: {
    color: colors.mutedForeground,
  },
});
