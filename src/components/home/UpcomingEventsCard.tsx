import { useMemo } from 'react';
import { localeTag } from '../../utils/dateHelpers';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useColors } from '../../hooks/useColors';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { getMyUpcomingEvents } from '../../services/events';
import { typography, withAlpha, type Colors } from '../../lib/theme';
import { useTranslation } from 'react-i18next';
import { MONTH_SHORT_KEYS } from '../../lib/constants';

/** Índice 0 = domingo, como o Date.getDay(). */
const WEEKDAY_KEYS = [
  'training_day_sun', 'training_day_mon', 'training_day_tue', 'training_day_wed',
  'training_day_thu', 'training_day_fri', 'training_day_sat',
];

/** Próximos encontros dos meus clubes, no ecrã Hoje. */
export function UpcomingEventsCard() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
  const { data: events = [] } = useQuery({
    queryKey: ['myEvents'],
    queryFn: () => getMyUpcomingEvents(3),
  });

  if (events.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('home_upcoming_events')}</Text>
        <TouchableOpacity style={styles.viewAll} onPress={() => router.push('/events')}>
          <Text style={styles.viewAllText}>{t('view_all')}</Text>
          <Ionicons name="chevron-forward" size={12} color={c.primary} />
        </TouchableOpacity>
      </View>

      {events.slice(0, 3).map((event) => {
        const date = new Date(event.starts_at);
        return (
          <TouchableOpacity
            key={event.id}
            style={styles.row}
            onPress={() => router.push('/events')}
            activeOpacity={0.8}
          >
            <View style={styles.dateBox}>
              <Text style={styles.dateWeekday}>{t(WEEKDAY_KEYS[date.getDay()] as any)}</Text>
              <Text style={styles.dateDay}>{date.getDate()}</Text>
              <Text style={styles.dateMonth}>{t(MONTH_SHORT_KEYS[date.getMonth()] as any)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>{event.title}</Text>
              <Text style={styles.meta} numberOfLines={1}>
                {date.toLocaleTimeString(localeTag(), { hour: '2-digit', minute: '2-digit' })}
                {event.club ? ` · ${event.club.name}` : ''}
                {event.location ? ` · ${event.location}` : ''}
              </Text>
            </View>
            {event.is_attending && (
              <Ionicons name="checkmark-circle" size={18} color={c.primary} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  wrapper: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  sectionTitle: { ...typography.headline, fontSize: 18, color: c.foreground },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: { fontFamily: 'Barlow_600SemiBold', fontSize: 12, color: c.primary },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: c.card,
    borderRadius: 14, padding: 12, marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
  },
  dateBox: {
    width: 46, paddingVertical: 6, borderRadius: 10, alignItems: 'center',
    backgroundColor: withAlpha(c.primary, 0.1),
  },
  dateWeekday: {
    fontFamily: 'Barlow_600SemiBold', fontSize: 9,
    color: c.primary, textTransform: 'uppercase',
  },
  dateDay: {
    fontFamily: 'BarlowCondensed_900Black', fontSize: 20,
    color: c.primary, lineHeight: 22,
  },
  dateMonth: {
    fontFamily: 'Barlow_500Medium', fontSize: 9,
    color: c.primary, textTransform: 'uppercase',
  },
  title: { ...typography.bodyBold, fontSize: 14, color: c.foreground },
  meta: { ...typography.body, fontSize: 12, color: c.mutedForeground, marginTop: 2 },
});
