import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { getMyUpcomingEvents } from '../../services/events';
import { colors, typography, withAlpha } from '../../lib/theme';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** Próximos encontros dos meus clubes, no ecrã Hoje. */
export function UpcomingEventsCard() {
  const { data: events = [] } = useQuery({
    queryKey: ['myEvents'],
    queryFn: () => getMyUpcomingEvents(3),
  });

  if (events.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Próximos eventos</Text>
        <TouchableOpacity style={styles.viewAll} onPress={() => router.push('/events')}>
          <Text style={styles.viewAllText}>Ver todos</Text>
          <Ionicons name="chevron-forward" size={12} color={colors.primary} />
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
              <Text style={styles.dateWeekday}>{WEEKDAYS[date.getDay()]}</Text>
              <Text style={styles.dateDay}>{date.getDate()}</Text>
              <Text style={styles.dateMonth}>{MONTHS[date.getMonth()]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>{event.title}</Text>
              <Text style={styles.meta} numberOfLines={1}>
                {date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                {event.club ? ` · ${event.club.name}` : ''}
                {event.location ? ` · ${event.location}` : ''}
              </Text>
            </View>
            {event.is_attending && (
              <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  sectionTitle: { ...typography.headline, fontSize: 18, color: colors.foreground },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: { fontFamily: 'Barlow_600SemiBold', fontSize: 12, color: colors.primary },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.card,
    borderRadius: 14, padding: 12, marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  dateBox: {
    width: 46, paddingVertical: 6, borderRadius: 10, alignItems: 'center',
    backgroundColor: withAlpha(colors.primary, 0.1),
  },
  dateWeekday: {
    fontFamily: 'Barlow_600SemiBold', fontSize: 9,
    color: colors.primary, textTransform: 'uppercase',
  },
  dateDay: {
    fontFamily: 'BarlowCondensed_900Black', fontSize: 20,
    color: colors.primary, lineHeight: 22,
  },
  dateMonth: {
    fontFamily: 'Barlow_500Medium', fontSize: 9,
    color: colors.primary, textTransform: 'uppercase',
  },
  title: { ...typography.bodyBold, fontSize: 14, color: colors.foreground },
  meta: { ...typography.body, fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
});
