import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../common/Avatar';
import { ActivityIcon } from '../common/ActivityIcon';
import { joinClub, leaveClub, requestToJoinClub, cancelJoinRequest } from '../../services/clubs';
import { ACTIVITY_CATEGORIES } from '../../lib/constants';
import { colors, typography, withAlpha } from '../../lib/theme';
import type { Club } from '../../lib/types';

/** Linha de clube usada na aba Clubes e no ecrã de descoberta. */
export function ClubCard({ club, onAction }: { club: Club; onAction: (club: Club) => void }) {
  const [busy, setBusy] = useState(false);
  const catDef = ACTIVITY_CATEGORIES.find((c) => c.key === club.category);

  const handleJoinLeave = () => {
    if (club.is_member) {
      Alert.alert('Sair do clube', `Tens a certeza que queres sair de "${club.name}"?`, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair', style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await leaveClub(club.id);
              onAction({ ...club, is_member: false });
            } catch {
              Alert.alert('Erro', 'Não foi possível sair do clube.');
            } finally {
              setBusy(false);
            }
          },
        },
      ]);
    } else if (club.is_private) {
      // Clube privado — pedir para entrar / cancelar pedido pendente
      if (club.request_status === 'pending') {
        Alert.alert('Pedido pendente', 'Queres cancelar o pedido de adesão?', [
          { text: 'Manter', style: 'cancel' },
          {
            text: 'Cancelar pedido', style: 'destructive',
            onPress: async () => {
              setBusy(true);
              try {
                await cancelJoinRequest(club.id);
                onAction({ ...club, request_status: undefined });
              } catch {
                Alert.alert('Erro', 'Não foi possível cancelar o pedido.');
              } finally {
                setBusy(false);
              }
            },
          },
        ]);
      } else {
        setBusy(true);
        requestToJoinClub(club.id)
          .then(() => onAction({ ...club, request_status: 'pending' }))
          .catch(() => Alert.alert('Erro', 'Não foi possível enviar o pedido.'))
          .finally(() => setBusy(false));
      }
    } else {
      setBusy(true);
      joinClub(club.id)
        .then(() => onAction({ ...club, is_member: true, role: 'member' }))
        .catch(() => Alert.alert('Erro', 'Não foi possível entrar no clube.'))
        .finally(() => setBusy(false));
    }
  };

  const pendingRequest = !club.is_member && club.request_status === 'pending';
  const actionLabel = club.is_member
    ? 'Membro'
    : club.is_private
      ? pendingRequest ? 'Pendente' : 'Pedir'
      : 'Entrar';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/club/${club.id}`)}
      activeOpacity={0.75}
    >
      {/* Avatar */}
      <View style={styles.cardAvatar}>
        {club.avatar_url
          ? <Avatar uri={club.avatar_url} size={52} radius={14} />
          : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarLetter}>{club.name[0]?.toUpperCase() ?? '?'}</Text>
            </View>
          )
        }
        {club.role === 'admin' && (
          <View style={styles.adminBadge}>
            <Ionicons name="shield-checkmark" size={9} color="#fff" />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.cardInfo}>
        <View style={styles.cardNameRow}>
          <Text style={styles.cardName} numberOfLines={1}>{club.name}</Text>
          {club.is_private && (
            <Ionicons name="lock-closed" size={11} color={colors.mutedForeground} />
          )}
        </View>
        {club.description && (
          <Text style={styles.cardDesc} numberOfLines={1}>{club.description}</Text>
        )}
        <View style={styles.cardMeta}>
          {catDef && (
            <View style={styles.metaChip}>
              <ActivityIcon activityKey={catDef.activities[0]?.key ?? ''} size={10} tintColor={colors.primary} />
              <Text style={styles.metaChipText}>{catDef.key}</Text>
            </View>
          )}
          {club.city && (
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={10} color={colors.mutedForeground} />
              <Text style={styles.metaText}>{club.city}</Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={10} color={colors.mutedForeground} />
            <Text style={styles.metaText}>{club.member_count}</Text>
          </View>
        </View>
      </View>

      {/* Ação */}
      <TouchableOpacity
        style={[styles.actionBtn, (club.is_member || pendingRequest) && styles.actionBtnMember]}
        onPress={handleJoinLeave}
        disabled={busy}
        hitSlop={8}
      >
        {busy
          ? <ActivityIndicator size="small" color={club.is_member || pendingRequest ? colors.primary : colors.primaryForeground} />
          : <Text style={[styles.actionBtnText, (club.is_member || pendingRequest) && styles.actionBtnTextMember]}>
              {actionLabel}
            </Text>
        }
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  cardAvatar: { position: 'relative' },
  avatarFallback: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: withAlpha(colors.primary, 0.15),
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 22,
    color: colors.primary,
  },
  adminBadge: {
    position: 'absolute',
    bottom: -3, right: -3,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.card,
  },
  cardInfo: { flex: 1, minWidth: 0 },
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  cardName: {
    fontFamily: 'Barlow_600SemiBold',
    fontSize: 15,
    color: colors.foreground,
    flexShrink: 1,
  },
  cardDesc: {
    ...typography.body,
    fontSize: 12,
    color: colors.mutedForeground,
    marginBottom: 4,
  },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: withAlpha(colors.primary, 0.1),
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  metaChipText: {
    fontFamily: 'Barlow_600SemiBold',
    fontSize: 10,
    color: colors.primary,
    textTransform: 'capitalize',
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { ...typography.body, fontSize: 11, color: colors.mutedForeground },

  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.primary,
    minWidth: 64,
    alignItems: 'center',
  },
  actionBtnMember: {
    backgroundColor: withAlpha(colors.primary, 0.12),
    borderWidth: 1,
    borderColor: withAlpha(colors.primary, 0.3),
  },
  actionBtnText: {
    fontFamily: 'Barlow_600SemiBold',
    fontSize: 12,
    color: colors.primaryForeground,
  },
  actionBtnTextMember: { color: colors.primary },
});
