import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIcon } from '../common/ActivityIcon';
import { attendEvent, leaveEvent, deleteClubEvent } from '../../services/events';
import { colors, typography, withAlpha } from '../../lib/theme';
import { MONTH_SHORT_KEYS } from '../../lib/constants';
import type { ClubEvent } from '../../lib/types';
import { useTranslation } from 'react-i18next';

/** Índice 0 = domingo, como o Date.getDay(). */
const WEEKDAY_KEYS = [
  'training_day_sun', 'training_day_mon', 'training_day_tue', 'training_day_wed',
  'training_day_thu', 'training_day_fri', 'training_day_sat',
];

interface EventCardProps {
  event: ClubEvent;
  /** Mostra o nome do clube (ecrã agregador de eventos). */
  showClub?: boolean;
  /** Permite inscrever-se — false para eventos passados ou não-membros. */
  canAttend?: boolean;
  canDelete?: boolean;
  onChanged?: () => void;
}

export function EventCard({
  event, showClub = false, canAttend = true, canDelete = false, onChanged,
}: EventCardProps) {
  const { t } = useTranslation();
  const [attending, setAttending] = useState(event.is_attending ?? false);
  const [count, setCount] = useState(event.attendee_count ?? 0);
  const [busy, setBusy] = useState(false);

  const date = new Date(event.starts_at);
  const isPast = date.getTime() < Date.now();

  const toggleAttend = async () => {
    if (busy) return;
    setBusy(true);
    const next = !attending;
    setAttending(next);
    setCount((c) => c + (next ? 1 : -1));
    try {
      if (next) await attendEvent(event.id);
      else await leaveEvent(event.id);
      onChanged?.();
    } catch {
      setAttending(!next);
      setCount((c) => c + (next ? -1 : 1));
      Alert.alert(t('event_attend_error'));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(t('event_delete'), t('event_delete_confirm', { title: event.title }), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive',
        onPress: async () => {
          try {
            await deleteClubEvent(event.id);
            onChanged?.();
          } catch {
            Alert.alert(t('event_delete_error'));
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.card, isPast && styles.cardPast]}>
      {/* Data */}
      <View style={[styles.dateBox, isPast && styles.dateBoxPast]}>
        <Text style={[styles.dateWeekday, isPast && styles.mutedText]}>{t(WEEKDAY_KEYS[date.getDay()])}</Text>
        <Text style={[styles.dateDay, isPast && styles.mutedText]}>{date.getDate()}</Text>
        <Text style={[styles.dateMonth, isPast && styles.mutedText]}>{t(MONTH_SHORT_KEYS[date.getMonth()])}</Text>
      </View>

      {/* Conteúdo */}
      <View style={styles.content}>
        {showClub && event.club && (
          <TouchableOpacity onPress={() => router.push(`/club/${event.club!.id}`)}>
            <Text style={styles.clubName} numberOfLines={1}>{event.club.name}</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title} numberOfLines={2}>{event.title}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={12} color={colors.mutedForeground} />
            <Text style={styles.metaText}>
              {date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          {!!event.location && (
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={12} color={colors.mutedForeground} />
              <Text style={styles.metaText} numberOfLines={1}>{event.location}</Text>
            </View>
          )}
          {!!event.activity_type && (
            <View style={styles.metaItem}>
              <ActivityIcon activityKey={event.activity_type} size={12} tintColor={colors.mutedForeground} />
              {!!event.distance && (
                <Text style={styles.metaText}>{(event.distance / 1000).toFixed(1)} km</Text>
              )}
            </View>
          )}
        </View>

        {!!event.description && (
          <Text style={styles.desc} numberOfLines={2}>{event.description}</Text>
        )}

        <View style={styles.footer}>
          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={12} color={colors.mutedForeground} />
            <Text style={styles.metaText}>
              {count} {count === 1 ? 'inscrito' : 'inscritos'}
            </Text>
          </View>

          <View style={{ flex: 1 }} />

          {canDelete && (
            <TouchableOpacity onPress={confirmDelete} hitSlop={8} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={16} color={colors.destructive} />
            </TouchableOpacity>
          )}

          {canAttend && !isPast && (
            <TouchableOpacity
              style={[styles.attendBtn, attending && styles.attendBtnActive]}
              onPress={toggleAttend}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator size="small" color={attending ? colors.primary : colors.primaryForeground} />
              ) : (
                <Text style={[styles.attendText, attending && styles.attendTextActive]}>
                  {attending ? 'Inscrito' : 'Vou'}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  cardPast: { opacity: 0.72 },

  dateBox: {
    width: 52,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: withAlpha(colors.primary, 0.1),
  },
  dateBoxPast: { backgroundColor: withAlpha(colors.foreground, 0.06) },
  dateWeekday: {
    fontFamily: 'Barlow_600SemiBold', fontSize: 10,
    color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  dateDay: {
    fontFamily: 'BarlowCondensed_900Black', fontSize: 24,
    color: colors.primary, lineHeight: 26,
  },
  dateMonth: {
    fontFamily: 'Barlow_500Medium', fontSize: 10,
    color: colors.primary, textTransform: 'uppercase',
  },
  mutedText: { color: colors.mutedForeground },

  content: { flex: 1, minWidth: 0 },
  clubName: {
    fontFamily: 'Barlow_600SemiBold', fontSize: 11,
    color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: 2,
  },
  title: { ...typography.bodyBold, fontSize: 15, color: colors.foreground, marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  metaText: { ...typography.body, fontSize: 12, color: colors.mutedForeground },
  desc: { ...typography.body, fontSize: 13, color: colors.mutedForeground, marginTop: 6, lineHeight: 18 },

  footer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  deleteBtn: { padding: 4 },
  attendBtn: {
    paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.primary,
    minWidth: 72, alignItems: 'center',
  },
  attendBtnActive: {
    backgroundColor: withAlpha(colors.primary, 0.12),
    borderWidth: 1, borderColor: withAlpha(colors.primary, 0.35),
  },
  attendText: { fontFamily: 'Barlow_600SemiBold', fontSize: 12, color: colors.primaryForeground },
  attendTextActive: { color: colors.primary },
});
