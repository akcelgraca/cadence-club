import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useColors } from '../../hooks/useColors';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { getActiveChallenges, formatChallengeValue } from '../../services/challenges';
import { typography, withAlpha, type Colors } from '../../lib/theme';
import type { Challenge } from '../../lib/types';
import { useTranslation } from 'react-i18next';

/**
 * Resumo dos desafios no ecrã Hoje: mostra o desafio em que participo com mais
 * progresso; se ainda não participo em nenhum, convida a começar.
 */
export function ChallengesCard() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
  const { data: challenges = [] } = useQuery({
    queryKey: ['activeChallenges'],
    queryFn: getActiveChallenges,
  });

  if (challenges.length === 0) return null;

  const joined = challenges.filter((c) => c.joined);
  const featured: Challenge | undefined = joined.length > 0
    ? joined.reduce((best, c) =>
        (c.my_progress / (c.goal || 1)) > (best.my_progress / (best.goal || 1)) ? c : best)
    : undefined;

  return (
    <View style={styles.wrapper}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('challenges_title')}</Text>
        <TouchableOpacity style={styles.viewAll} onPress={() => router.push('/challenges')}>
          <Text style={styles.viewAllText}>{t('view_all')}</Text>
          <Ionicons name="chevron-forward" size={12} color={c.primary} />
        </TouchableOpacity>
      </View>

      {featured ? (
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push('/challenges')}
          activeOpacity={0.8}
        >
          <View style={styles.cardHeader}>
            <View style={styles.iconWrap}>
              <Ionicons name="trophy" size={16} color={c.primary} />
            </View>
            <Text style={styles.cardTitle} numberOfLines={1}>{t(featured.name as any)}</Text>
          </View>

          <View style={styles.progressRow}>
            <Text style={styles.progressValue}>
              {formatChallengeValue(featured.my_progress, featured.type)}
              <Text style={styles.progressGoal}>
                {' '}/ {formatChallengeValue(featured.goal, featured.type)}
              </Text>
            </Text>
            <Text style={styles.progressPct}>
              {Math.round(Math.min(1, featured.my_progress / (featured.goal || 1)) * 100)}%
            </Text>
          </View>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                { width: `${Math.min(1, featured.my_progress / (featured.goal || 1)) * 100}%` },
              ]}
            />
          </View>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.inviteCard}
          onPress={() => router.push('/challenges')}
          activeOpacity={0.8}
        >
          <View style={styles.iconWrap}>
            <Ionicons name="trophy-outline" size={18} color={c.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.inviteTitle}>
              {t('challenges_active', { count: challenges.length })}
            </Text>
            <Text style={styles.inviteSub}>{t('challenges_card_body')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={c.mutedForeground} />
        </TouchableOpacity>
      )}
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

  card: {
    backgroundColor: c.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  iconWrap: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: withAlpha(c.primary, 0.12),
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { ...typography.bodyBold, fontSize: 15, color: c.foreground, flex: 1 },

  progressRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 },
  progressValue: { fontFamily: 'BarlowCondensed_900Black', fontSize: 20, color: c.foreground },
  progressGoal: { fontFamily: 'Barlow_500Medium', fontSize: 12, color: c.mutedForeground },
  progressPct: { fontFamily: 'DMMono_400Regular', fontSize: 12, color: c.primary },
  track: {
    height: 6, borderRadius: 3,
    backgroundColor: withAlpha(c.foreground, 0.08),
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3, backgroundColor: c.primary },

  inviteCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: c.card,
    borderRadius: 16, padding: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
  },
  inviteTitle: { ...typography.bodyBold, fontSize: 15, color: c.foreground },
  inviteSub: { ...typography.body, fontSize: 12, color: c.mutedForeground, marginTop: 2 },
});
