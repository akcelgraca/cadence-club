import { useState, useEffect, useMemo } from 'react';
import { useColors } from '../../../hooks/useColors';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, FlatList,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import {
  getActivity, updateActivity, getActivityPhotos, addActivityPhotos,
  deleteActivityPhoto, reorderActivityPhotos, MAX_ACTIVITY_PHOTOS,
} from '../../../services/activities';
import { PhotoGrid } from '../../../components/activity/PhotoGrid';
import { getEquipment } from '../../../services/equipment';
import { useAuthStore } from '../../../store/authStore';
import { ActivityIcon } from '../../../components/common/ActivityIcon';
import { ACTIVITY_CATEGORIES, getActivityByKey } from '../../../lib/constants';
import { MOOD_IMAGES, SURFACE_TYPES } from '../../../components/record/shared';
import { typography, withAlpha, type Colors } from '../../../lib/theme';
import type { ActivityType, SurfaceType } from '../../../lib/types';
import { goBackOr } from '../../../lib/navigation';

export default function EditActivityScreen() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const myId = useAuthStore((s) => s.profile?.id);

  const { data: activity, isLoading } = useQuery({
    queryKey: ['activity', id],
    queryFn: () => getActivity(id),
    enabled: !!id,
  });

  const { data: equipment = [] } = useQuery({
    queryKey: ['equipment', myId],
    queryFn: () => getEquipment(myId!),
    enabled: !!myId,
  });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ActivityType | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [mood, setMood] = useState<number | null>(null);
  const [surfaceType, setSurfaceType] = useState<SurfaceType | null>(null);
  const [equipmentId, setEquipmentId] = useState<string | null>(null);
  /**
   * Lista única e ordenada da galeria: mistura fotos guardadas (com id) e
   * novas (ainda locais). É esta ordem que se grava ao guardar.
   */
  const [gallery, setGallery] = useState<
    { key: string; uri: string; photoId?: string; mimeType?: string; generated?: boolean }[]
  >([]);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: photos = [] } = useQuery({
    queryKey: ['activityPhotos', id],
    queryFn: () => getActivityPhotos(id),
    enabled: !!id,
  });

  useEffect(() => {
    setGallery(photos.map((p) => ({
      key: p.id, uri: p.url, photoId: p.id, generated: p.is_generated,
    })));
  }, [photos]);

  const totalPhotos = gallery.length;

  // Preenche o formulário quando a atividade carrega
  useEffect(() => {
    if (!activity) return;
    setTitle(activity.title ?? '');
    setDescription(activity.description ?? '');
    setType(activity.type);
    setIsPublic(activity.is_public ?? true);
    setMood(activity.mood ?? null);
    setSurfaceType(activity.surface_type ?? null);
    setEquipmentId(activity.equipment_id ?? null);
  }, [activity?.id]);

  const isOwner = !!activity && activity.user_id === myId;
  const isDistanceBased = getActivityByKey(type ?? '')?.distance_based ?? true;

  const pickPhoto = async (source: 'camera' | 'gallery') => {
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') return;

    const remaining = MAX_ACTIVITY_PHOTOS - totalPhotos;
    if (remaining <= 0) return;

    setPhotoLoading(true);
    try {
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 5], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: true,
            selectionLimit: remaining,
            quality: 0.8,
          });

      if (!result.canceled && result.assets?.length) {
        setGallery((prev) => [
          ...prev,
          ...result.assets.slice(0, remaining).map((a) => ({
            key: a.uri,
            uri: a.uri,
            mimeType: a.mimeType ?? 'image/jpeg',
          })),
        ]);
      }
    } finally {
      setPhotoLoading(false);
    }
  };

  const handlePickPhoto = () => {
    Alert.alert(t('activity_photo_title'), undefined, [
      { text: t('activity_photo_camera'), onPress: () => pickPhoto('camera') },
      { text: t('activity_photo_gallery'), onPress: () => pickPhoto('gallery') },
      { text: t('cancel'), style: 'cancel' as const },
    ]);
  };

  const handleSave = async () => {
    if (!activity || saving) return;
    setSaving(true);
    try {
      // 1. Apagar as removidas  2. Reordenar as que ficam  3. Acrescentar as
      // novas no fim. A capa é recalculada pelo trigger a cada alteração.
      for (const photoId of removedPhotoIds) {
        await deleteActivityPhoto(photoId);
      }

      const keptIds = gallery.filter((g) => g.photoId).map((g) => g.photoId!);
      if (keptIds.length > 0) {
        await reorderActivityPhotos(keptIds);
      }

      const addedPhotos = gallery.filter((g) => !g.photoId);
      if (addedPhotos.length > 0) {
        await addActivityPhotos(
          activity.id,
          addedPhotos.map((g) => ({ uri: g.uri, mimeType: g.mimeType })),
          keptIds.length,
        );
      }

      await updateActivity(activity.id, {
        type: type ?? activity.type,
        title: title.trim() || null,
        description: description.trim() || null,
        is_public: isPublic,
        mood,
        surface_type: isDistanceBased ? surfaceType : null,
        equipment_id: equipmentId,
      });

      // Tudo o que mostra esta atividade tem de refletir a alteração
      queryClient.invalidateQueries({ queryKey: ['activity', id] });
      queryClient.invalidateQueries({ queryKey: ['activityPhotos', id] });
      queryClient.invalidateQueries({ queryKey: ['myActivities'] });
      queryClient.invalidateQueries({ queryKey: ['userActivities'] });
      queryClient.invalidateQueries({ queryKey: ['historyActivities'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['clubActivities'] });
      queryClient.invalidateQueries({ queryKey: ['profileStats'] });
      queryClient.invalidateQueries({ queryKey: ['monthlyStats'] });

      goBackOr(`/activity/${id}`);
    } catch (e: any) {
      Alert.alert(e?.message ?? t('activity_edit_save_error'));
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

  if (!activity || !isOwner) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <Text style={styles.errorText}>
          {activity ? t('activity_edit_not_yours') : t('activity_not_found')}
        </Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => goBackOr(`/activity/${id}`)}>
          <Text style={styles.backBtnText}>{t('route_creator_back')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const typeDef = getActivityByKey(type ?? '');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOr(`/activity/${id}`)} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={c.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('activity_edit_title')}</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} hitSlop={12}>
          {saving
            ? <ActivityIndicator size="small" color={c.primary} />
            : <Text style={styles.saveText}>{t('save')}</Text>}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          {/* Aviso do que não se edita */}
          <View style={styles.notice}>
            <Ionicons name="lock-closed-outline" size={14} color={c.mutedForeground} />
            <Text style={styles.noticeText}>
              {t('activity_edit_immutable_hint')}
            </Text>
          </View>

          {/* Modalidade */}
          <Text style={styles.label}>{t('activity_sport')}</Text>
          <TouchableOpacity style={styles.typeRow} onPress={() => setTypePickerOpen(true)}>
            <ActivityIcon activityKey={type ?? ''} size={22} tintColor={c.primary} />
            <Text style={styles.typeText}>
              {typeDef ? t(typeDef.i18n_key as any) : t('edit_profile_choose')}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={c.mutedForeground} />
          </TouchableOpacity>

          {/* Título */}
          <Text style={styles.label}>{t('activity_title_label')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('activity_title_placeholder')}
            placeholderTextColor={c.mutedForeground}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />

          {/* Descrição */}
          <Text style={styles.label}>{t('activity_description_label')}</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            placeholder={t('activity_desc_placeholder')}
            placeholderTextColor={c.mutedForeground}
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />

          {/* Fotos */}
          <Text style={styles.label}>
            {t('activity_photo_label')}
            {totalPhotos > 0 && (
              <Text style={styles.photoCount}>  {totalPhotos}/{MAX_ACTIVITY_PHOTOS}</Text>
            )}
          </Text>
          <PhotoGrid
            photos={gallery.map((g) => ({ key: g.key, uri: g.uri, generated: g.generated }))}
            onReorder={(next) => setGallery(
              next.map((n) => gallery.find((g) => g.key === n.key)!).filter(Boolean),
            )}
            onRemove={(key) => {
              const target = gallery.find((g) => g.key === key);
              // Só as já guardadas precisam de ser apagadas na base de dados
              if (target?.photoId) {
                setRemovedPhotoIds((prev) => [...prev, target.photoId!]);
              }
              setGallery((prev) => prev.filter((g) => g.key !== key));
            }}
            onAdd={handlePickPhoto}
            maxPhotos={MAX_ACTIVITY_PHOTOS}
            loading={photoLoading}
          />

          {/* Piso */}
          {isDistanceBased && (
            <>
              <Text style={styles.label}>{t('activity_surface_type')}</Text>
              <View style={styles.chipRow}>
                {SURFACE_TYPES.map((s) => (
                  <TouchableOpacity
                    key={s.key}
                    style={[styles.chip, surfaceType === s.key && styles.chipActive]}
                    onPress={() => setSurfaceType(surfaceType === s.key ? null : s.key)}
                  >
                    <Ionicons
                      name={s.icon}
                      size={14}
                      color={surfaceType === s.key ? c.primaryForeground : c.mutedForeground}
                    />
                    <Text style={[styles.chipText, surfaceType === s.key && styles.chipTextActive]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Equipamento */}
          {equipment.length > 0 && (
            <>
              <Text style={styles.label}>{t('activity_equipment_label')}</Text>
              <View style={styles.chipRow}>
                {equipment.map((eq) => (
                  <TouchableOpacity
                    key={eq.id}
                    style={[styles.chip, equipmentId === eq.id && styles.chipActive]}
                    onPress={() => setEquipmentId(equipmentId === eq.id ? null : eq.id)}
                  >
                    <Ionicons
                      name={eq.type === 'shoes' ? 'footsteps-outline' : eq.type === 'bike' ? 'bicycle-outline' : 'hardware-chip-outline'}
                      size={14}
                      color={equipmentId === eq.id ? c.primaryForeground : c.mutedForeground}
                    />
                    <Text style={[styles.chipText, equipmentId === eq.id && styles.chipTextActive]}>
                      {eq.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Humor */}
          <Text style={styles.label}>{t('activity_how_was_it')}</Text>
          <View style={styles.moodRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.moodButton, mood === n && styles.moodButtonSelected]}
                onPress={() => setMood(mood === n ? null : n)}
                activeOpacity={0.6}
              >
                <Image source={MOOD_IMAGES[n]} style={styles.moodImage} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Visibilidade */}
          <View style={styles.visibilityRow}>
            <View style={styles.visibilityInfo}>
              <Ionicons
                name={isPublic ? 'globe-outline' : 'lock-closed-outline'}
                size={18}
                color={c.foreground}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.visibilityLabel}>
                  {isPublic ? t('activity_visibility_public') : t('activity_visibility_private')}
                </Text>
                <Text style={styles.visibilitySub}>
                  {isPublic ? t('activity_visibility_public_hint') : t('activity_visibility_private_hint')}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.toggle, isPublic && styles.toggleActive]}
              onPress={() => setIsPublic((v) => !v)}
              activeOpacity={0.7}
            >
              <View style={[styles.toggleKnob, isPublic && styles.toggleKnobActive]} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={c.primaryForeground} />
              : <Text style={styles.saveButtonText}>{t('equipment_save_changes')}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Seletor de modalidade */}
      <Modal
        visible={typePickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setTypePickerOpen(false)}
      >
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('activity_sport')}</Text>
            <TouchableOpacity onPress={() => setTypePickerOpen(false)}>
              <Ionicons name="close" size={24} color={c.foreground} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={ACTIVITY_CATEGORIES}
            keyExtractor={(cat) => cat.key}
            renderItem={({ item: cat }) => (
              <View>
                <Text style={styles.modalCategory}>{t(cat.i18n_key as any)}</Text>
                {cat.activities.map((act) => (
                  <TouchableOpacity
                    key={act.key}
                    style={[styles.modalItem, type === act.key && styles.modalItemActive]}
                    onPress={() => { setType(act.key as ActivityType); setTypePickerOpen(false); }}
                  >
                    <ActivityIcon
                      activityKey={act.key}
                      size={20}
                      tintColor={type === act.key ? c.primary : c.mutedForeground}
                    />
                    <Text style={[styles.modalItemText, type === act.key && styles.modalItemTextActive]}>
                      {t(act.i18n_key as any)}
                    </Text>
                    {type === act.key && (
                      <Ionicons name="checkmark" size={18} color={c.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </Modal>
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

  form: { padding: 16, paddingBottom: 48 },

  notice: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 12,
    backgroundColor: withAlpha(c.foreground, 0.04),
  },
  noticeText: { ...typography.body, fontSize: 12, color: c.mutedForeground, flex: 1, lineHeight: 16 },

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
  inputMulti: { minHeight: 90, paddingTop: 12 },

  typeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: c.card, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13,
    borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
  },
  typeText: { ...typography.bodyMedium, fontSize: 15, color: c.foreground, flex: 1 },

  photoCount: { fontFamily: 'DMMono_400Regular', fontSize: 12, color: c.mutedForeground },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18,
    backgroundColor: withAlpha(c.foreground, 0.06),
  },
  chipActive: { backgroundColor: c.primary },
  chipText: { ...typography.bodyMedium, fontSize: 12, color: c.mutedForeground },
  chipTextActive: { color: c.primaryForeground },

  moodRow: { flexDirection: 'row', gap: 12 },
  moodButton: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: withAlpha(c.foreground, 0.05),
  },
  moodButtonSelected: {
    backgroundColor: withAlpha(c.primary, 0.15),
    borderWidth: 1.5, borderColor: c.primary,
  },
  moodImage: { width: 30, height: 30 },

  visibilityRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, marginTop: 24,
    backgroundColor: c.card, borderRadius: 12, padding: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
  },
  visibilityInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  visibilityLabel: { ...typography.bodyBold, fontSize: 14, color: c.foreground },
  visibilitySub: { ...typography.body, fontSize: 12, color: c.mutedForeground, marginTop: 1 },
  toggle: {
    width: 48, height: 28, borderRadius: 14,
    backgroundColor: withAlpha(c.foreground, 0.15),
    padding: 3, justifyContent: 'center',
  },
  toggleActive: { backgroundColor: c.primary },
  toggleKnob: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: c.card,
  },
  toggleKnobActive: { alignSelf: 'flex-end' },

  saveButton: {
    backgroundColor: c.primary, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', marginTop: 28,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { fontFamily: 'Barlow_600SemiBold', fontSize: 16, color: c.primaryForeground },

  // Seletor de modalidade
  modal: { flex: 1, backgroundColor: c.background },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
  },
  modalTitle: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 20, color: c.foreground },
  modalCategory: {
    fontFamily: 'Barlow_600SemiBold', fontSize: 12,
    color: c.mutedForeground, textTransform: 'uppercase', letterSpacing: 1,
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6,
  },
  modalItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
  },
  modalItemActive: { backgroundColor: withAlpha(c.primary, 0.06) },
  modalItemText: { ...typography.body, fontSize: 15, color: c.foreground, flex: 1 },
  modalItemTextActive: { fontFamily: 'Barlow_600SemiBold', color: c.primary },
});
