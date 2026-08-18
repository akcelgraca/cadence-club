import { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Switch, Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../services/supabase';
import { typography } from '../../lib/theme';
import { useColors } from '../../hooks/useColors';
import { useAppTranslation } from '../../hooks/useAppTranslation';
import { useHealthSync } from '../../hooks/useHealthSync';
import { setPickerConfig } from './settings/picker';
import type {
  IntensityPreference,
  UnitSystem,
  ActivityPrivacy,
  GpsAccuracy,
  ThemeMode,
} from '../../lib/types';
import type { MapboxStyleKey } from '../../components/map/MapViewWrapper';

// ============================================================
// Main Screen
// ============================================================

export default function SettingsScreen() {
  const c = useColors();
  const { t } = useAppTranslation();
  const { settings, loadSettings, updateSettings } = useSettingsStore();
  const { profile, updateProfile, session } = useAuthStore();
  const [isPublic, setIsPublic] = useState(profile?.is_public ?? true);
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [isChangingEmail, setIsChangingEmail] = useState(false);

  const health = useHealthSync();
  const styles = useMemo(() => createStyles(c), [c]);

  useEffect(() => {
    loadSettings();
  }, []);

  const openPicker = useCallback(
    (title: string, options: { key: string; label: string; icon?: string }[], current: string, onChange: (key: string) => void) => {
      setPickerConfig({ title, options, selectedKey: current, onSelect: onChange });
      router.push('/profile/settings/picker');
    },
    [],
  );

  // --- Option arrays (inside component for t() access) ---

  const INTENSITY_OPTIONS: { key: IntensityPreference; label: string; icon: string }[] = useMemo(() => [
    { key: 'leve', label: t('settings_intensity_light'), icon: 'walk-outline' },
    { key: 'moderado', label: t('settings_intensity_moderate'), icon: 'speedometer-outline' },
    { key: 'intenso', label: t('settings_intensity_intense'), icon: 'flash-outline' },
  ], [t]);

  const UNIT_OPTIONS: { key: UnitSystem; label: string }[] = useMemo(() => [
    { key: 'metric', label: t('settings_units_metric') },
    { key: 'imperial', label: t('settings_units_imperial') },
  ], [t]);

  const PRIVACY_OPTIONS: { key: ActivityPrivacy; label: string }[] = useMemo(() => [
    { key: 'everyone', label: t('settings_privacy_everyone') },
    { key: 'followers', label: t('settings_privacy_followers') },
    { key: 'only_me', label: t('settings_privacy_only_me') },
  ], [t]);

  const GPS_OPTIONS: { key: GpsAccuracy; label: string }[] = useMemo(() => [
    { key: 'high', label: t('settings_gps_high') },
    { key: 'balanced', label: t('settings_gps_balanced') },
    { key: 'low', label: t('settings_gps_low') },
  ], [t]);

  const THEME_OPTIONS: { key: ThemeMode; label: string }[] = useMemo(() => [
    { key: 'dark', label: t('settings_theme_dark') },
    { key: 'light', label: t('settings_theme_light') },
    { key: 'system', label: t('settings_theme_system') },
  ], [t]);

  const MAP_STYLE_OPTIONS: { key: MapboxStyleKey; label: string }[] = useMemo(() => [
    { key: 'dark', label: t('settings_map_dark') },
    { key: 'light', label: t('settings_map_light') },
    { key: 'streets', label: t('settings_map_streets') },
    { key: 'satellite', label: t('settings_map_satellite') },
    { key: 'outdoors', label: t('settings_map_outdoors') },
  ], [t]);

  const LANGUAGE_OPTIONS: { key: 'pt' | 'en'; label: string }[] = useMemo(() => [
    { key: 'pt', label: t('settings_language_pt') },
    { key: 'en', label: t('settings_language_en') },
  ], [t]);

  // --- Sincronização com a Saúde ---

  const handleHealthPress = async () => {
    if (!health.isConnected) {
      const ligou = await health.connect();
      if (!ligou) {
        Alert.alert(
          t('health_sync_denied_title'),
          t('health_sync_denied_body', { platform: health.platformName }),
        );
      }
      return;
    }

    const resultado = await health.sync();
    if (!resultado) return;

    // Uma falha tem de se ver. Sem isto, um erro aparecia como "não havia
    // treinos novos" — a mesma mentira que os stubs antigos contavam.
    if (resultado.error) {
      Alert.alert(t('health_sync_error_title'), resultado.error);
      return;
    }

    const importados = resultado.imported === 0
      ? t('health_sync_imported_none')
      : resultado.imported === 1
        ? t('health_sync_imported_one')
        : t('health_sync_imported_other', { count: resultado.imported });

    // Discriminar o motivo é o que distingue "não havia nada" de "havia e foi
    // tudo descartado por engano".
    const motivos = (Object.entries(resultado.skippedReasons) as [string, number][])
      .filter(([, n]) => n > 0)
      .map(([razao, n]) => t(`health_skip_${razao}` as any, { count: n }));

    const detalhe = motivos.length > 0
      ? `\n\n${t('health_sync_skipped_intro')} ${motivos.join(', ')}.`
      : '';

    // Nada importado E nada descartado significa que não se leu um único
    // treino. Ou não há mesmo nenhum, ou a permissão foi revogada — e a Apple
    // não deixa distinguir os dois casos (ver hasPermissions em adapters.ts).
    // Se algo foi descartado, houve leitura e a permissão está boa; aí a dica
    // seria ruído.
    const nadaLido = resultado.imported === 0 && resultado.skipped === 0;
    const dica = nadaLido
      ? `\n\n${t('health_sync_check_permissions', { platform: health.platformName })}`
      : '';

    Alert.alert(t('health_sync_result_title'), importados + detalhe + dica);
  };

  const handleSeedPress = async () => {
    const r = await health.seedAndSync();
    if (r.error) {
      Alert.alert(t('health_sync_error_title'), r.error);
      return;
    }
    const importados = r.outcome?.imported ?? 0;
    const motivos = r.outcome
      ? (Object.entries(r.outcome.skippedReasons) as [string, number][])
          .filter(([, n]) => n > 0)
          .map(([razao, n]) => t(`health_skip_${razao}` as any, { count: n }))
      : [];

    Alert.alert(
      t('health_sync_result_title'),
      t('health_seed_result', { seeded: r.seeded })
        + '\n' + t('health_sync_imported_other', { count: importados })
        + (motivos.length > 0 ? `\n\n${t('health_sync_skipped_intro')} ${motivos.join(', ')}.` : ''),
    );
  };

  // --- Profile & Account handlers ---

  const handlePublicProfileChange = async (value: boolean) => {
    setIsPublic(value);
    try {
      await updateProfile({ is_public: value });
    } catch {
      setIsPublic(!value);
    }
  };

  const handleChangePassword = async () => {
    const email = session?.user?.email;
    if (!email) {
      Alert.alert(t('settings_password_error'), t('settings_email_not_found'));
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      Alert.alert(t('settings_password_success'), t('settings_password_sent'));
    } catch (err: any) {
      Alert.alert(t('settings_password_error'), err.message || t('settings_password_error_generic'));
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('settings_delete_confirm_title'),
      t('settings_delete_confirm_message'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(t('settings_delete_info'), t('settings_delete_wip'));
          },
        },
      ]
    );
  };

  const openLink = (url: string) => {
    WebBrowser.openBrowserAsync(url);
  };

  const handleStub = () => {
    Alert.alert(t('settings_wip_info'), t('settings_wip_message'));
  };

  const handleChangeEmail = () => {
    setNewEmail('');
    setEmailModalVisible(true);
  };

  const submitEmailChange = async () => {
    const trimmed = newEmail.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      Alert.alert(t('settings_email_change_error'), t('settings_email_invalid'));
      return;
    }
    setIsChangingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: trimmed });
      if (error) throw error;
      setEmailModalVisible(false);
      Alert.alert(t('settings_email_change_success_title'), t('settings_email_change_success_message'));
    } catch (err: any) {
      Alert.alert(t('settings_email_change_error'), err.message || t('settings_password_error_generic'));
    } finally {
      setIsChangingEmail(false);
    }
  };

  // --- Main render ---

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Section 1: Perfil & Conta */}
      <SectionTitle title={t('settings_profile_account')} styles={styles} />
      <View style={styles.card}>
        <LinkRow label={t('settings_equipment')} onPress={() => router.push('/profile/equipment')} colors={c} />
        <Separator styles={styles} />
        <LinkRow label={t('settings_training_preferences')} onPress={() => router.push('/profile/questionnaire')} colors={c} />
        <Separator styles={styles} />
        <LinkRow label={t('settings_change_email')} onPress={handleChangeEmail} colors={c} />
        <Separator styles={styles} />
        <SwitchRow
          label={t('settings_two_factor')}
          value={false}
          onValueChange={handleStub}
          styles={styles}
          colors={c}
        />
        <Separator styles={styles} />
        <LinkRow label={t('settings_change_password')} onPress={handleChangePassword} colors={c} />
      </View>

      {/* Section 2: Rastreamento & Dispositivos */}
      <SectionTitle title={t('settings_tracking_devices')} styles={styles} />
      <View style={styles.card}>
        {/* Só aparece onde a plataforma o suporta — oferecer um botão que não
            faz nada foi exatamente o problema dos stubs antigos. */}
        {health.isAvailable && (
          <>
            <TouchableOpacity
              style={styles.linkRow}
              onPress={handleHealthPress}
              disabled={health.isSyncing || health.isChecking}
              activeOpacity={0.6}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.linkLabel}>{t('health_sync_row')}</Text>
                <Text style={styles.linkSub}>{health.platformName}</Text>
              </View>
              {health.isSyncing
                ? <ActivityIndicator size="small" color={c.primary} />
                : (
                  <Text style={[styles.rowLabel, { color: c.primary }]}>
                    {health.isConnected ? t('health_sync_now') : t('health_sync_connect')}
                  </Text>
                )}
            </TouchableOpacity>
            <Separator styles={styles} />
          </>
        )}

        {/* Um Apple Watch não se emparelha com o simulador — este atalho é a
            única forma de lá pôr treinos. Nunca aparece em produção. */}
        {health.canSeed && (
          <>
            <TouchableOpacity
              style={styles.linkRow}
              onPress={handleSeedPress}
              disabled={health.isSyncing}
              activeOpacity={0.6}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.linkLabel}>{t('health_seed_row')}</Text>
                <Text style={styles.linkSub}>{t('health_seed_sub')}</Text>
              </View>
              {health.isSyncing
                ? <ActivityIndicator size="small" color={c.primary} />
                : <Ionicons name="flask-outline" size={18} color={c.mutedForeground} />}
            </TouchableOpacity>
            <Separator styles={styles} />
          </>
        )}

        <SwitchRow
          label={t('settings_auto_pause')}
          value={settings.autoPause}
          onValueChange={(val) => updateSettings({ autoPause: val })}
          styles={styles}
          colors={c}
        />

        <Separator styles={styles} />

        <SwitchRow
          label={t('settings_voice_feedback')}
          value={settings.voiceFeedback}
          onValueChange={(val) => updateSettings({ voiceFeedback: val })}
          styles={styles}
          colors={c}
        />

        <Separator styles={styles} />

        <SelectRow
          label={t('settings_gps_accuracy')}
          onPress={() =>
            openPicker(
              t('settings_gps_accuracy'),
              GPS_OPTIONS,
              settings.gpsAccuracy,
              (val) => updateSettings({ gpsAccuracy: val as GpsAccuracy }),
            )
          }
          colors={c}
        />
      </View>

      {/* Section 3: Notificacoes */}
      <SectionTitle title={t('settings_notifications')} styles={styles} />
      <View style={styles.card}>
        <SwitchRow
          label={t('settings_notif_boosts')}
          value={settings.notifications.boosts}
          onValueChange={() =>
            updateSettings({
              notifications: { ...settings.notifications, boosts: !settings.notifications.boosts },
            })
          }
          styles={styles}
          colors={c}
        />
        <Separator styles={styles} />
        <SwitchRow
          label={t('settings_notif_comments')}
          value={settings.notifications.comments}
          onValueChange={() =>
            updateSettings({
              notifications: {
                ...settings.notifications,
                comments: !settings.notifications.comments,
              },
            })
          }
          styles={styles}
          colors={c}
        />
        <Separator styles={styles} />
        <SwitchRow
          label={t('settings_notif_follows')}
          value={settings.notifications.follows}
          onValueChange={() =>
            updateSettings({
              notifications: {
                ...settings.notifications,
                follows: !settings.notifications.follows,
              },
            })
          }
          styles={styles}
          colors={c}
        />
        <Separator styles={styles} />
        <SwitchRow
          label={t('settings_notif_streaks')}
          value={settings.notifications.streaks}
          onValueChange={() =>
            updateSettings({
              notifications: {
                ...settings.notifications,
                streaks: !settings.notifications.streaks,
              },
            })
          }
          styles={styles}
          colors={c}
        />
        <Separator styles={styles} />
        <SwitchRow
          label={t('settings_notif_badges')}
          value={settings.notifications.badges}
          onValueChange={() =>
            updateSettings({
              notifications: {
                ...settings.notifications,
                badges: !settings.notifications.badges,
              },
            })
          }
          styles={styles}
          colors={c}
        />
        <Separator styles={styles} />
        <SwitchRow
          label={t('settings_weekly_summaries')}
          value={settings.weeklySummaryNotifications}
          onValueChange={(val) => updateSettings({ weeklySummaryNotifications: val })}
          styles={styles}
          colors={c}
        />
        <Separator styles={styles} />
        <SwitchRow
          label={t('settings_training_reminders')}
          value={settings.trainingReminderNotifications}
          onValueChange={(val) => updateSettings({ trainingReminderNotifications: val })}
          styles={styles}
          colors={c}
        />
      </View>

      {/* Section 4: Preferencias do App */}
      <SectionTitle title={t('settings_app_preferences')} styles={styles} />
      <View style={styles.card}>
        <SelectRow
          label={t('settings_intensity')}
          onPress={() =>
            openPicker(
              t('settings_intensity'),
              INTENSITY_OPTIONS,
              settings.intensity,
              (val) => updateSettings({ intensity: val as IntensityPreference }),
            )
          }
          colors={c}
        />

        <Separator styles={styles} />

        <SelectRow
          label={t('settings_units')}
          onPress={() =>
            openPicker(
              t('settings_units'),
              UNIT_OPTIONS,
              settings.unitSystem,
              (val) => updateSettings({ unitSystem: val as UnitSystem }),
            )
          }
          colors={c}
        />

        <Separator styles={styles} />

        <SelectRow
          label={t('settings_theme')}
          onPress={() =>
            openPicker(
              t('settings_theme'),
              THEME_OPTIONS,
              settings.theme,
              (val) => updateSettings({ theme: val as ThemeMode }),
            )
          }
          colors={c}
        />

        <Separator styles={styles} />

        <SelectRow
          label={t('settings_map_style')}
          onPress={() =>
            openPicker(
              t('settings_map_style'),
              MAP_STYLE_OPTIONS,
              settings.defaultMapStyle,
              (val) => updateSettings({ defaultMapStyle: val as MapboxStyleKey }),
            )
          }
          colors={c}
        />

        <Separator styles={styles} />

        <SelectRow
          label={t('settings_language')}
          onPress={() =>
            openPicker(
              t('settings_language'),
              LANGUAGE_OPTIONS,
              settings.language,
              (val) => updateSettings({ language: val as 'pt' | 'en' }),
            )
          }
          colors={c}
        />
      </View>

      {/* Section 5: Privacidade & Seguranca */}
      <SectionTitle title={t('settings_privacy_security')} styles={styles} />
      <View style={styles.card}>
        <SelectRow
          label={t('settings_default_activity_privacy')}
          onPress={() =>
            openPicker(
              t('settings_default_activity_privacy'),
              PRIVACY_OPTIONS,
              settings.defaultActivityPrivacy,
              (val) => updateSettings({ defaultActivityPrivacy: val as ActivityPrivacy }),
            )
          }
          colors={c}
        />

        <Separator styles={styles} />

        {/* As zonas vivem no servidor (migração 040) — o interruptor local
            que existia aqui não protegia nada. */}
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => router.push('/profile/privacy-zones')}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.linkLabel}>{t('settings_privacy_zone')}</Text>
            <Text style={styles.linkSub}>
              {t('settings_privacy_zone_hint')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.mutedForeground} />
        </TouchableOpacity>

        <Separator styles={styles} />

        <SwitchRow
          label={t('settings_public_profile')}
          value={isPublic}
          onValueChange={handlePublicProfileChange}
          styles={styles}
          colors={c}
        />

        <Separator styles={styles} />

        <SwitchRow
          label={t('settings_show_stats')}
          value={settings.showStats}
          onValueChange={(val) => updateSettings({ showStats: val })}
          styles={styles}
          colors={c}
        />

        <Separator styles={styles} />

        <LinkRow label={t('settings_export_data')} onPress={handleStub} colors={c} />
        <Separator styles={styles} />
        <LinkRow label={t('settings_delete_account')} onPress={handleDeleteAccount} destructive colors={c} />
      </View>

      {/* Section 6: Suporte & Sobre */}
      <SectionTitle title={t('settings_support_about')} styles={styles} />
      <View style={styles.card}>
        <LinkRow
          label={t('settings_help_center')}
          onPress={() => openLink('https://cadenceclub.app/help')}
          icon="open-outline"
          colors={c}
        />
        <Separator styles={styles} />
        <LinkRow
          label={t('settings_report_problem')}
          onPress={() => openLink('https://cadenceclub.app/feedback')}
          icon="open-outline"
          colors={c}
        />
        <Separator styles={styles} />
        <LinkRow
          label={t('settings_terms')}
          onPress={() => openLink('https://cadenceclub.app/terms')}
          colors={c}
        />
        <Separator styles={styles} />
        <LinkRow
          label={t('settings_privacy_policy')}
          onPress={() => openLink('https://cadenceclub.app/privacy')}
          colors={c}
        />
        <Separator styles={styles} />
        <View style={styles.linkRow}>
          <Text style={styles.linkRowText}>{t('settings_app_version')}</Text>
          <Text style={styles.versionText}>
            {Constants.expoConfig?.version ?? '1.0.0'}
          </Text>
        </View>
      </View>

      <View style={styles.bottomSpacer} />

      {/* Change Email Modal */}
      <Modal
        visible={emailModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEmailModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('settings_email_change_title')}</Text>
            <Text style={styles.modalMessage}>{t('settings_email_change_message')}</Text>
            <TextInput
              style={styles.modalInput}
              value={newEmail}
              onChangeText={setNewEmail}
              placeholder={t('settings_email_change_placeholder')}
              placeholderTextColor={c.mutedForeground}
              autoCapitalize="none"
              keyboardType="email-address"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setEmailModalVisible(false)}
                disabled={isChangingEmail}
              >
                <Text style={styles.modalBtnCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnConfirm, isChangingEmail && { opacity: 0.6 }]}
                onPress={submitEmailChange}
                disabled={isChangingEmail}
              >
                <Text style={styles.modalBtnConfirmText}>{t('save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

// ============================================================
// Reusable Sub-Components
// ============================================================

function SectionTitle({ title, styles }: { title: string; styles: ReturnType<typeof createStyles> }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function Separator({ styles }: { styles: ReturnType<typeof createStyles> }) {
  return <View style={styles.separator} />;
}

function LinkRow({
  label,
  onPress,
  destructive,
  icon,
  colors: c,
}: {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  icon?: any;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <TouchableOpacity style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }} onPress={onPress}>
      <Text style={[{ fontFamily: 'Barlow_400Regular', fontSize: 15, color: c.foreground }, destructive && { color: c.destructive }]}>{label}</Text>
      <Ionicons
        name={icon ?? 'chevron-forward'}
        size={18}
        color={destructive ? c.destructive : c.mutedForeground}
      />
    </TouchableOpacity>
  );
}

function SelectRow({
  label,
  onPress,
  colors: c,
}: {
  label: string;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <TouchableOpacity
      style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}
      onPress={onPress}
    >
      <Text style={{ fontFamily: 'Barlow_400Regular', fontSize: 15, color: c.foreground }}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={c.mutedForeground} />
    </TouchableOpacity>
  );
}

