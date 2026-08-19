import { useState, useCallback, useMemo, useRef, useEffect, type ReactNode } from 'react';
import { goBackOr } from '../../lib/navigation';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Switch,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router, Stack, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { uploadAvatar } from '../../services/auth';
import { Avatar } from '../../components/common/Avatar';
import DateWheelPicker from '../../components/common/DateWheelPicker';
import { ACTIVITY_GOALS, MAIN_SPORTS, GENDERS, COUNTRIES, getCountryKey, MONTH_SHORT_KEYS, ACTIVITY_CATEGORIES } from '../../lib/constants';
import { typography } from '../../lib/theme';
import { useColors } from '../../hooks/useColors';
import { setPickerConfig } from './settings/picker';
import type { ActivityGoal, MainSport, Gender } from '../../lib/types';

const BIO_MAX = 160;

/** "1992-03-14" → "14 mar 1992". */
function formatBirthDate(iso: string, t: (k: string) => string): string {
  const [y, m, d] = iso.split('-');
  const key = MONTH_SHORT_KEYS[parseInt(m, 10) - 1];
  return `${d} ${key ? t(key) : m} ${y}`;
}

export default function EditProfileScreen() {
  const { profile, updateProfile } = useAuthStore();
  const { t } = useTranslation();
  const c = useColors();
  const navigation = useNavigation();
  const styles = useMemo(() => createStyles(c), [c]);

  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [lastName, setLastName] = useState(profile?.last_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [mainSport, setMainSport] = useState<MainSport | null>(profile?.main_sport ?? null);
  const [city, setCity] = useState(profile?.city ?? '');
  const [country, setCountry] = useState(profile?.country ?? '');
  const [birthDate, setBirthDate] = useState(profile?.birth_date ?? '');
  const [gender, setGender] = useState<Gender | null>(profile?.gender ?? null);
  const [weightKg, setWeightKg] = useState(profile?.weight_kg ? String(profile.weight_kg) : '');
  const [goal, setGoal] = useState<ActivityGoal | null>(profile?.goal ?? null);
  const [weeklyKmTarget, setWeeklyKmTarget] = useState(profile?.weekly_km_target ? String(profile.weekly_km_target) : '');
  const [isPublic, setIsPublic] = useState(profile?.is_public ?? true);
  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [triedSave, setTriedSave] = useState(false);

  /** Guardar navega para trás — o aviso de alterações por gravar não se aplica. */
  const leavingAfterSave = useRef(false);

  const isDirty =
    firstName !== (profile?.first_name ?? '') ||
    lastName !== (profile?.last_name ?? '') ||
    username !== (profile?.username ?? '') ||
    bio !== (profile?.bio ?? '') ||
    mainSport !== (profile?.main_sport ?? null) ||
    city !== (profile?.city ?? '') ||
    country !== (profile?.country ?? '') ||
    birthDate !== (profile?.birth_date ?? '') ||
    gender !== (profile?.gender ?? null) ||
    weightKg !== (profile?.weight_kg ? String(profile.weight_kg) : '') ||
    goal !== (profile?.goal ?? null) ||
    weeklyKmTarget !== (profile?.weekly_km_target ? String(profile.weekly_km_target) : '') ||
    isPublic !== (profile?.is_public ?? true);

  const usernameError = triedSave && !username.trim() ? t('edit_profile_username_required') : null;

  // Sair com alterações por gravar perdia tudo em silêncio.
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (!isDirty || leavingAfterSave.current) return;
      e.preventDefault();
      Alert.alert(
        t('edit_profile_unsaved_title'),
        t('edit_profile_unsaved_body'),
        [
          { text: t('edit_profile_keep_editing'), style: 'cancel' },
          { text: t('edit_profile_discard'), style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
        ],
      );
    });
    return unsubscribe;
  }, [navigation, isDirty]);

  const openPicker = useCallback(
    (title: string, options: { key: string; label: string; icon?: string }[], current: string | null, onChange: (key: string) => void, sections?: { title: string; options: { key: string; label: string; icon?: string }[] }[]) => {
      setPickerConfig({ title, options: sections ? undefined : options, sections, selectedKey: current ?? '', onSelect: onChange });
      router.push('/profile/settings/picker');
    },
    [],
  );

  const mainSportSections = useMemo(() => {
    const sections: { title: string; options: { key: string; label: string; icon: string }[] }[] = ACTIVITY_CATEGORIES.map((cat) => ({
      title: t(cat.i18n_key as any),
      options: cat.activities.map((a) => ({
        key: a.key,
        label: t(a.i18n_key as any),
        icon: a.icon,
      })),
    }));
    // Add multi-sport option to the last category
    sections[sections.length - 1].options.push({
      key: 'multi',
      label: t('activity_multi'),
      icon: 'ribbon',
    });
    return sections;
  }, [t]);

  /** Nome mostrado no cabeçalho — acompanha o que está a ser escrito. */
  const liveName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');

  // A lista ordena-se pelo texto já traduzido: por ordem portuguesa, quem lê
  // inglês via "Germany" entre "Angola" e "Argentina".
  const countryOptions = useMemo(
    () => COUNTRIES
      .map((p) => ({ key: p.value, label: t(p.i18n_key as any) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [t],
  );

  const countryKey = getCountryKey(country);
  const countryLabel = countryKey ? t(countryKey as any) : country;

  const handleAvatarPress = () => {
    if (!profile) return;

    Alert.alert(t('edit_profile_photo_title'), undefined, [
      { text: t('edit_profile_photo_camera'), onPress: () => pickAndUpload('camera') },
      { text: t('edit_profile_photo_gallery'), onPress: () => pickAndUpload('gallery') },
      { text: t('cancel'), style: 'cancel' },
    ]);
  };

  const pickAndUpload = async (source: 'camera' | 'gallery') => {
    if (!profile) return;

    try {
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(t('edit_profile_permission_title'), t('edit_profile_permission_camera'));
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(t('edit_profile_permission_title'), t('edit_profile_permission_gallery'));
          return;
        }
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      setAvatarLoading(true);

      const publicUrl = await uploadAvatar(profile.id, result.assets[0].uri, result.assets[0].mimeType);
      setAvatarUrl(publicUrl);
      await updateProfile({ avatar_url: publicUrl } as any);
    } catch (err: any) {
      Alert.alert(t('edit_profile_photo_error'), err?.message ?? undefined);
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleSave = async () => {
    setTriedSave(true);

    if (!username.trim()) {
      Alert.alert(t('edit_profile_username_missing_title'), t('edit_profile_username_missing_body'));
      return;
    }

    setLoading(true);
    try {
      const updates: Record<string, unknown> = {
        username: username.trim(),
        bio: bio.trim(),
        goal,
        is_public: isPublic,
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        city: city.trim() || null,
        country: country.trim() || null,
        birth_date: birthDate.trim() || null,
        gender: gender,
        weight_kg: weightKg ? parseFloat(weightKg) : null,
        main_sport: mainSport,
        weekly_km_target: weeklyKmTarget ? parseFloat(weeklyKmTarget) : null,
      };

      // full_name is auto-computed by authStore.updateProfile
      await updateProfile(updates as any);
      leavingAfterSave.current = true;
      goBackOr('/(tabs)/profile');
    } catch (err: any) {
      Alert.alert(t('edit_profile_save_error_title'), err.message || t('edit_profile_save_error_body'));
    } finally {
      setLoading(false);
    }
  };

  const canSave = isDirty && !loading;
  const showKmTarget = goal === 'run_weekly_km' || goal === 'cycle_weekly_km';

  return (
    <>
      <Stack.Screen
        options={{
          title: t('edit_profile_title'),
          headerRight: () =>
            loading ? (
              <ActivityIndicator size="small" color={c.primary} />
            ) : (
              <TouchableOpacity
                onPress={handleSave}
                disabled={!canSave}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={[styles.headerSave, !canSave && styles.headerSaveIdle]}>{t('save')}</Text>
              </TouchableOpacity>
            ),
        }}
      />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Cabeçalho de identidade — mostra o que os outros vão ver, a
              acompanhar o que está a ser escrito nos campos abaixo. */}
          <View style={styles.identity}>
            <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.8}>
              <View>
                <Avatar
                  uri={avatarUrl}
                  name={liveName || username}
                  size={88}
                  radius={20}
                  borderWidth={2}
                  borderColor={c.primary}
                />
                {avatarLoading && (
                  <View style={styles.avatarOverlay}>
                    <ActivityIndicator color={c.primaryForeground} />
                  </View>
                )}
                <View style={styles.cameraBadge}>
                  <Ionicons name="camera" size={13} color={c.primaryForeground} />
                </View>
              </View>
            </TouchableOpacity>

            <View style={styles.identityText}>
              <Text style={styles.identityName} numberOfLines={2}>
                {liveName || t('edit_profile_no_name')}
              </Text>
              <Text style={styles.identityHandle} numberOfLines={1}>
                {username ? `@${username}` : t('edit_profile_no_username')}
              </Text>
            </View>
          </View>

          {/* --- Perfil ------------------------------------------------ */}
          <SectionTitle title={t('edit_profile_section_profile')} styles={styles} />
          <Card styles={styles}>
            <TextField label={t('edit_profile_first_name')} styles={styles}>
              <TextInput
                style={styles.fieldInput}
                value={firstName}
                onChangeText={setFirstName}
                placeholder={t('edit_profile_first_name_placeholder')}
                placeholderTextColor={c.mutedForeground}
                returnKeyType="next"
              />
            </TextField>

            <Divider styles={styles} />

            <TextField label={t('edit_profile_last_name')} styles={styles}>
              <TextInput
                style={styles.fieldInput}
                value={lastName}
                onChangeText={setLastName}
                placeholder={t('edit_profile_last_name_placeholder')}
                placeholderTextColor={c.mutedForeground}
                returnKeyType="next"
              />
            </TextField>

            <Divider styles={styles} />

            <TextField label={t('edit_profile_username')} error={usernameError} styles={styles}>
              <View style={styles.handleRow}>
                <Text style={styles.handlePrefix}>@</Text>
                <TextInput
                  style={[styles.fieldInput, styles.handleInput]}
                  value={username}
                  onChangeText={(v) => setUsername(v.replace(/\s/g, '').toLowerCase())}
                  placeholder={t('edit_profile_username_placeholder')}
                  placeholderTextColor={c.mutedForeground}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </TextField>

            <Divider styles={styles} />

            <TextField
              label={t('edit_profile_bio')}
              accessory={`${bio.length}/${BIO_MAX}`}
              styles={styles}
            >
              <TextInput
                style={[styles.fieldInput, styles.textArea]}
                value={bio}
                onChangeText={setBio}
                multiline
                maxLength={BIO_MAX}
                placeholder={t('edit_profile_bio_placeholder')}
                placeholderTextColor={c.mutedForeground}
              />
            </TextField>
          </Card>

          {/* --- Sobre ti ---------------------------------------------- */}
          <SectionTitle title={t('edit_profile_section_about')} styles={styles} />
          <Card styles={styles}>
            <InlineField label={t('edit_profile_city')} styles={styles}>
              <TextInput
                style={styles.inlineInput}
                value={city}
                onChangeText={setCity}
                placeholder={t('edit_profile_city_placeholder')}
                placeholderTextColor={c.mutedForeground}
                textAlign="right"
              />
            </InlineField>

            <Divider styles={styles} />

            <SelectRow
              label={t('edit_profile_country')}
              value={countryLabel}
              onPress={() => openPicker(t('edit_profile_country'), countryOptions, country, setCountry)}
              placeholder={t('edit_profile_choose')}
              styles={styles}
              c={c}
            />

            <Divider styles={styles} />

            <SelectRow
              label={t('edit_profile_birth_date')}
              value={birthDate ? formatBirthDate(birthDate, t) : ''}
              onPress={() => setShowDatePicker(true)}
              placeholder={t('edit_profile_choose')}
              styles={styles}
              c={c}
            />

            <Divider styles={styles} />

            <SelectRow
              label={t('edit_profile_gender')}
              value={gender ? t(GENDERS.find((g) => g.key === gender)?.i18n_key as any ?? '') : ''}
              onPress={() =>
                openPicker(
                  t('edit_profile_gender'),
                  GENDERS.map((g) => ({ key: g.key, label: t(g.i18n_key as any) })),
                  gender,
                  (val) => setGender(val as Gender),
                )
              }
              placeholder={t('edit_profile_choose')}
              styles={styles}
              c={c}
            />
          </Card>

          {/* --- Treino ------------------------------------------------ */}
          <SectionTitle title={t('edit_profile_section_training')} styles={styles} />
          <Card styles={styles}>
            <SelectRow
              label={t('edit_profile_main_sport')}
              value={mainSport ? t(MAIN_SPORTS.find((s) => s.key === mainSport)?.i18n_key as any ?? '') : ''}
              onPress={() =>
                openPicker(t('edit_profile_main_sport'), [], mainSport, (val) => setMainSport(val as MainSport), mainSportSections)
              }
              placeholder={t('edit_profile_choose')}
              styles={styles}
              c={c}
            />

            <Divider styles={styles} />

            <SelectRow
              label={t('edit_profile_goal')}
              value={goal ? t(ACTIVITY_GOALS.find((g) => g.key === goal)?.i18n_key as any ?? '') : ''}
              hint={t('edit_profile_goal_hint')}
              onPress={() =>
                openPicker(
                  t('edit_profile_goal'),
                  ACTIVITY_GOALS.map((g) => ({ key: g.key, label: t(g.i18n_key as any), icon: g.icon })),
                  goal,
                  (val) => setGoal(val as ActivityGoal),
                )
              }
              placeholder={t('edit_profile_choose')}
              styles={styles}
              c={c}
            />

            {showKmTarget && (
              <>
                <Divider styles={styles} />
                <InlineField label={t('edit_profile_weekly_target')} styles={styles}>
                  <TextInput
                    style={styles.inlineInput}
                    value={weeklyKmTarget}
                    onChangeText={setWeeklyKmTarget}
                    keyboardType="numeric"
                    placeholder="40"
                    placeholderTextColor={c.mutedForeground}
                    textAlign="right"
                  />
                  <Text style={styles.unit}>km</Text>
                </InlineField>
              </>
            )}

            <Divider styles={styles} />

            {/* O peso vive aqui, e não em "Sobre ti", porque é o que estima
                as calorias de cada atividade — não é um dado demográfico. */}
            <InlineField label={t('edit_profile_weight')} hint={t('edit_profile_weight_hint')} styles={styles}>
              <TextInput
                style={styles.inlineInput}
                value={weightKg}
                onChangeText={setWeightKg}
                keyboardType="numeric"
                placeholder="70"
                placeholderTextColor={c.mutedForeground}
                textAlign="right"
              />
              <Text style={styles.unit}>kg</Text>
            </InlineField>
          </Card>

          {/* --- Privacidade ------------------------------------------- */}
          <SectionTitle title={t('edit_profile_section_privacy')} styles={styles} />
          <Card styles={styles}>
            <View style={styles.row}>
              <View style={styles.rowLabelBlock}>
                <Text style={styles.rowLabel}>{t('edit_profile_public')}</Text>
                <Text style={styles.rowHint}>
                  {isPublic
                    ? t('edit_profile_public_on')
                    : t('edit_profile_public_off')}
                </Text>
              </View>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ false: c.border, true: c.primary }}
              />
            </View>
          </Card>

          <TouchableOpacity
            style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!canSave}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={c.primaryForeground} />
              : (
                <Text style={[styles.saveButtonText, !canSave && styles.saveButtonTextDisabled]}>
                  {isDirty ? t('edit_profile_save_changes') : t('edit_profile_all_saved')}
                </Text>
              )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <DateWheelPicker
        visible={showDatePicker}
        value={birthDate}
        onConfirm={(date) => { setBirthDate(date); setShowDatePicker(false); }}
        onCancel={() => setShowDatePicker(false)}
      />
    </>
  );
}

