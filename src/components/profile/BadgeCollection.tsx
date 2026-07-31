import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { UserBadge } from '../../lib/types';
import { colors, typography } from '../../lib/theme';
import { getBadgeImage } from '../../lib/badgeImages';

interface BadgeCollectionProps {
  badges: UserBadge[];
}

export function BadgeCollection({ badges }: BadgeCollectionProps) {
  if (badges.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Ainda sem medalhas</Text>
        <Text style={styles.emptySubtext}>Completa atividades para ganhares medalhas.</Text>
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.row}>
        {badges.map((ub) => (
          <View key={ub.id} style={styles.badgeItem}>
            <View style={styles.badgeIconContainer}>
              {getBadgeImage(ub.badge?.icon ?? '') ? (
                <Image source={getBadgeImage(ub.badge?.icon ?? '')} style={styles.badgeImage} resizeMode="contain" />
              ) : (
                <Ionicons name={(ub.badge?.icon as any) ?? 'ribbon'} size={28} color={colors.primary} />
              )}
            </View>
            <Text style={styles.badgeName} numberOfLines={2}>{ub.badge?.name}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  emptyContainer: { alignItems: 'center', padding: 20 },
  emptyText: { ...typography.bodyBold, fontSize: 14, color: colors.mutedForeground },
  emptySubtext: { ...typography.body, fontSize: 12, color: colors.mutedForeground, marginTop: 4 },
  row: { flexDirection: 'row', gap: 16, paddingHorizontal: 4 },
  badgeItem: { alignItems: 'center', width: 72 },
  badgeIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  badgeIcon: { fontSize: 28 },
  badgeImage: { width: 36, height: 36 },
  badgeName: { ...typography.bodyBold, fontSize: 11, textAlign: 'center', color: colors.foreground },
});
