import { useState, useCallback, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Switch, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { uploadAvatar } from '../../services/auth';
import { Avatar } from '../../components/common/Avatar';
import DateWheelPicker from '../../components/common/DateWheelPicker';
import { ACTIVITY_GOALS, MAIN_SPORTS, GENDERS, COUNTRIES, ACTIVITY_CATEGORIES } from '../../lib/constants';
import { colors, typography } from '../../lib/theme';
import { setPickerConfig } from './settings/picker';
import type { ActivityGoal, MainSport, Gender } from '../../lib/types';

export default function EditProfileScreen() {
  const { profile, updateProfile } = useAuthStore();
  const { t } = useTranslation();

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

  const displayName = (() => {
    const parts = profile?.full_name?.split(' ') || [];
    if (parts.length >= 2) return `${parts[0]} ${parts[parts.length - 1]}`;
    return parts[0] || '';
  })();

  const handleAvatarPress = () => {
    if (!profile) return;

    Alert.alert('Foto de perfil', undefined, [
      {
        text: 'Camara',
        onPress: () => pickAndUpload('camera'),
      },
      {
        text: 'Galeria',
        onPress: () => pickAndUpload('gallery'),
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const pickAndUpload = async (source: 'camera' | 'gallery') => {
    if (!profile) return;

    try {
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Sem permissao', 'E necessaria permissao para aceder a camara.');
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Sem permissao', 'E necessaria permissao para aceder a galeria.');
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
      Alert.alert('Erro', err?.message || 'Erro ao enviar foto de perfil.');
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleSave = async () => {
    if (!username.trim()) {
      Alert.alert('Erro', 'O nome de utilizador é obrigatório.');
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
      router.back();
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Algo correu mal.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.8}>
          <View>
            <Avatar
              uri={avatarUrl}
              name={displayName}
              size={80}
              radius={16}
              borderWidth={2}
              borderColor={colors.primary}
            />
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={12} color={colors.primaryForeground} />
            </View>
          </View>
        </TouchableOpacity>
        {avatarLoading && (
          <ActivityIndicator style={styles.avatarLoader} color={colors.primary} />
        )}
        <Text style={styles.avatarHint}>Toca na foto para alterar</Text>
      </View>

      <Text style={styles.label}>Nome</Text>
      <TextInput
        style={styles.input}
        value={firstName}
        onChangeText={setFirstName}
        placeholder="Primeiro nome"
        placeholderTextColor={colors.mutedForeground}
      />

      <Text style={styles.label}>Apelido</Text>
      <TextInput
        style={styles.input}
        value={lastName}
        onChangeText={setLastName}
        placeholder="Último nome"
        placeholderTextColor={colors.mutedForeground}
      />

      <Text style={styles.label}>Nome de utilizador</Text>
      <TextInput
        style={styles.input}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />

      <Text style={styles.label}>Biografia</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={bio}
        onChangeText={setBio}
        multiline
        numberOfLines={3}
        placeholder="Conta um pouco sobre ti..."
        placeholderTextColor={colors.mutedForeground}
      />

      <Text style={styles.label}>Atividade principal</Text>
      <TouchableOpacity
        style={styles.selectRow}
        onPress={() =>
          openPicker(
            'Atividade principal',
            [],
            mainSport,
            (val) => setMainSport(val as MainSport),
            mainSportSections,
          )
        }
      >
        <Text style={[styles.selectRowText, !mainSport && styles.selectRowPlaceholder]}>
          {mainSport
            ? t(MAIN_SPORTS.find((s) => s.key === mainSport)?.i18n_key as any ?? '')
            : 'Selecionar...'}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>

      <Text style={styles.label}>Cidade</Text>
      <TextInput
        style={styles.input}
        value={city}
        onChangeText={setCity}
        placeholder="Ex: Lisboa"
        placeholderTextColor={colors.mutedForeground}
      />

      <Text style={styles.label}>Pais</Text>
      <TouchableOpacity
        style={styles.selectRow}
        onPress={() =>
          openPicker(
            'Pais',
            COUNTRIES.map((c) => ({ key: c, label: c })),
            country,
            (val) => setCountry(val),
          )
        }
      >
        <Text style={[styles.selectRowText, !country && styles.selectRowPlaceholder]}>
          {country || 'Selecionar...'}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>

      <Text style={styles.label}>Data de nascimento</Text>
      <TouchableOpacity
        style={styles.selectRow}
        onPress={() => setShowDatePicker(true)}
      >
        <Text style={[styles.selectRowText, !birthDate && styles.selectRowPlaceholder]}>
          {birthDate
            ? (() => {
                const [y, m, d] = birthDate.split('-');
                const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                return `${d} ${months[parseInt(m, 10) - 1] ?? m} ${y}`;
              })()
            : 'Selecionar...'}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>
      <DateWheelPicker
        visible={showDatePicker}
        value={birthDate}
        onConfirm={(date) => { setBirthDate(date); setShowDatePicker(false); }}
        onCancel={() => setShowDatePicker(false)}
      />

      <Text style={styles.label}>Género</Text>
      <TouchableOpacity
        style={styles.selectRow}
        onPress={() =>
          openPicker(
            'Género',
            GENDERS.map((g) => ({ key: g.key, label: g.label })),
            gender,
            (val) => setGender(val as Gender),
          )
        }
      >
        <Text style={[styles.selectRowText, !gender && styles.selectRowPlaceholder]}>
          {gender ? GENDERS.find((g) => g.key === gender)?.label : 'Selecionar...'}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>

      <Text style={styles.label}>Peso (kg)</Text>
      <TextInput
        style={styles.input}
        value={weightKg}
        onChangeText={setWeightKg}
        keyboardType="numeric"
        placeholder="Ex: 70"
        placeholderTextColor={colors.mutedForeground}
      />

      <Text style={styles.label}>Objetivo</Text>
      <TouchableOpacity
        style={styles.selectRow}
        onPress={() =>
          openPicker(
            'Objetivo',
            ACTIVITY_GOALS.map((g) => ({ key: g.key, label: g.label, icon: g.icon })),
            goal,
            (val) => setGoal(val as ActivityGoal),
          )
        }
      >
        <Text style={[styles.selectRowText, !goal && styles.selectRowPlaceholder]}>
          {goal ? ACTIVITY_GOALS.find((g) => g.key === goal)?.label : 'Selecionar...'}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>

      {(goal === 'run_weekly_km' || goal === 'cycle_weekly_km') && (
        <View style={styles.kmTargetContainer}>
          <Text style={styles.label}>Meta semanal (km)</Text>
          <TextInput
            style={styles.input}
            value={weeklyKmTarget}
            onChangeText={setWeeklyKmTarget}
            keyboardType="numeric"
            placeholder="Ex: 10"
            placeholderTextColor={colors.mutedForeground}
          />
        </View>
      )}

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Perfil público</Text>
        <Switch
          value={isPublic}
          onValueChange={setIsPublic}
          trackColor={{ false: colors.border, true: colors.primary }}
        />
      </View>

      <TouchableOpacity
        style={[styles.saveButton, loading && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={loading}
      >
        <Text style={styles.saveButtonText}>
          {loading ? 'A guardar...' : 'Guardar'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24 },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  avatarLoader: { position: 'absolute', top: 30 },
  avatarHint: { ...typography.body, fontSize: 13, color: colors.mutedForeground, marginTop: 8 },
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
  selectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    backgroundColor: colors.inputBackground,
    marginTop: 4,
  },
  selectRowText: { ...typography.body, fontSize: 16, color: colors.foreground, flex: 1 },
  selectRowPlaceholder: { color: colors.mutedForeground },
  kmTargetContainer: { marginTop: 4 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, paddingVertical: 12, borderTopWidth: 1, borderColor: colors.border },
  switchLabel: { ...typography.body, fontSize: 16, color: colors.foreground },
  saveButton: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { ...typography.bodyBold, color: colors.primaryForeground, fontSize: 16 },
});
