import { useState, useMemo } from 'react';
import { useColors } from '../../hooks/useColors';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { typography, withAlpha, type Colors } from '../../lib/theme';
import { useRouteStore } from '../../store/routeStore';
import { getRoutePath } from '../../services/mapboxDirections';
import { createRoute } from '../../services/routes';
import { reverseGeocode } from '../../services/geocoding';
import { useTranslation } from 'react-i18next';
import { ACTIVITY_CATEGORIES } from '../../lib/constants';
import type { ActivityType, RouteDifficulty, SurfaceType } from '../../lib/types';

interface RouteCreatorProps {
  onSave: () => void;
  onCancel: () => void;
}

type Step = 'draw' | 'config' | 'saving';

export function RouteCreator({ onSave, onCancel }: RouteCreatorProps) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { bottom } = useSafeAreaInsets();
  const { draftWaypoints, addWaypoint, removeWaypoint, clearWaypoints, cancelCreating } = useRouteStore();
  const [step, setStep] = useState<Step>('draw');
  const [loading, setLoading] = useState(false);
  const [snappedPath, setSnappedPath] = useState<[number, number][]>([]);
  const [routeDistance, setRouteDistance] = useState(0);
  const [routeDuration, setRouteDuration] = useState(0);
  const [routeElevationGain, setRouteElevationGain] = useState(0);

  // Config form state
  const [name, setName] = useState('');
  const [activityType, setActivityType] = useState<ActivityType>('run');
  const [difficulty, setDifficulty] = useState<RouteDifficulty>('moderate');
  const [surfaceType, setSurfaceType] = useState<SurfaceType>('road');
  const [isPublic, setIsPublic] = useState(false);
  const [city, setCity] = useState('');

  const { t } = useTranslation();

  const activityOptions: { key: ActivityType; label: string; icon: string }[] = (() => {
    const items: { key: ActivityType; label: string; icon: string }[] = [];
    for (const cat of ACTIVITY_CATEGORIES) {
      for (const act of cat.activities) {
        items.push({ key: act.key, label: t(act.i18n_key as any), icon: act.icon });
      }
    }
    return items;
  })();

  const DIFFICULTY_OPTIONS: { key: RouteDifficulty; label: string }[] = [
    { key: 'easy', label: t('route_difficulty_easy') },
    { key: 'moderate', label: t('route_difficulty_moderate') },
    { key: 'hard', label: t('route_difficulty_hard') },
    { key: 'expert', label: t('route_difficulty_expert') },
  ];

  const SURFACE_OPTIONS: { key: SurfaceType; label: string }[] = [
    { key: 'road', label: t('route_surface_road') },
    { key: 'trail', label: t('route_surface_trail') },
    { key: 'mixed', label: t('route_surface_mixed') },
    { key: 'track', label: t('route_surface_track') },
  ];

  const handleGetRoute = async () => {
    if (draftWaypoints.length < 2) {
      Alert.alert(t('route_creator_error_title'), t('route_creator_error_need_points'));
      return;
    }

    setLoading(true);
    try {
      console.log('[RouteCreator] Getting route from Mapbox Directions:', draftWaypoints.length, 'waypoints');
      const result = await getRoutePath(draftWaypoints, 'running');
      console.log('[RouteCreator] Route received:', {
        pathLength: result.path.length,
        distance: result.distance,
        duration: result.duration,
        elevationGain: result.elevationGain,
      });
      setSnappedPath(result.path);
      setRouteDistance(result.distance);
      setRouteDuration(result.duration);
      setRouteElevationGain(result.elevationGain);

      // Try to get city from first waypoint
      if (draftWaypoints.length > 0) {
        const cityName = await reverseGeocode(draftWaypoints[0][1], draftWaypoints[0][0]);
        if (cityName) setCity(cityName);
      }

      setStep('config');
    } catch (err: any) {
      Alert.alert(t('route_creator_error_title'), err?.message ?? t('route_creator_error_get_route'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('route_creator_error_title'), t('route_creator_error_name'));
      return;
    }

    setLoading(true);
    try {
      console.log('[RouteCreator] Saving route:', {
        name: name.trim(),
        city: city || t('route_creator_city_unknown'),
        activityType,
        difficulty,
        surfaceType,
        distance: routeDistance,
        pathLength: snappedPath.length,
      });
      await createRoute({
        name: name.trim(),
        city: city || t('route_creator_city_unknown'),
        activity_type: activityType,
        difficulty,
        surface_type: surfaceType,
        distance: routeDistance,
        elevation_gain: routeElevationGain,
        estimated_duration: routeDuration,
        is_public: isPublic,
        path: snappedPath,
      });

      clearWaypoints();
      cancelCreating();
      onSave();
    } catch (err: any) {
      console.error('[RouteCreator] Save failed:', err?.message ?? err, err);
      Alert.alert(t('route_creator_error_title'), err?.message ?? t('route_creator_error_save'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    clearWaypoints();
    cancelCreating();
    onCancel();
  };

  const handleUndo = () => {
    if (draftWaypoints.length > 0) {
      removeWaypoint(draftWaypoints.length - 1);
    }
  };

  if (step === 'config') {
    return (
      <View style={[styles.panel, { maxHeight: '75%', paddingBottom: 0 }]}>
        <Text style={styles.panelTitle}>{t('save')}</Text>

        <ScrollView showsVerticalScrollIndicator={false} bounces={false} style={{ flex: 1 }}>
          <Text style={styles.label}>{t('route_creator_name_label')}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t('route_creator_placeholder_name')}
            placeholderTextColor={c.mutedForeground}
          />

          <Text style={styles.label}>{t('route_creator_activity_label')}</Text>
          <View style={styles.chipRow}>
            {activityOptions.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.chip, activityType === opt.key && styles.chipSelected]}
                onPress={() => setActivityType(opt.key)}
              >
                <Text style={[styles.chipText, activityType === opt.key && styles.chipTextSelected]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>{t('route_creator_difficulty_label')}</Text>
          <View style={styles.chipRow}>
            {DIFFICULTY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.chip, difficulty === opt.key && styles.chipSelected]}
                onPress={() => setDifficulty(opt.key)}
              >
                <Text style={[styles.chipText, difficulty === opt.key && styles.chipTextSelected]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>{t('route_creator_surface_label')}</Text>
          <View style={styles.chipRow}>
            {SURFACE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.chip, surfaceType === opt.key && styles.chipSelected]}
                onPress={() => setSurfaceType(opt.key)}
              >
                <Text style={[styles.chipText, surfaceType === opt.key && styles.chipTextSelected]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.publicToggle}
            onPress={() => setIsPublic(!isPublic)}
          >
            <Ionicons name={isPublic ? 'globe' : 'lock-closed'} size={16} color={c.foreground} />
            <Text style={styles.publicText}>{isPublic ? t('route_public') : t('route_private')}</Text>
          </TouchableOpacity>

          {/* Stats preview */}
          <View style={styles.statsPreview}>
            <Text style={styles.statsText}>
              {(routeDistance / 1000).toFixed(1)} km · {Math.round(routeDuration / 60)} min
              {routeElevationGain > 0 && ` · ${routeElevationGain}m D+`}
            </Text>
          </View>
        </ScrollView>

        <View style={[styles.buttonRow, { paddingTop: 12, paddingBottom: bottom + 12 }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => setStep('draw')}>
            <Text style={styles.backButtonText}>{t('route_creator_back')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={c.primaryForeground} />
            ) : (
              <Text style={styles.saveButtonText}>{t('save')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Draw step
  return (
    <View style={styles.panel}>
      <View style={styles.drawHeader}>
        <Text style={styles.panelTitle}>{t('map_create_title')}</Text>
        <Text style={styles.drawHint}>
          {t('route_creator_hint', { count: draftWaypoints.length })}
        </Text>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
          <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.undoButton} onPress={handleUndo}>
          <Ionicons name="arrow-undo" size={16} color={c.foreground} />
          <Text style={styles.undoButtonText}>{t('route_creator_undo')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.getRouteButton, (draftWaypoints.length < 2 || loading) && styles.buttonDisabled]}
          onPress={handleGetRoute}
          disabled={draftWaypoints.length < 2 || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={c.primaryForeground} />
          ) : (
            <Text style={styles.getRouteButtonText}>{t('route_creator_get_route')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: c.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 34,
    borderBottomWidth: 0,
  },
  panelTitle: {
    ...typography.headline,
    fontSize: 20,
    color: c.foreground,
    marginBottom: 4,
  },
  drawHeader: {
    marginBottom: 12,
  },
  drawHint: {
    ...typography.body,
    fontSize: 13,
    color: c.mutedForeground,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: withAlpha(c.destructive, 0.15),
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...typography.bodyBold,
    fontSize: 14,
    color: c.destructive,
  },
  undoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.border,
    borderRadius: 12,
    padding: 12,
  },
  undoButtonText: {
    ...typography.bodyBold,
    fontSize: 14,
    color: c.foreground,
  },
  getRouteButton: {
    flex: 1,
    backgroundColor: c.primary,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  getRouteButtonText: {
    ...typography.bodyBold,
    fontSize: 14,
    color: c.primaryForeground,
  },
  buttonDisabled: {
    opacity: 0.4,
  },

  // Config form
  label: {
    ...typography.bodyMedium,
    fontSize: 13,
    color: c.mutedForeground,
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: c.inputBackground,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    fontFamily: 'Barlow_400Regular',
    color: c.foreground,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: c.inputBackground,
  },
  chipSelected: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  chipText: {
    ...typography.body,
    fontSize: 13,
    color: c.foreground,
  },
  chipTextSelected: {
    color: c.primaryForeground,
    fontFamily: 'Barlow_600SemiBold',
  },
  publicToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    backgroundColor: c.inputBackground,
    borderRadius: 10,
    padding: 12,
  },
  publicText: {
    ...typography.body,
    fontSize: 14,
    color: c.foreground,
  },
  statsPreview: {
    marginTop: 12,
    backgroundColor: c.inputBackground,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  statsText: {
    ...typography.statNumber,
    fontSize: 16,
    color: c.primary,
  },
  backButton: {
    flex: 1,
    backgroundColor: c.border,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  backButtonText: {
    ...typography.bodyBold,
    fontSize: 14,
    color: c.foreground,
  },
  saveButton: {
    flex: 2,
    backgroundColor: c.primary,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    ...typography.bodyBold,
    fontSize: 14,
    color: c.primaryForeground,
  },
});