function SwitchRow({
  label,
  value,
  onValueChange,
  styles,
  colors: c,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: c.border, true: c.primary }}
      />
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

function createStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 24 },
    sectionTitle: {
      ...typography.headline,
      fontSize: 18,
      color: c.primary,
      marginTop: 24,
      marginBottom: 12,
      letterSpacing: 1,
    },
    card: {
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 16,
    },
    rowLabel: { ...typography.body, fontSize: 14, color: c.foreground },
    subLabel: {
      ...typography.body,
      fontSize: 13,
      color: c.mutedForeground,
      marginTop: 8,
      marginBottom: 6,
    },
    chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 8,
      gap: 6,
    },
    chipSelected: { borderColor: c.primary, backgroundColor: c.inputBackground },
    chipLabel: { ...typography.bodyMedium, fontSize: 13, color: c.mutedForeground },
    chipLabelSelected: { color: c.primary },
    separator: { height: 1, backgroundColor: c.border, marginVertical: 14 },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
    },
    switchLabel: { ...typography.body, fontSize: 15, color: c.foreground },
    linkRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
    },
    linkRowText: { ...typography.body, fontSize: 15, color: c.foreground },
    linkLabel: { ...typography.body, fontSize: 15, color: c.foreground },
    linkSub: {
      ...typography.body,
      fontSize: 12,
      color: c.mutedForeground,
      marginTop: 2,
      lineHeight: 16,
      paddingRight: 12,
    },
    versionText: { ...typography.mono, fontSize: 13, color: c.mutedForeground },
    bottomSpacer: { height: 40 },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    modalCard: {
      backgroundColor: c.card,
      borderRadius: 16,
      padding: 24,
      width: '100%',
    },
    modalTitle: {
      ...typography.headline,
      fontSize: 18,
      color: c.foreground,
      marginBottom: 8,
    },
    modalMessage: {
      ...typography.body,
      fontSize: 14,
      color: c.mutedForeground,
      marginBottom: 16,
    },
    modalInput: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      fontFamily: 'Barlow_400Regular',
      color: c.foreground,
      backgroundColor: c.inputBackground,
      marginBottom: 20,
    },
    modalButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    modalBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
    },
    modalBtnCancel: {
      backgroundColor: c.inputBackground,
      borderWidth: 1,
      borderColor: c.border,
    },
    modalBtnCancelText: {
      ...typography.bodyMedium,
      fontSize: 15,
      color: c.mutedForeground,
    },
    modalBtnConfirm: {
      backgroundColor: c.primary,
    },
    modalBtnConfirmText: {
      ...typography.bodyMedium,
      fontSize: 15,
      color: '#fff',
    },
  });
}