// ============================================================
// Blocos do formulário
//
// Os campos de texto livre ficam empilhados (etiqueta em cima, campo em
// baixo, à largura toda) e os valores curtos ficam na mesma linha da
// etiqueta. A diferença é honesta: uns escrevem-se, outros escolhem-se.
// ============================================================

type S = ReturnType<typeof createStyles>;

function SectionTitle({ title, styles }: { title: string; styles: S }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function Card({ children, styles }: { children: ReactNode; styles: S }) {
  return <View style={styles.card}>{children}</View>;
}

function Divider({ styles }: { styles: S }) {
  return <View style={styles.divider} />;
}

/** Campo de texto livre: etiqueta em cima, campo à largura toda por baixo. */
function TextField({
  label, accessory, error, children, styles,
}: {
  label: string;
  accessory?: string;
  error?: string | null;
  children: ReactNode;
  styles: S;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldHeader}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {accessory ? <Text style={styles.fieldAccessory}>{accessory}</Text> : null}
      </View>
      {children}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

/** Valor curto: etiqueta à esquerda, campo à direita, na mesma linha. */
function InlineField({
  label, hint, children, styles,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  styles: S;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLabelBlock}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      <View style={styles.rowControl}>{children}</View>
    </View>
  );
}

function SelectRow({
  label, value, hint, placeholder, onPress, styles, c,
}: {
  label: string;
  value: string;
  hint?: string;
  placeholder: string;
  onPress: () => void;
  styles: S;
  c: ReturnType<typeof useColors>;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.6}>
      <View style={styles.rowLabelBlock}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      <View style={styles.rowControl}>
        <Text style={[styles.rowValue, !value && styles.rowValueEmpty]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={c.mutedForeground} />
      </View>
    </TouchableOpacity>
  );
}

function createStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 20, paddingBottom: 48 },

    headerSave: { ...typography.bodyBold, fontSize: 16, color: c.primary },
    headerSaveIdle: { color: c.mutedForeground, opacity: 0.5 },

    // --- Cabeçalho de identidade ---
    identity: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 8, marginBottom: 8 },
    identityText: { flex: 1 },
    identityName: {
      ...typography.headline,
      fontSize: 26,
      lineHeight: 30,
      color: c.foreground,
      letterSpacing: 0.5,
    },
    identityHandle: { ...typography.mono, fontSize: 13, color: c.mutedForeground, marginTop: 4 },
    cameraBadge: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: c.background,
    },
    avatarOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 20,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
    },

    // --- Secções ---
    sectionTitle: {
      ...typography.headline,
      fontSize: 18,
      color: c.primary,
      marginTop: 24,
      marginBottom: 12,
      letterSpacing: 1,
    },
    card: { backgroundColor: c.card, borderRadius: 12, paddingHorizontal: 16 },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border },

    // --- Campo empilhado ---
    field: { paddingVertical: 12 },
    fieldHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    fieldLabel: { ...typography.bodyMedium, fontSize: 13, color: c.mutedForeground },
    fieldAccessory: { ...typography.mono, fontSize: 12, color: c.mutedForeground },
    fieldInput: { ...typography.body, fontSize: 16, color: c.foreground, paddingTop: 6, paddingBottom: 2 },
    fieldError: { ...typography.body, fontSize: 12, color: c.destructive, marginTop: 4 },
    textArea: { minHeight: 62, textAlignVertical: 'top', lineHeight: 21 },
    handleRow: { flexDirection: 'row', alignItems: 'baseline' },
    handlePrefix: { ...typography.body, fontSize: 16, color: c.mutedForeground, paddingTop: 6 },
    handleInput: { flex: 1 },

    // --- Linha com valor à direita ---
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, minHeight: 52 },
    rowLabelBlock: { flex: 1 },
    rowLabel: { ...typography.body, fontSize: 16, color: c.foreground },
    rowHint: { ...typography.body, fontSize: 12, color: c.mutedForeground, marginTop: 2, lineHeight: 16 },
    rowControl: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
    rowValue: { ...typography.body, fontSize: 16, color: c.foreground, flexShrink: 1 },
    rowValueEmpty: { color: c.mutedForeground },
    inlineInput: { ...typography.body, fontSize: 16, color: c.foreground, minWidth: 64, paddingVertical: 0 },
    unit: { ...typography.body, fontSize: 15, color: c.mutedForeground },

    // --- Guardar ---
    saveButton: {
      backgroundColor: c.primary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 54,
      marginTop: 32,
    },
    saveButtonDisabled: { backgroundColor: c.inputBackground },
    saveButtonText: { ...typography.bodyBold, color: c.primaryForeground, fontSize: 16 },
    saveButtonTextDisabled: { color: c.mutedForeground },
  });
}
