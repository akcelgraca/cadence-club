import { useState, useMemo } from 'react';
import { formatDate } from '../../utils/dateHelpers';
import { useColors } from '../../hooks/useColors';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { ACTIVITY_GOALS, GENDERS } from '../../lib/constants';
import { useTranslation } from 'react-i18next';
import { CountryCodePicker } from '../../components/ui/CountryCodePicker';
import QuestionnaireForm from '../../components/questionnaire/QuestionnaireForm';
import DateWheelPicker from '../../components/common/DateWheelPicker';
import type { ActivityGoal, QuestionnairePreferences } from '../../lib/types';
import { typography, type Colors } from '../../lib/theme';
import { goBackOr } from '../../lib/navigation';

export default function RegisterScreen() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
  const [step, setStep] = useState<'form' | 'goal' | 'questionnaire'>('form');

  // Form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [countryCode, setCountryCode] = useState('+351');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [gender, setGender] = useState<string>('');
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [goal, setGoal] = useState<ActivityGoal | null>(null);
  const [weeklyKmTarget, setWeeklyKmTarget] = useState('');
  const [questionnairePrefs, setQuestionnairePrefs] = useState<QuestionnairePreferences | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const { signUp, createProfile, savePendingRegistration } = useAuthStore();

  const handleContinue = () => {
    // Validate required fields
    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !username.trim() ||
      !email.trim() ||
      !password.trim()
    ) {
      Alert.alert(t('register_required_fields'));
      return;
    }

    if (password.length < 6) {
      Alert.alert(t('register_password_short'));
      return;
    }

    setStep('goal');
  };

  const handleRegister = async (prefs: QuestionnairePreferences | null) => {
    setLoading(true);
    try {
      // 1. Sign up with Supabase
      await signUp(email.trim(), password);

      // 2. Check if email confirmation is required
      const { session } = useAuthStore.getState();
      if (!session) {
        // Save registration data so profile can be auto-created after email verification
        const fullName = [firstName.trim(), lastName.trim()].join(' ').trim();
        await savePendingRegistration({
          username: username.trim(),
          full_name: fullName,
          first_name: firstName.trim() || undefined,
          last_name: lastName.trim() || undefined,
          phone: phone.trim() ? `${countryCode}${phone.trim()}` : undefined,
          birth_date: birthDate.trim() || undefined,
          goal: goal ?? undefined,
          country: country.trim() || undefined,
          city: city.trim() || undefined,
          gender: gender || undefined,
          weight_kg: weightKg.trim() ? parseFloat(weightKg.trim()) : undefined,
          height_cm: heightCm.trim() ? parseFloat(heightCm.trim()) : undefined,
          available_days: prefs?.available_days ?? undefined,
          preferred_activities: prefs?.preferred_activities ?? undefined,
          session_duration: prefs?.session_duration ?? undefined,
          fitness_level: prefs?.fitness_level ?? undefined,
          weekly_frequency: prefs?.weekly_frequency ?? undefined,
          preferred_time: prefs?.preferred_time ?? undefined,
          training_focus: prefs?.training_focus ?? undefined,
          has_completed_questionnaire: prefs != null,
          weekly_km_target: weeklyKmTarget.trim() ? parseFloat(weeklyKmTarget.trim()) : undefined,
        });

        Alert.alert(
          t('register_check_email_title'),
          t('register_check_email_body')
        );
        router.replace('/(auth)/login');
        return;
      }

      // 3. Create profile immediately with all fields
      const fullName = [firstName.trim(), lastName.trim()].join(' ').trim();
      await createProfile({
        username: username.trim(),
        full_name: fullName,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim() ? `${countryCode}${phone.trim()}` : undefined,
        birth_date: birthDate.trim() || undefined,
        goal: goal ?? undefined,
        gender: gender || undefined,
        weight_kg: weightKg.trim() ? parseFloat(weightKg.trim()) : undefined,
        height_cm: heightCm.trim() ? parseFloat(heightCm.trim()) : undefined,
        available_days: prefs?.available_days ?? undefined,
        preferred_activities: prefs?.preferred_activities ?? undefined,
        session_duration: prefs?.session_duration ?? undefined,
        fitness_level: prefs?.fitness_level ?? undefined,
        weekly_frequency: prefs?.weekly_frequency ?? undefined,
        preferred_time: prefs?.preferred_time ?? undefined,
        training_focus: prefs?.training_focus ?? undefined,
        has_completed_questionnaire: prefs != null,
        weekly_km_target: weeklyKmTarget.trim() ? parseFloat(weeklyKmTarget.trim()) : undefined,
      });

      // 4. Update additional fields (country, city) after profile creation
      const { updateProfile } = useAuthStore.getState();
      if (country.trim() || city.trim()) {
        await updateProfile({
          country: country.trim() || undefined,
          city: city.trim() || undefined,
        });
      }

      router.replace('/(tabs)/feed');
    } catch (err: any) {
      Alert.alert(err.message || t('error_generic'));
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Registration form
  if (step === 'form') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => goBackOr('/(auth)')}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="arrow-back" size={24} color={c.foreground} />
            </TouchableOpacity>

            <Text style={styles.title}>{t('signup_title')}</Text>
            <Text style={styles.subtitle}>{t('register_subtitle')}</Text>

            {/* First Name & Last Name row */}
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder={t('register_first_name')}
                placeholderTextColor={c.mutedForeground}
                value={firstName}
                onChangeText={setFirstName}
              />
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder={t('register_last_name')}
                placeholderTextColor={c.mutedForeground}
                value={lastName}
                onChangeText={setLastName}
              />
            </View>

            <TextInput
              style={styles.input}
              placeholder={t('register_username')}
              placeholderTextColor={c.mutedForeground}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />

            <TextInput
              style={styles.input}
              placeholder={t('register_email')}
              placeholderTextColor={c.mutedForeground}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TextInput
              style={styles.input}
              placeholder={t('register_password')}
              placeholderTextColor={c.mutedForeground}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <Text style={styles.sectionLabel}>{t('onboarding_phone_label')}</Text>
            <CountryCodePicker
              value={countryCode}
              onSelect={setCountryCode}
              phoneNumber={phone}
              onPhoneChange={setPhone}
            />

            <Text style={styles.sectionLabel}>{t('edit_profile_birth_date')}</Text>
            <TouchableOpacity
              style={styles.dateRow}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={[styles.dateRowText, !birthDate && styles.dateRowPlaceholder]}>
                {birthDate
                  ? formatDate(birthDate)
                  : t('common_select')}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={c.mutedForeground} />
            </TouchableOpacity>
            <DateWheelPicker
              visible={showDatePicker}
              value={birthDate}
              onConfirm={(date) => { setBirthDate(date); setShowDatePicker(false); }}
              onCancel={() => setShowDatePicker(false)}
            />

            <TextInput
              style={styles.input}
              placeholder={t('register_country')}
              placeholderTextColor={c.mutedForeground}
              value={country}
              onChangeText={setCountry}
            />

            <TextInput
              style={styles.input}
              placeholder={t('edit_profile_city')}
              placeholderTextColor={c.mutedForeground}
              value={city}
              onChangeText={setCity}
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
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder={t('register_weight')}
                placeholderTextColor={c.mutedForeground}
                value={weightKg}
                onChangeText={setWeightKg}
                keyboardType="decimal-pad"
              />
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder={t('register_height')}
                placeholderTextColor={c.mutedForeground}
                value={heightCm}
                onChangeText={setHeightCm}
                keyboardType="decimal-pad"
              />
            </View>

            <TouchableOpacity
              style={styles.button}
              onPress={handleContinue}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>{t('onboarding_continue')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => goBackOr('/(auth)')}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.switchText}>
                {t('register_has_account')}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Step 2: Goal selection
  if (step === 'goal') {
    return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setStep('form')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={c.foreground} />
        </TouchableOpacity>

        <Text style={styles.title}>{t('onboarding_goal_title')}</Text>
        <Text style={styles.subtitle}>{t('register_goal_subtitle')}</Text>

        <View style={styles.goalGrid}>
          {ACTIVITY_GOALS.map((g) => (
            <TouchableOpacity
              key={g.key}
              style={[styles.goalCard, goal === g.key && styles.goalCardSelected]}
              onPress={() => setGoal(g.key)}
            >
              <Ionicons
                name={(g.icon as any) ?? 'flag'}
                size={32}
                color={goal === g.key ? c.primary : c.foreground}
              />
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
          style={styles.skipLink}
          onPress={() => setGoal(null)}
        >
          <Text style={styles.skipText}>{t('register_skip_goal')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => setStep('questionnaire')}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>{t('onboarding_continue')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
  }

  // Step 3: Questionnaire
  return (
    <SafeAreaView style={styles.safeArea}>
      <QuestionnaireForm
        initialValues={questionnairePrefs}
        onSave={(prefs) => {
          setQuestionnairePrefs(prefs);
          handleRegister(prefs);
        }}
        saving={loading}
      />
      <TouchableOpacity
        style={styles.skipLink}
        onPress={() => handleRegister(null)}
      >
        <Text style={styles.skipText}>{t('questionnaire_skip')}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: c.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  backButton: {
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  title: {
    ...typography.headline,
    fontSize: 28,
    color: c.foreground,
    marginBottom: 8,
  },
  subtitle: {
    ...typography.body,
    fontSize: 15,
    color: c.mutedForeground,
    marginBottom: 24,
    lineHeight: 21,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    ...typography.body,
    borderRadius: 12,
    padding: 15,
    fontSize: 15,
    marginBottom: 12,
    backgroundColor: c.inputBackground,
    color: c.foreground,
  },
  halfInput: {
    flex: 1,
  },
  button: {
    backgroundColor: c.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    ...typography.bodyBold,
    color: c.primaryForeground,
    fontSize: 16,
  },
  switchText: {
    ...typography.bodyMedium,
    color: c.primary,
    textAlign: 'center',
    marginTop: 18,
    fontSize: 14,
  },
  goalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  goalCard: {
    width: '47%',
    borderWidth: 2,
    borderColor: c.border,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    backgroundColor: c.card,
  },
  goalCardSelected: {
    borderColor: c.primary,
    backgroundColor: c.inputBackground,
  },
  goalLabel: {
    ...typography.bodyBold,
    fontSize: 14,
    textAlign: 'center',
    color: c.foreground,
    marginTop: 8,
  },
  skipLink: {
    alignItems: 'center',
    marginBottom: 8,
  },
  skipText: {
    ...typography.body,
    fontSize: 14,
    color: c.mutedForeground,
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
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    padding: 15,
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
