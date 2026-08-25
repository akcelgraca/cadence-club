import { useState, useMemo } from 'react';
import { localeTag } from '../../utils/dateHelpers';
import { useColors } from '../../hooks/useColors';
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
import { typography, type Colors } from '../../lib/theme';

const STEPS = ['welcome', 'goal', 'questionnaire', 'profile'] as const;
type Step = (typeof STEPS)[number];

export default function OnboardingScreen() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
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
    if (!username.trim() || !firstName.trim() || !lastName.trim()) {
      Alert.alert(t('onboarding_error_title'), t('onboarding_fill_fields'));
      return;
    }

    setLoading(true);
    try {
      await createProfile({
        username: username.trim(),
        // Derivado, nunca pedido: pedi-lo à parte era a mesma informação duas
        // vezes, e abria a porta a um perfil onde o nome completo não bate
        // certo com o nome e o apelido. É o que o `register.tsx` e o
        // `profile/edit.tsx` já faziam — este ecrã é que tinha ficado para trás.
        full_name: [firstName.trim(), lastName.trim()].join(' ').trim(),
        goal: goal ?? undefined,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
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
          <Ionicons name="barbell" size={64} color={c.primary} style={styles.emoji} />
          <Text style={[styles.title, { color: c.primary }]}>{t('onboarding_welcome_title')}</Text>
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
                  <Ionicons name={(g.icon as any) ?? 'flag'} size={32} color={goal === g.key ? c.primary : c.foreground} />
                  <Text style={styles.goalLabel}>{t(g.i18n_key as any)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {(goal === 'run_weekly_km' || goal === 'cycle_weekly_km') && (
              <TextInput
                style={styles.input}
                placeholder={t('register_weekly_target')}
                placeholderTextColor={c.mutedForeground}
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
    <ScrollView contentContainerStyle={styles.scrollContainer} style={{ flex: 1, backgroundColor: c.background }}>
      <Text style={styles.title}>{t('onboarding_profile_title')}</Text>
      <Text style={styles.subtitle}>{t('onboarding_profile_subtitle')}</Text>

      <TextInput
        style={styles.input}
        placeholder={t('edit_username') + ' *'}
        placeholderTextColor={c.mutedForeground}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder={t('onboarding_first_name') + ' *'}
        placeholderTextColor={c.mutedForeground}
        value={firstName}
        onChangeText={setFirstName}
      />

      <TextInput
        style={styles.input}
        placeholder={t('onboarding_last_name') + ' *'}
        placeholderTextColor={c.mutedForeground}
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
            ? new Date(birthDate).toLocaleDateString(localeTag(), {
                day: 'numeric', month: 'short', year: 'numeric',
              })
            : t('onboarding_birth_date')}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={c.mutedForeground} />
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
            placeholderTextColor={c.mutedForeground}
            value={weightKg}
            onChangeText={setWeightKg}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={styles.metricField}>
          <TextInput
            style={styles.input}
            placeholder={t('onboarding_height')}
            placeholderTextColor={c.mutedForeground}
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

const makeStyles = (c: Colors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: c.background },
  outerContainer: { flex: 1, backgroundColor: c.background },
  innerContainer: { flex: 1, justifyContent: 'center', padding: 24 },
  container: { flex: 1, padding: 24, backgroundColor: c.background },
  scrollContainer: { justifyContent: 'center', padding: 24, paddingTop: 60, paddingBottom: 40, minHeight: '100%' },
  emoji: { fontSize: 64, textAlign: 'center', marginBottom: 16 },
  title: { ...typography.headline, fontSize: 28, textAlign: 'center', marginBottom: 8, color: c.foreground },
  subtitle: { ...typography.body, fontSize: 16, color: c.mutedForeground, textAlign: 'center', marginBottom: 32 },
  button: {
    backgroundColor: c.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { ...typography.bodyBold, color: c.primaryForeground, fontSize: 16 },
  goalScrollContent: { padding: 24, paddingBottom: 40 },
  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  goalCard: {
    width: '47%',
    borderWidth: 2,
    borderColor: c.border,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    backgroundColor: c.card,
  },
  goalCardSelected: { borderColor: c.primary, backgroundColor: c.inputBackground },
  goalEmoji: { fontSize: 32, marginBottom: 8 },
  goalLabel: { ...typography.bodyBold, fontSize: 14, textAlign: 'center', color: c.foreground },
  input: {
    ...typography.body,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: c.inputBackground,
    color: c.foreground,
  },
  sectionLabel: {
    ...typography.bodyBold,
    fontSize: 13,
    color: c.mutedForeground,
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
    backgroundColor: c.card,
  },
  chipActive: {
    borderColor: c.primary,
    backgroundColor: c.primary + '20',
  },
  chipText: {
    ...typography.body,
    fontSize: 13,
    color: c.foreground,
  },
  chipTextActive: {
    color: c.primary,
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
    color: c.mutedForeground,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    backgroundColor: c.inputBackground,
    marginBottom: 12,
  },
  dateRowText: {
    ...typography.body,
    fontSize: 15,
    color: c.foreground,
    flex: 1,
  },
  dateRowPlaceholder: {
    color: c.mutedForeground,
  },
});
