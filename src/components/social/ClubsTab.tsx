import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getMyClubs, getSuggestedClubs, getPendingRequestsForMyClubs, respondToJoinRequest,
} from '../../services/clubs';
import { ClubCard } from './ClubCard';
import { Avatar } from '../common/Avatar';
import { useAuthStore } from '../../store/authStore';
import { useSocialStore } from '../../store/socialStore';
import { colors, typography, withAlpha } from '../../lib/theme';
import type { Club, ClubJoinRequest } from '../../lib/types';
import { useTranslation } from 'react-i18next';

type Row =
  | { type: 'header'; id: string; title: string; subtitle?: string }
  | { type: 'request'; id: string; request: ClubJoinRequest }
  | (Club & { type: 'club' });

export function ClubsTab() {
  const { t } = useTranslation();
  const myCity = useAuthStore((s) => s.profile?.city);
  const setUnreadClubs = useSocialStore((s) => s.setUnreadClubs);
  const [myClubs, setMyClubs] = useState<Club[]>([]);
  const [suggestions, setSuggestions] = useState<Club[]>([]);
  const [requests, setRequests] = useState<ClubJoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [mine, suggested, pending] = await Promise.all([
        getMyClubs(),
        getSuggestedClubs(8),
        getPendingRequestsForMyClubs(),
      ]);
      setMyClubs(mine);
      setSuggestions(suggested.filter((s) => !mine.some((m) => m.id === s.id)));
      setRequests(pending);
      setUnreadClubs(pending.length);
    } catch {
      // tables may not be created yet — show empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setUnreadClubs]);

  const handleRespond = useCallback(async (req: ClubJoinRequest, accept: boolean) => {
    setRequests((prev) => {
      const next = prev.filter((r) => r.id !== req.id);
      setUnreadClubs(next.length);
      return next;
    });
    try {
      await respondToJoinRequest(req.id, accept);
      if (accept) load();
    } catch {
      load(); // repõe o pedido se falhar
    }
  }, [load, setUnreadClubs]);

  // Recarregar sempre que o ecrã ganha foco (ex.: depois de criar/apagar um clube)
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleClubAction = useCallback((updated: Club) => {
    // Entrar numa sugestão move-a para "Meus Clubes"; sair faz o inverso
    setMyClubs((prev) => {
      if (updated.is_member) {
        return prev.some((c) => c.id === updated.id)
          ? prev.map((c) => (c.id === updated.id ? updated : c))
          : [updated, ...prev];
      }
      return prev.filter((c) => c.id !== updated.id);
    });
    setSuggestions((prev) =>
      updated.is_member
        ? prev.filter((c) => c.id !== updated.id)
        : prev.map((c) => (c.id === updated.id ? updated : c)),
    );
  }, []);

  const suggestionTitle = myCity ? `Sugestões perto de ti · ${myCity}` : t('clubs_suggestions');

  const rows: Row[] = [
    // Pedidos por aprovar primeiro — é o que o badge desta aba anuncia
    ...(requests.length > 0
      ? [
          {
            type: 'header' as const,
            id: 'h-requests',
            title: `Pedidos de adesão (${requests.length})`,
            subtitle: t('clubs_pending_requests'),
          },
          ...requests.map((r) => ({ type: 'request' as const, id: `req-${r.id}`, request: r })),
        ]
      : []),
    ...(myClubs.length > 0
      ? [
          { type: 'header' as const, id: 'h-mine', title: t('clubs_mine') },
          ...myClubs.map((c) => ({ ...c, type: 'club' as const })),
        ]
      : []),
    ...(suggestions.length > 0
      ? [
          {
            type: 'header' as const,
            id: 'h-suggest',
            title: suggestionTitle,
            subtitle: myClubs.length === 0
              ? t('clubs_empty')
              : undefined,
          },
          ...suggestions.map((c) => ({ ...c, type: 'club' as const })),
        ]
      : []),
  ];

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <View style={styles.root}>
      <FlatList
        data={rows}
        keyExtractor={(item) => (item.type === 'header' ? item.id : item.id)}
        renderItem={({ item }) => {
          if (item.type === 'header') {
            return (
              <View>
                <Text style={styles.sectionHeader}>{item.title}</Text>
                {!!item.subtitle && <Text style={styles.sectionSub}>{item.subtitle}</Text>}
              </View>
            );
          }
          if (item.type === 'request') {
            const req = item.request;
            return (
              <View style={styles.requestRow}>
                <TouchableOpacity onPress={() => router.push(`/profile/${req.user_id}`)}>
                  <Avatar uri={req.profile?.avatar_url} name={req.profile?.full_name} size={44} />
                </TouchableOpacity>
                <View style={styles.requestInfo}>
                  <Text style={styles.requestName} numberOfLines={1}>
                    {req.profile?.full_name ?? 'Atleta'}
                  </Text>
                  <Text style={styles.requestClub} numberOfLines={1}>
                    quer entrar em {req.club?.name ?? t('clubs_a_club')}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.acceptBtn}
                  onPress={() => handleRespond(req, true)}
                  hitSlop={6}
                  accessibilityLabel={t('clubs_accept_request')}
                >
                  <Ionicons name="checkmark" size={18} color={colors.primaryForeground} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rejectBtn}
                  onPress={() => handleRespond(req, false)}
                  hitSlop={6}
                  accessibilityLabel={t('clubs_decline_request')}
                >
                  <Ionicons name="close" size={18} color={colors.destructive} />
                </TouchableOpacity>
              </View>
            );
          }
          return <ClubCard club={item as Club} onAction={handleClubAction} />;
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="people-circle-outline" size={44} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>{t('clubs_none')}</Text>
            <Text style={styles.emptyBody}>
              {t('clubs_none_body')}
            </Text>
            <TouchableOpacity style={styles.emptyPrimary} onPress={() => router.push('/club/create')}>
              <Ionicons name="add" size={15} color={colors.primaryForeground} />
              <Text style={styles.emptyPrimaryText}>{t('clubs_create')}</Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.primary}
          />
        }
      />

      {/* FAB — criar clube */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/club/create')}
        accessibilityLabel={t('clubs_create')}
      >
        <Ionicons name="add" size={26} color={colors.primaryForeground} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingBottom: 100, flexGrow: 1 },

  sectionHeader: {
    fontFamily: 'Barlow_600SemiBold',
    fontSize: 12,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 6,
  },
  sectionSub: {
    ...typography.body,
    fontSize: 13,
    color: colors.mutedForeground,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },

  // Pedidos de adesão
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: withAlpha(colors.primary, 0.06),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  requestInfo: { flex: 1, minWidth: 0 },
  requestName: { ...typography.bodyBold, fontSize: 15, color: colors.foreground },
  requestClub: {
    ...typography.body, fontSize: 13,
    color: colors.mutedForeground, marginTop: 2,
  },
  acceptBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  rejectBtn: {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 1, borderColor: withAlpha(colors.destructive, 0.4),
    alignItems: 'center', justifyContent: 'center',
  },

  // Estado vazio
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
    gap: 10,
  },
  emptyIcon: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: withAlpha(colors.primary, 0.1),
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { ...typography.bodyBold, fontSize: 18, color: colors.foreground },
  emptyBody: {
    ...typography.body, fontSize: 14,
    color: colors.mutedForeground, textAlign: 'center', lineHeight: 20,
  },
  emptyActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  emptyPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 18, paddingVertical: 11,
    borderRadius: 22, backgroundColor: colors.primary,
  },
  emptyPrimaryText: { fontFamily: 'Barlow_600SemiBold', fontSize: 13, color: colors.primaryForeground },
  emptySecondary: {
    paddingHorizontal: 18, paddingVertical: 11,
    borderRadius: 22,
    borderWidth: 1, borderColor: withAlpha(colors.primary, 0.4),
  },
  emptySecondaryText: { fontFamily: 'Barlow_600SemiBold', fontSize: 13, color: colors.primary },

  // FAB
  fab: {
    position: 'absolute',
    right: 16, bottom: 24,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
});
