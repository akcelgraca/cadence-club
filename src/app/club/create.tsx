import { useState, useMemo } from 'react';
import { useColors } from '../../hooks/useColors';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Switch, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { createClub } from '../../services/clubs';
import { ACTIVITY_CATEGORIES } from '../../lib/constants';
import { ActivityIcon } from '../../components/common/ActivityIcon';
import { typography, withAlpha, type Colors } from '../../lib/theme';
import type { ActivityCategory } from '../../lib/types';
import { useTranslation } from 'react-i18next';
import { goBackOr } from '../../lib/navigation';

export default function CreateClubScreen() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState<ActivityCategory | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert(t('club_create_name_required_title'), t('club_create_name_required_body'));
      return;
    }
    setLoading(true);
    try {
      const club = await createClub({
        name: name.trim(),
        description: description.trim() || undefined,
        city: city.trim() || undefined,
        category: category ?? undefined,
        is_private: isPrivate,
      });
      router.replace(`/club/${club.id}`);
    } catch (e: any) {
      Alert.alert(e?.message ?? t('club_create_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOr('/(tabs)/social')} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={c.foreground} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('club_create_title')}</Text>
        <TouchableOpacity
          onPress={handleCreate}
          disabled={!name.trim() || loading}
          hitSlop={12}
        >
          {loading
            ? <ActivityIndicator size="small" color={c.primary} />
            : <Text style={[styles.saveText, (!name.trim()) && styles.saveTextDisabled]}>{t('create')}</Text>
          }
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar placeholder */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarLetter}>
                {name.trim() ? name.trim()[0].toUpperCase() : '?'}
              </Text>
            </View>
            <Text style={styles.avatarHint}>{t('club_create_icon_hint')}</Text>
          </View>

          {/* Name */}
          <View style={styles.field}>
            <Text style={styles.label}>{t('register_first_name')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('club_create_name_placeholder')}
              placeholderTextColor={c.mutedForeground}
              value={name}
              onChangeText={setName}
              maxLength={60}
              autoFocus
            />
            <Text style={styles.charCount}>{name.length}/60</Text>
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={styles.label}>{t('activity_description_label')}</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              placeholder={t('club_create_description_placeholder')}
              placeholderTextColor={c.mutedForeground}
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={300}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{description.length}/300</Text>
          </View>

          {/* City */}
          <View style={styles.field}>
            <Text style={styles.label}>{t('edit_profile_city')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('club_create_city_placeholder')}
              placeholderTextColor={c.mutedForeground}
              value={city}
              onChangeText={setCity}
              maxLength={50}
            />
          </View>

          {/* Category */}
          <View style={styles.field}>
            <Text style={styles.label}>{t('club_create_category')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.catRow}
            >
              {ACTIVITY_CATEGORIES.map((cat) => {
                const isActive = category === cat.key;
                const sampleKey = cat.activities[0]?.key ?? '';
                return (
                  <TouchableOpacity
                    key={cat.key}
                    style={[styles.catChip, isActive && styles.catChipActive]}
                    onPress={() => setCategory(isActive ? null : cat.key as ActivityCategory)}
                  >
                    <ActivityIcon
                      activityKey={sampleKey}
                      size={13}
                      tintColor={isActive ? c.primaryForeground : c.mutedForeground}
                    />
                    <Text style={[styles.catText, isActive && styles.catTextActive]}>
                      {cat.key}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Private toggle */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>{t('club_create_private')}</Text>
              <Text style={styles.toggleSub}>{t('club_create_private_hint')}</Text>
            </View>
            <Switch
              value={isPrivate}
              onValueChange={setIsPrivate}
              trackColor={{ false: c.border, true: withAlpha(c.primary, 0.5) }}
              thumbColor={isPrivate ? c.primary : '#f4f3f4'}
              ios_backgroundColor={c.inputBackground}
            />
          </View>

          {/* Create button */}
          <TouchableOpacity
            style={[styles.createBtn, (!name.trim() || loading) && styles.createBtnDisabled]}
            onPress={handleCreate}
            disabled={!name.trim() || loading}
          >
            {loading
              ? <ActivityIndicator color={c.primaryForeground} />
              : <Text style={styles.createBtnText}>{t('clubs_create')}</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (c: Colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  title: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 18,
    color: c.foreground,
  },
  saveText: {
    fontFamily: 'Barlow_600SemiBold',
    fontSize: 15,
    color: c.primary,
  },
  saveTextDisabled: { color: c.mutedForeground },

  form: { padding: 16, gap: 4 },

  avatarSection: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  avatarPlaceholder: {
    width: 80, height: 80, borderRadius: 22,
    backgroundColor: withAlpha(c.primary, 0.15),
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 36,
    color: c.primary,
  },
  avatarHint: {
    ...typography.body,
    fontSize: 12,
    color: c.mutedForeground,
  },

  field: { marginBottom: 16 },
  label: {
    fontFamily: 'Barlow_600SemiBold',
    fontSize: 13,
    color: c.foreground,
    marginBottom: 8,
  },
  input: {
    ...typography.body,
    fontSize: 15,
    color: c.foreground,
    backgroundColor: c.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  inputMulti: {
    minHeight: 90,
    paddingTop: 12,
  },
  charCount: {
    ...typography.body,
    fontSize: 11,
    color: c.mutedForeground,
    textAlign: 'right',
    marginTop: 4,
  },

  catRow: { gap: 8, paddingVertical: 4 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: withAlpha(c.foreground, 0.06),
  },
  catChipActive: { backgroundColor: c.primary },
  catText: {
    fontFamily: 'Barlow_500Medium',
    fontSize: 12,
    color: c.mutedForeground,
    textTransform: 'capitalize',
  },
  catTextActive: { color: c.primaryForeground },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  toggleInfo: { flex: 1 },
  toggleLabel: {
    fontFamily: 'Barlow_600SemiBold',
    fontSize: 15,
    color: c.foreground,
  },
  toggleSub: {
    ...typography.body,
    fontSize: 12,
    color: c.mutedForeground,
    marginTop: 2,
  },

  createBtn: {
    backgroundColor: c.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  createBtnDisabled: { opacity: 0.45 },
  createBtnText: {
    fontFamily: 'Barlow_600SemiBold',
    fontSize: 16,
    color: c.primaryForeground,
  },
});
