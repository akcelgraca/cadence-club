import { View, Text, TouchableOpacity, Alert, Image, ActivityIndicator, TextInput, ScrollView } from 'react-native';
import { useColors } from '../../hooks/useColors';
import { useRef, useState, useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { useActivityStore } from '../../store/activityStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuth } from '../../hooks/useAuth';
import { saveActivity, addActivityPhotos, MAX_ACTIVITY_PHOTOS } from '../../services/activities';
import { writeBackWorkout } from '../../services/health/sync';
import { getEquipment } from '../../services/equipment';
import { getActivityByKey } from '../../lib/constants';
import { formatDuration } from '../../utils/dateHelpers';
import { formatDistance } from '../../utils/formatDistance';
import { formatPace } from '../../utils/formatPace';
import { calculateActivityCalories } from '../../utils/calculateCalories';
import { ActivityMap } from '../activity/ActivityMap';
import { PaceProfile } from '../activity/PaceProfile';
import { ElevationProfile } from '../activity/ElevationProfile';
import { SplitsTable } from '../activity/SplitsTable';
import { PhotoGrid } from '../activity/PhotoGrid';
import ShareActivityCard, { type ShareCardData } from '../share/ShareActivityCard';
import { captureTransparentPng } from '../share/captureCard';
import { detectSegmentEfforts } from '../../services/segments';
import { getMyPrivacyZones, trimRouteForZones } from '../../services/privacyZones';
import { queuePendingActivity } from '../../services/pendingSync';
import { type Colors } from '../../lib/theme';
import { MOOD_IMAGES, SURFACE_TYPES } from './shared';
import { makeStyles } from './recordStyles';
import { track } from '../../lib/analytics';

export function FinishedView({ isDistanceBased = true }: { isDistanceBased?: boolean }) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
  const type = useActivityStore((s) => s.type);
  const runType = useActivityStore((s) => s.runType);
  const elapsedTime = useActivityStore((s) => s.elapsedTime);
  const distance = useActivityStore((s) => s.distance);
  const avgPace = useActivityStore((s) => s.avgPace);
  const currentPace = useActivityStore((s) => s.currentPace);
  const elevationGain = useActivityStore((s) => s.elevationGain);
  const points = useActivityStore((s) => s.points);
  const mood = useActivityStore((s) => s.mood);
  const title = useActivityStore((s) => s.title);
  const description = useActivityStore((s) => s.description);
  const isPublic = useActivityStore((s) => s.isPublic);
  const surfaceType = useActivityStore((s) => s.surfaceType);
  const equipmentId = useActivityStore((s) => s.equipmentId);
  const startTime = useActivityStore((s) => s.startTime);
  const setMood = useActivityStore((s) => s.setMood);
  const setTitle = useActivityStore((s) => s.setTitle);
  const setDescription = useActivityStore((s) => s.setDescription);
  const setVisibility = useActivityStore((s) => s.setVisibility);
  const setSurfaceType = useActivityStore((s) => s.setSurfaceType);
  const setEquipmentId = useActivityStore((s) => s.setEquipmentId);
  const reset = useActivityStore((s) => s.reset);
  const unitSystem = useSettingsStore((s) => s.settings.unitSystem);
  const queryClient = useQueryClient();
  const { userId, profile } = useAuth();

  const [photos, setPhotos] = useState<{ uri: string; mimeType?: string }[]>([]);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  /** Cartão de estatísticas renderizado fora do ecrã, para captura. */
  const statsCardRef = useRef<View>(null);

  // Fetch user equipment
  const { data: equipment = [] } = useQuery({
    queryKey: ['equipment', userId],
    queryFn: () => getEquipment(userId!),
    enabled: !!userId,
  });

  // Estimated calories for non-distance activities
  const estimatedCalories = !isDistanceBased
    ? Math.round(
        calculateActivityCalories(
          {
            type: type!,
            duration: elapsedTime,
            distance: 0,
            avg_pace: 0,
          } as any,
          profile?.weight_kg ?? 70,
        ),
      )
    : 0;

  const handlePickPhoto = () => {
    Alert.alert(t('activity_photo_title'), undefined, [
      { text: t('activity_photo_camera'), onPress: () => pickPhoto('camera') },
      { text: t('activity_photo_gallery'), onPress: () => pickPhoto('gallery') },
      { text: t('cancel'), style: 'cancel' },
    ]);
  };

  const pickPhoto = async (source: 'camera' | 'gallery') => {
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') return;
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return;
    }

    const remaining = MAX_ACTIVITY_PHOTOS - photos.length;
    if (remaining <= 0) return;

    setPhotoLoading(true);
    try {
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 5], quality: 0.8 })
        // A galeria permite escolher várias de uma vez, até ao limite
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: true,
            selectionLimit: remaining,
            quality: 0.8,
          });

      if (!result.canceled && result.assets?.length) {
        setPhotos((prev) => [
          ...prev,
          ...result.assets.slice(0, remaining).map((a) => ({
            uri: a.uri,
            mimeType: a.mimeType ?? 'image/jpeg',
          })),
        ]);
      }
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleSave = async () => {
    // O upload da foto demora — sem esta guarda, tocar duas vezes cria
    // duas atividades iguais
    if (saving) return;
    setSaving(true);

    const endTime = startTime
      ? new Date(new Date(startTime).getTime() + elapsedTime * 1000).toISOString()
      : new Date().toISOString();

    // O cartão é capturado antes de qualquer chamada à rede: se não houver
    // ligação, vai para a fila junto com o resto.
    let cardUri: string | null = null;
    try {
      cardUri = await captureTransparentPng(statsCardRef);
    } catch {
      cardUri = null;
    }

    // route_summary é lido por qualquer pessoa: corta-se aqui, antes de sair
    // do telemóvel. Os pontos completos ficam em activity_points, que só o
    // dono lê diretamente (migração 040).
    // Sem rede não há zonas — nesse caso não se envia resumo público nenhum,
    // porque publicar o traçado por cortar era pior do que não o publicar.
    let publicRoute = points;
    let zonesKnown = true;
    try {
      const zones = await getMyPrivacyZones();
      publicRoute = trimRouteForZones(points, zones);
    } catch {
      zonesKnown = false;
      publicRoute = [];
    }

    const payload = {
      type: type!,
      runType: runType ?? undefined,
      distance,
      duration: Math.round(elapsedTime),
      elevation_gain: Math.round(elevationGain),
      avg_pace: avgPace || currentPace || 0,
      start_time: startTime || new Date().toISOString(),
      end_time: endTime,
      route_summary: publicRoute.map((p) => [p.lat, p.lng]),
      points,
      mood,
      title: (title || suggestedTitle) || null,
      description: description || null,
      is_public: isPublic,
      surface_type: surfaceType,
      equipment_id: equipmentId,
    };

    /** O momento em que a app entrega valor. Sem coordenadas nem título. */
    const trackRecorded = (queuedOffline: boolean) =>
      track('activity_recorded', {
        type: payload.type,
        distance_km: Math.round(payload.distance / 1000),
        duration_min: Math.round(payload.duration / 60),
        queued_offline: queuedOffline,
        has_photos: photos.length > 0,
      });

    /** Guarda no telemóvel e sai — nunca se perde o treino por falta de rede. */
    const queueAndLeave = async (reason: string) => {
      try {
        await queuePendingActivity({ payload, photos, generatedCardUri: cardUri });
        trackRecorded(true);
        Alert.alert(
          t('finish_queued_title'),
          t('finish_queued_body', { reason }),
          [{ text: 'OK', onPress: () => { reset(); router.replace('/(tabs)'); } }],
        );
      } catch {
        Alert.alert(
          t('activity_save_error_title'),
          t('finish_queue_error'),
        );
      } finally {
        setSaving(false);
      }
    };

    if (!zonesKnown) {
      await queueAndLeave(t('finish_no_server'));
      return;
    }

    try {
      const saved = await saveActivity(payload);
      trackRecorded(false);

      // As fotos do utilizador vão primeiro; o trigger define a capa.
      // Uma falha aqui não deve perder a atividade, que já está guardada.
      try {
        if (photos.length > 0) await addActivityPhotos(saved.id, photos);
        if (cardUri) {
          await addActivityPhotos(
            saved.id, [{ uri: cardUri, mimeType: 'image/png' }], photos.length, true,
          );
        }
      } catch (photoErr) {
        console.warn('[FinishedView] fotos por enviar:', photoErr);
      }

      // Deteta troços percorridos. Falhar aqui não invalida a atividade.
      detectSegmentEfforts(saved.id).catch(() => {});

      // Devolve o treino à Saúde, se a pessoa tiver dado essa permissão. Sem
      // `await` de propósito: já está guardado, e ninguém deve esperar pelo
      // módulo nativo para ver o resumo da corrida que acabou de fazer.
      void writeBackWorkout(saved).catch(() => {});

      // Invalidate all stats-related queries so home screen refreshes
      queryClient.invalidateQueries({ queryKey: ['weeklyPlan'] });
      queryClient.invalidateQueries({ queryKey: ['weeklySummary'] });
      queryClient.invalidateQueries({ queryKey: ['weeklyDailyBreakdown'] });
      queryClient.invalidateQueries({ queryKey: ['profileStats'] });
      queryClient.invalidateQueries({ queryKey: ['monthlyStats'] });
      queryClient.invalidateQueries({ queryKey: ['myActivities'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });

      Alert.alert(t('activity_saved_title'), t('activity_saved_message'), [
        { text: 'OK', onPress: () => { reset(); router.replace('/(tabs)'); } },
      ]);
      setSaving(false);
    } catch (err: any) {
      console.error('[SaveActivity] Failed:', err?.message ?? err, err);
      await queueAndLeave(t('finish_unreachable'));
    }
  };

  /** Dados do cartão de partilha — usa o traçado real da gravação. */
  const shareData: ShareCardData = {
    distanceKm: distance / 1000,
    paceSecPerKm: avgPace || currentPace || 0,
    durationSec: elapsedTime,
    routeCoords: points.map((p) => ({ latitude: p.lat, longitude: p.lng })),
  };

  const activityLabel = type ? t(getActivityByKey(type)?.i18n_key as any ?? 'activity_detail_screen') : t('activity_detail_screen');

  /** Título sugerido pela hora do dia — evita listas de "Atividade sem nome". */
  const suggestedTitle = (() => {
    const hour = startTime ? new Date(startTime).getHours() : new Date().getHours();
    const key = hour < 12 ? 'finish_title_morning' : hour < 20 ? 'finish_title_afternoon' : 'finish_title_evening';
    return t(key, { activity: activityLabel });
  })();

  // Build elevation points from GPS data
  const elevationPoints = points
    .filter((p) => p.elevation != null)
    .map((p) => ({ lat: p.lat, lng: p.lng, elevation: p.elevation! }));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
    {/* Cartão de partilha fora do ecrã: tem de estar montado e com layout
        para o view-shot o conseguir capturar (display:none não serve). */}
    <View style={styles.offscreenCard} pointerEvents="none">
      <ShareActivityCard ref={statsCardRef} data={shareData} width={360} />
    </View>

    <ScrollView
      contentContainerStyle={styles.finishedContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.finishedHeader}>
        <Text style={styles.finishedTitle}>{t('activity_summary_title')}</Text>
        <Text style={styles.finishedType}>{activityLabel}</Text>
      </View>

      {/* Stats grid */}
      {isDistanceBased ? (
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{formatDistance(distance, unitSystem)}</Text>
            <Text style={styles.summaryLabel}>{t('distance')}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{formatDuration(elapsedTime)}</Text>
            <Text style={styles.summaryLabel}>{t('duration')}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{formatPace(avgPace || currentPace, unitSystem)}</Text>
            <Text style={styles.summaryLabel}>{t('avg_pace')}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{Math.round(elevationGain)}m</Text>
            <Text style={styles.summaryLabel}>{t('elevation')}</Text>
          </View>
        </View>
      ) : (
        /* Sem GPS só há duas medidas reais — mostrar "--" e "Em breve"
           nas outras seria encher o ecrã com casas vazias */
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItemWide}>
            <Text style={styles.summaryValue}>{formatDuration(elapsedTime)}</Text>
            <Text style={styles.summaryLabel}>{t('duration')}</Text>
          </View>
          <View style={styles.summaryItemWide}>
            <Text style={styles.summaryValue}>{estimatedCalories}</Text>
            <Text style={styles.summaryLabel}>{t('activity_calories')}</Text>
          </View>
        </View>
      )}

      {/* Percurso — acabaste de o gravar, faz sentido vê-lo aqui */}
      {isDistanceBased && points.length >= 2 && (
        <View style={styles.summaryMap}>
          <ActivityMap
            points={points.map((p) => ({ lat: p.lat, lng: p.lng }))}
            height={190}
          />
        </View>
      )}

      {/* Como correu — rápido de responder e é o que liga treino a bem-estar */}
      <Text style={styles.moodTitle}>{t('activity_how_was_it')}</Text>
      <View style={styles.moodRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity
            key={n}
            style={[styles.moodButton, mood === n && styles.moodButtonSelected]}
            onPress={() => setMood(n)}
            activeOpacity={0.6}
          >
            <Image source={MOOD_IMAGES[n]} style={styles.moodImage} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Title input */}
      <Text style={styles.fieldLabel}>{t('activity_title_label')}</Text>
      <TextInput
        style={styles.fieldInput}
        placeholder={suggestedTitle}
        placeholderTextColor={c.mutedForeground}
        value={title}
        onChangeText={setTitle}
        maxLength={100}
      />

      {/* Description input */}
      <Text style={styles.fieldLabel}>{t('activity_description_label')}</Text>
      <TextInput
        style={[styles.fieldInput, styles.fieldTextArea]}
        placeholder={t('activity_desc_placeholder')}
        placeholderTextColor={c.mutedForeground}
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={3}
        maxLength={500}
      />

      {/* Photo picker */}
      <Text style={styles.fieldLabel}>
        {t('activity_photo_label')}
        {photos.length > 0 && (
          <Text style={styles.photoCount}>  {photos.length}/{MAX_ACTIVITY_PHOTOS}</Text>
        )}
      </Text>
      <View style={styles.photoGridWrap}>
        <PhotoGrid
          photos={photos.map((p) => ({ key: p.uri, uri: p.uri }))}
          onReorder={(next) => setPhotos(
            next.map((n) => photos.find((p) => p.uri === n.key)!).filter(Boolean),
          )}
          onRemove={(key) => setPhotos((prev) => prev.filter((p) => p.uri !== key))}
          onAdd={handlePickPhoto}
          maxPhotos={MAX_ACTIVITY_PHOTOS}
          loading={photoLoading}
        />
      </View>

      {/* Surface type - only for distance-based activities */}
      {isDistanceBased && (
        <>
          <Text style={styles.fieldLabel}>{t('activity_surface_type')}</Text>
          <View style={styles.chipRow}>
            {SURFACE_TYPES.map((s) => (
              <TouchableOpacity
                key={s.key}
                style={[styles.chip, surfaceType === s.key && styles.chipActive]}
                onPress={() => setSurfaceType(surfaceType === s.key ? null : s.key)}
                activeOpacity={0.7}
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

      {/* Equipment selector */}
      {equipment.length > 0 && (
        <>
          <Text style={styles.fieldLabel}>{t('activity_equipment_label')}</Text>
          <View style={styles.chipRow}>
            {equipment.map((eq) => (
              <TouchableOpacity
                key={eq.id}
                style={[styles.chip, equipmentId === eq.id && styles.chipActive]}
                onPress={() => setEquipmentId(equipmentId === eq.id ? null : eq.id)}
                activeOpacity={0.7}
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

      {/* Visibility toggle */}
      <View style={styles.visibilityRow}>
        <View style={styles.visibilityInfo}>
          <Ionicons
            name={isPublic ? 'globe-outline' : 'lock-closed-outline'}
            size={18}
            color={c.foreground}
          />
          <Text style={styles.visibilityLabel}>
            {isPublic ? t('activity_visibility_public') : t('activity_visibility_private')}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.toggle, isPublic && styles.toggleActive]}
          onPress={() => setVisibility(!isPublic)}
          activeOpacity={0.7}
        >
          <View style={[styles.toggleKnob, isPublic && styles.toggleKnobActive]} />
        </TouchableOpacity>
      </View>

      {/* Parciais por quilómetro */}
      {isDistanceBased && points.length >= 2 && (
        <View style={styles.chartSection}>
          <Text style={styles.chartSectionTitle}>{t('activity_splits')}</Text>
          <SplitsTable
            points={points.map((p) => ({
              lat: p.lat,
              lng: p.lng,
              elevation: p.elevation,
              timestamp: p.timestamp,
            }))}
            maxRows={8}
          />
        </View>
      )}

      {/* Pace chart - only for distance-based */}
      {isDistanceBased && points.length >= 2 && (
        <View style={styles.chartSection}>
          <Text style={styles.chartSectionTitle}>{t('pace')}</Text>
          <PaceProfile
            points={points.map((p) => ({ lat: p.lat, lng: p.lng, timestamp: p.timestamp }))}
            height={160}
          />
        </View>
      )}

      {/* Elevation profile chart - only for distance-based */}
      {isDistanceBased && elevationPoints.length >= 2 && (
        <View style={styles.chartSection}>
          <Text style={styles.chartSectionTitle}>{t('elevation')}</Text>
          <ElevationProfile
            points={elevationPoints}
            height={160}
          />
        </View>
      )}

      {/* Save button */}
      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        activeOpacity={0.85}
        disabled={saving}
      >
        {saving ? (
          <View style={styles.saveButtonRow}>
            <ActivityIndicator size="small" color={c.primaryForeground} />
            <Text style={styles.saveButtonText}>{t('activity_saving')}</Text>
          </View>
        ) : (
          <Text style={styles.saveButtonText}>{t('activity_save_button')}</Text>
        )}
      </TouchableOpacity>

      {/* Discard link */}
      <TouchableOpacity
        style={styles.discardLink}
        disabled={saving}
        onPress={() => {
          Alert.alert(
            t('activity_discard_confirm'),
            t('activity_discard_message'),
            [
              { text: t('cancel'), style: 'cancel' },
              { text: t('activity_discard'), style: 'destructive', onPress: () => { reset(); router.replace('/(tabs)'); } },
            ]
          );
        }}
      >
        <Text style={styles.discardLinkText}>{t('activity_discard')}</Text>
      </TouchableOpacity>
    </ScrollView>
    </SafeAreaView>
  );
}

