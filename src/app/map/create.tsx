
import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, typography } from '../../lib/theme';
import { fetchRouteById, createRoute, updateRoute } from '../../services/routes';
import { MapViewWrapper } from '../../components/map/MapViewWrapper';
import { RoutePolyline } from '../../components/map/RoutePolyline';
import { RouteMarker } from '../../components/map/RouteMarker';
import { ACTIVITY_CATEGORIES } from '../../lib/constants';
import type { ActivityType, RouteDifficulty, SurfaceType } from '../../lib/types';

export default function CreateRouteScreen() {
  const { t } = useTranslation();
  const { routeId, path: pathParam, distance: distParam, duration: durParam } = useLocalSearchParams<{
    routeId?: string;
    path?: string;
    distance?: string;
    duration?: string;
  }>();

  const isEditing = !!routeId;

  // Parse incoming path data
  let initialPath: [number, number][] = [];
  if (pathParam) {
    try {
      initialPath = JSON.parse(pathParam);
    } catch {
      // invalid path
    }
  }

  const initialDistance = distParam ? parseFloat(distParam) : 0;
  const initialDuration = durParam ? parseInt(durParam, 10) : 0;

  // Fetch existing route for editing
  const { data: existingRoute } = useQuery({
    queryKey: ['route', routeId],
    queryFn: () => fetchRouteById(routeId!),
    enabled: isEditing,
  });

  const [name, setName] = useState(existingRoute?.name ?? '');
  const [description, setDescription] = useState(existingRoute?.description ?? '');
  const [city, setCity] = useState(existingRoute?.city ?? '');
  const [activityType, setActivityType] = useState<ActivityType>(
    existingRoute?.activity_type ?? 'run',
  );
  const [difficulty, setDifficulty] = useState<RouteDifficulty>(
    existingRoute?.difficulty ?? 'moderate',
  );
  const [surfaceType, setSurfaceType] = useState<SurfaceType>(
    existingRoute?.surface_type ?? 'road',
  );
  const [isPublic, setIsPublic] = useState(existingRoute?.is_public ?? false);
  const [saving, setSaving] = useState(false);

  const distance = existingRoute?.distance ?? initialDistance;
  const duration = existingRoute?.estimated_duration ?? initialDuration;
  const path = existingRoute?.path ?? initialPath;
  const mapCenter = path.length > 0 ? path[0] : (existingRoute?.start_point ?? [-9.1393, 38.7223]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Erro', 'Da um nome a rota.');
      return;
    }

    setSaving(true);
    try {
      if (isEditing && routeId) {
        await updateRoute(routeId, {
          name: name.trim(),
          description: description.trim() || undefined,
          city: city.trim() || 'Desconhecida',
          activity_type: activityType,
          difficulty,
          surface_type: surfaceType,
          distance,
          estimated_duration: duration,
          is_public: isPublic,
          path,
        });
      } else {
        await createRoute({
          name: name.trim(),
          description: description.trim() || undefined,
          city: city.trim() || 'Desconhecida',
          activity_type: activityType,
          difficulty,
          surface_type: surfaceType,
          distance,
          estimated_duration: duration,
          is_public: isPublic,
          path,
        });
      }

      Alert.alert('Guardado', 'Rota guardada com sucesso!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Erro', err?.message ?? 'Nao foi possivel guardar a rota.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Map preview */}
      <View style={styles.mapContainer}>
        <MapViewWrapper center={mapCenter as [number, number]} zoom={13} showUserLocation={false}>
          {path.length >= 2 && (
            <>
              <RoutePolyline id="preview" coordinates={path} />
              <RouteMarker id="preview-start" coordinate={path[0]} type="start" />
              <RouteMarker id="preview-finish" coordinate={path[path.length - 1]} type="finish" />
            </>
          )}
        </MapViewWrapper>
      </View>

      {/* Form */}
      <Text style={styles.sectionTitle}>{isEditing ? 'Editar Rota' : 'Nova Rota'}</Text>

      <Text style={styles.label}>Nome</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Ex: Volta ao parque"
        placeholderTextColor={colors.mutedForeground}
      />

      <Text style={styles.label}>Descricao (opcional)</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={description}
        onChangeText={setDescription}
        placeholder="Descricao da rota..."
        placeholderTextColor={colors.mutedForeground}
        multiline
        numberOfLines={3}
      />

      <Text style={styles.label}>Cidade</Text>
      <TextInput
        style={styles.input}
        value={city}
        onChangeText={setCity}
        placeholder="Ex: Lisboa"
        placeholderTextColor={colors.mutedForeground}
      />

      <Text style={styles.label}>{t('activity_detail_screen')}</Text>
      <View style={styles.chipRow}>
        {ACTIVITY_CATEGORIES.flatMap((cat) => cat.activities).map((act) => (
          <TouchableOpacity
            key={act.key}
            style={[styles.chip, activityType === act.key && styles.chipSelected]}
            onPress={() => setActivityType(act.key)}
          >
            <Ionicons
              name={act.icon as any}
              size={14}
              color={activityType === act.key ? colors.primaryForeground : colors.foreground}
            />
            <Text style={[styles.chipText, activityType === act.key && styles.chipTextSelected]}>
              {t(act.i18n_key as any)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>{t('routes_difficulty')}</Text>
      <View style={styles.chipRow}>
        {(['easy', 'moderate', 'hard', 'expert'] as RouteDifficulty[]).map((key) => (
          <TouchableOpacity
            key={key}
            style={[styles.chip, difficulty === key && styles.chipSelected]}
            onPress={() => setDifficulty(key)}
          >
            <Text style={[styles.chipText, difficulty === key && styles.chipTextSelected]}>
              {t(`route_difficulty_${key}` as any)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>{t('routes_surface')}</Text>
      <View style={styles.chipRow}>
        {(['road', 'trail', 'mixed', 'track'] as SurfaceType[]).map((key) => (
          <TouchableOpacity
            key={key}
            style={[styles.chip, surfaceType === key && styles.chipSelected]}
            onPress={() => setSurfaceType(key)}
          >
            <Text style={[styles.chipText, surfaceType === key && styles.chipTextSelected]}>
              {t(`route_surface_${key}` as any)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.publicToggle} onPress={() => setIsPublic(!isPublic)}>
        <Ionicons name={isPublic ? 'globe' : 'lock-closed'} size={18} color={colors.foreground} />
        <Text style={styles.publicText}>{isPublic ? 'Rota publica' : 'Rota privada'}</Text>
      </TouchableOpacity>

      {/* Stats */}
      {(distance > 0 || duration > 0) && (
        <View style={styles.statsPreview}>
          <Ionicons name="analytics" size={16} color={colors.primary} />
          <Text style={styles.statsText}>
            {(distance / 1000).toFixed(1)} km
            {duration > 0 && ` · ${Math.round(duration / 60)} min`}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color={colors.primaryForeground} />
        ) : (
          <Text style={styles.saveButtonText}>
            {isEditing ? 'Atualizar Rota' : 'Guardar Rota'}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20 },
  mapContainer: { height: 220, borderRadius: 16, overflow: 'hidden', marginBottom: 20 },
  sectionTitle: { ...typography.headline, fontSize: 24, color: colors.foreground, marginBottom: 16 },
  label: { ...typography.bodyMedium, fontSize: 14, color: colors.mutedForeground, marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    fontFamily: 'Barlow_400Regular',
    color: colors.foreground,
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.inputBackground,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.body, fontSize: 13, color: colors.foreground },
  chipTextSelected: { color: colors.primaryForeground, fontFamily: 'Barlow_600SemiBold' },
  publicToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    padding: 14,
  },
  publicText: { ...typography.body, fontSize: 15, color: colors.foreground },
  statsPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    padding: 14,
  },
  statsText: { ...typography.statNumber, fontSize: 18, color: colors.primary },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { ...typography.bodyBold, fontSize: 18, color: colors.primaryForeground },
});
