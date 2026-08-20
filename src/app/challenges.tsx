import { useCallback, useMemo } from 'react';
import { useColors } from '../hooks/useColors';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';

import { useFocusEffect } from 'expo-router/react-navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import {
  getChallenges, joinChallenge, leaveChallenge, formatChallengeValue,
} from '../services/challenges';
import { typography, withAlpha, type Colors } from '../lib/theme';
import type { Challenge } from '../lib/types';
import { useTranslation } from 'react-i18next';
import { goBackOr } from '../lib/navigation';

function daysLeft(endDate: string): number {
  const end = new Date(`${endDate}T23:59:59`);
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000));
}

export function ChallengeRow({ challenge, onChanged }: { challenge: Challenge; onChanged: () => void }) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
  const isOver = daysLeft(challenge.end_date) === 0;
  // Meta da comunidade: progresso coletivo; restantes: progresso individual
  // Vem da coluna `is_collective` (migração 048). Antes era adivinhado com
  // `name.includes('comunidade')`, que morria assim que o nome passasse a ser
  // uma chave de tradução — e morria em silêncio.
  const isCollective = challenge.is_collective === true;
  const value = isCollective ? challenge.community_progress : challenge.my_progress;
  const pct = challenge.goal > 0 ? Math.min(1, value / challenge.goal) : 0;

  const toggle = async () => {
    try {
      if (challenge.joined) await leaveChallenge(challenge.id);
      else await joinChallenge(challenge.id);
      onChanged();
    } catch {
      Alert.alert(t('challenges_update_error'));
    }
  };

  return (
    <View style={[styles.card, isOver && styles.cardOver]}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{t(challenge.name as any)}</Text>
          <Text style={styles.cardDesc}>{t(challenge.description as any)}</Text>
        </View>
        {isCollective && (
          <View style={styles.collectivePill}>
            <Ionicons name="people" size={11} color={c.primary} />
            <Text style={styles.collectiveText}>{t('challenge_collective')}</Text>
          </View>
        )}
      </View>

      {/* Progresso */}
      <View style={styles.progressHeader}>
        <Text style={styles.progressValue}>
          {formatChallengeValue(value, challenge.type)}
          <Text style={styles.progressGoal}>
            {' '}/ {formatChallengeValue(challenge.goal, challenge.type)}
          </Text>
        </Text>
        <Text style={styles.progressPct}>{Math.round(pct * 100)}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
      </View>

      {/* Rodapé */}
      <View style={styles.cardFooter}>
        <View style={styles.footerMeta}>
          <Ionicons name="people-outline" size={12} color={c.mutedForeground} />
          <Text style={styles.footerText}>{challenge.participants}</Text>
        </View>
        <View style={styles.footerMeta}>
          <Ionicons name="time-outline" size={12} color={c.mutedForeground} />
          <Text style={styles.footerText}>
            {isOver ? t('challenge_over') : t('challenge_days_left', { n: daysLeft(challenge.end_date) })}
          </Text>
        </View>
        {isCollective && challenge.joined && (
          <Text style={styles.footerText}>
            {t('challenge_your_contribution', { value: formatChallengeValue(challenge.my_progress, challenge.type) })}
          </Text>
        )}
        <View style={{ flex: 1 }} />
        {!isOver && (
          <TouchableOpacity
            style={[styles.joinBtn, challenge.joined && styles.joinBtnActive]}
            onPress={toggle}
          >
            <Text style={[styles.joinText, challenge.joined && styles.joinTextActive]}>
              {challenge.joined ? t('challenge_joined') : t('challenge_join')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function ChallengesScreen() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
  const { data: challenges = [], isLoading, refetch } = useQuery({
    queryKey: ['challenges'],
    queryFn: getChallenges,
  });

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOr('/(tabs)')} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={c.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('challenges_title')}</Text>
        <View style={{ width: 32 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={c.primary} /></View>
      ) : (
        <FlatList
          data={challenges}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ChallengeRow challenge={item} onChanged={refetch} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={styles.intro}>
              {t('challenges_subtitle')}
            </Text>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="trophy-outline" size={44} color={c.mutedForeground} />
              <Text style={styles.emptyTitle}>{t('challenges_empty')}</Text>
              <Text style={styles.emptySub}>{t('challenges_empty_body')}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
  },
  headerTitle: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 18, color: c.foreground },
  list: { padding: 16, gap: 12 },
  intro: {
    ...typography.body, fontSize: 13, color: c.mutedForeground,
    lineHeight: 19, marginBottom: 4,
  },

  card: {
    backgroundColor: c.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  cardOver: { opacity: 0.65 },
  cardTop: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  cardTitle: { ...typography.bodyBold, fontSize: 16, color: c.foreground },
  cardDesc: {
    ...typography.body, fontSize: 13, color: c.mutedForeground,
    marginTop: 3, lineHeight: 18,
  },
  collectivePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
    backgroundColor: withAlpha(c.primary, 0.1),
    alignSelf: 'flex-start',
  },
  collectiveText: { fontFamily: 'Barlow_600SemiBold', fontSize: 10, color: c.primary },

  progressHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 },
  progressValue: { fontFamily: 'BarlowCondensed_900Black', fontSize: 22, color: c.foreground },
  progressGoal: { fontFamily: 'Barlow_500Medium', fontSize: 13, color: c.mutedForeground },
  progressPct: { fontFamily: 'DMMono_400Regular', fontSize: 13, color: c.primary },
  progressTrack: {
    height: 6, borderRadius: 3,
    backgroundColor: withAlpha(c.foreground, 0.08),
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: c.primary },

  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' },
  footerMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerText: { ...typography.body, fontSize: 12, color: c.mutedForeground },
  joinBtn: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 16,
    backgroundColor: c.primary,
  },
  joinBtnActive: {
    backgroundColor: withAlpha(c.primary, 0.12),
    borderWidth: 1, borderColor: withAlpha(c.primary, 0.35),
  },
  joinText: { fontFamily: 'Barlow_600SemiBold', fontSize: 12, color: c.primaryForeground },
  joinTextActive: { color: c.primary },

  empty: { alignItems: 'center', paddingVertical: 70, gap: 10 },
  emptyTitle: { ...typography.bodyBold, fontSize: 17, color: c.foreground },
  emptySub: { ...typography.body, fontSize: 14, color: c.mutedForeground, textAlign: 'center' },
});
