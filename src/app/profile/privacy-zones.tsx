import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import {
  getMyPrivacyZones, createPrivacyZone, deletePrivacyZone,
  updatePrivacyZoneRadius, applyZonesToAllActivities, type PrivacyZone,
} from '../../services/privacyZones';
import { forwardGeocode } from '../../services/geocoding';
import { colors, typography, withAlpha } from '../../lib/theme';
import { useTranslation } from 'react-i18next';

const RADII = [200, 500, 1000, 1500];

export default function PrivacyZonesScreen() {
  const { t } = useTranslation();
  const [zones, setZones] = useState<PrivacyZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [address, setAddress] = useState('');
  const [radius, setRadius] = useState(500);

  const load = useCallback(async () => {
    try {
      setZones(await getMyPrivacyZones());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  /** Depois de mexer nas zonas, reescreve o resumo público das atividades. */
  const reapply = async () => {
    const count = await applyZonesToAllActivities();
    await load();
    if (count > 0) {
      Alert.alert(
        t('zones_applied_title'),
        count === 1 ? t('zones_applied_one', { count }) : t('zones_applied_other', { count }),
      );
    }
  };

  const addFromCurrentLocation = async () => {
    setBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('zones_no_location_title'), t('zones_no_location_body'));
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await createPrivacyZone({
        label: 'Casa',
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        radius,
      });
      await reapply();
    } catch {
      Alert.alert(t('zones_create_error'));
    } finally {
      setBusy(false);
    }
  };

  const addFromAddress = async () => {
    const query = address.trim();
    if (!query) return;
    setBusy(true);
    try {
      const results = await forwardGeocode(query);
      if (results.length === 0) {
        Alert.alert(t('zones_address_not_found_title'), t('zones_address_not_found_body'));
        return;
      }
      await createPrivacyZone({
        label: results[0].name || query,
        lat: results[0].lat,
        lng: results[0].lng,
        radius,
      });
      setAddress('');
      await reapply();
    } catch {
      Alert.alert(t('zones_create_error'));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = (zone: PrivacyZone) => {
    Alert.alert(
      t('zones_remove'),
      t('zones_remove_confirm', { label: zone.label }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('zones_remove_action'),
          style: 'destructive',
          onPress: async () => {
            try { await deletePrivacyZone(zone.id); await reapply(); }
            catch { Alert.alert(t('zones_remove_error')); }
          },
        },
      ],
    );
  };

  const changeRadius = async (zone: PrivacyZone, value: number) => {
    try { await updatePrivacyZoneRadius(zone.id, value); await reapply(); }
    catch { Alert.alert(t('zones_radius_error')); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings_privacy_zone')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.intro}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
          <Text style={styles.introText}>
            Dentro destas zonas, o teu percurso não aparece a mais ninguém. Tu continuas a
            ver o traçado completo nas tuas atividades.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : (
          <>
            {zones.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>{t('zones_yours')}</Text>
                {zones.map((zone) => (
                  <View key={zone.id} style={styles.zoneCard}>
                    <View style={styles.zoneHeader}>
                      <View style={styles.zoneIcon}>
                        <Ionicons name="home-outline" size={17} color={colors.primary} />
                      </View>
                      <Text style={styles.zoneLabel} numberOfLines={1}>{zone.label}</Text>
                      <TouchableOpacity onPress={() => confirmDelete(zone)} hitSlop={10}>
                        <Ionicons name="trash-outline" size={17} color={colors.destructive} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.radiusRow}>
                      {RADII.map((r) => (
                        <TouchableOpacity
                          key={r}
                          style={[styles.radiusChip, zone.radius === r && styles.radiusChipActive]}
                          onPress={() => changeRadius(zone, r)}
                        >
                          <Text
                            style={[styles.radiusText, zone.radius === r && styles.radiusTextActive]}
                          >
                            {r >= 1000 ? `${r / 1000} km` : `${r} m`}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ))}
              </>
            )}

            <Text style={styles.sectionTitle}>{t('zones_add')}</Text>

            <Text style={styles.label}>{t('zones_new_radius')}</Text>
            <View style={styles.radiusRow}>
              {RADII.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.radiusChip, radius === r && styles.radiusChipActive]}
                  onPress={() => setRadius(r)}
                >
                  <Text style={[styles.radiusText, radius === r && styles.radiusTextActive]}>
                    {r >= 1000 ? `${r / 1000} km` : `${r} m`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={addFromCurrentLocation}
              disabled={busy}
            >
              {busy
                ? <ActivityIndicator size="small" color={colors.primaryForeground} />
                : (
                  <>
                    <Ionicons name="locate" size={16} color={colors.primaryForeground} />
                    <Text style={styles.primaryBtnText}>{t('zones_use_current_location')}</Text>
                  </>
                )}
            </TouchableOpacity>

            <Text style={styles.orText}>{t('zones_or_address')}</Text>

            <View style={styles.addressRow}>
              <TextInput
                style={styles.input}
                placeholder={t('zones_address_placeholder')}
                placeholderTextColor={colors.mutedForeground}
                value={address}
                onChangeText={setAddress}
                returnKeyType="done"
                onSubmitEditing={addFromAddress}
              />
              <TouchableOpacity
                style={[styles.addBtn, !address.trim() && styles.addBtnOff]}
                onPress={addFromAddress}
                disabled={busy || !address.trim()}
              >
                <Ionicons name="add" size={20} color={colors.primaryForeground} />
              </TouchableOpacity>
            </View>

            {zones.length === 0 && (
              <Text style={styles.emptyNote}>
                Ainda não tens zonas. Se treinas a partir de casa, vale a pena criar uma —
                caso contrário o início e o fim dos teus percursos mostram onde vives.
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  headerTitle: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 18, color: colors.foreground },
  content: { padding: 16, paddingBottom: 48 },

  intro: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 14, borderRadius: 12,
    backgroundColor: withAlpha(colors.primary, 0.08),
  },
  introText: {
    ...typography.body, fontSize: 13, color: colors.foreground,
    flex: 1, lineHeight: 18,
  },

  sectionTitle: {
    fontFamily: 'Barlow_600SemiBold', fontSize: 12,
    color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1,
    marginTop: 26, marginBottom: 10,
  },
  label: {
    fontFamily: 'Barlow_600SemiBold', fontSize: 13,
    color: colors.foreground, marginBottom: 8,
  },

  zoneCard: {
    backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  zoneHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  zoneIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: withAlpha(colors.primary, 0.12),
    alignItems: 'center', justifyContent: 'center',
  },
  zoneLabel: { ...typography.bodyBold, fontSize: 15, color: colors.foreground, flex: 1 },

  radiusRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  radiusChip: {
    paddingHorizontal: 13, paddingVertical: 7, borderRadius: 16,
    backgroundColor: withAlpha(colors.foreground, 0.06),
  },
  radiusChipActive: { backgroundColor: colors.primary },
  radiusText: { fontFamily: 'DMMono_400Regular', fontSize: 12, color: colors.mutedForeground },
  radiusTextActive: { color: colors.primaryForeground },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 14,
    paddingVertical: 14, marginTop: 18,
  },
  primaryBtnText: { fontFamily: 'Barlow_600SemiBold', fontSize: 14, color: colors.primaryForeground },

  orText: {
    ...typography.body, fontSize: 12, color: colors.mutedForeground,
    textAlign: 'center', marginVertical: 14,
  },
  addressRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1, ...typography.body, fontSize: 15, color: colors.foreground,
    backgroundColor: colors.card, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  addBtn: {
    width: 46, borderRadius: 12, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  addBtnOff: { opacity: 0.4 },

  emptyNote: {
    ...typography.body, fontSize: 13, lineHeight: 19,
    color: colors.mutedForeground, marginTop: 24, textAlign: 'center',
  },
});
