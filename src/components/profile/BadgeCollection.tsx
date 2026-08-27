import { useMemo } from 'react';
import { textoDoCracha } from '../../lib/badgeText';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { useColors } from '../../hooks/useColors';
import { Ionicons } from '@expo/vector-icons';
import type { UserBadge } from '../../lib/types';
import { typography, type Colors } from '../../lib/theme';
import { getBadgeImage } from '../../lib/badgeImages';
import { useTranslation } from 'react-i18next';

interface BadgeCollectionProps {
  badges: UserBadge[];
}

export function BadgeCollection({ badges }: BadgeCollectionProps) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
  if (badges.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{t('profile_no_badges')}</Text>
        <Text style={styles.emptySubtext}>{t('profile_no_badges_subtitle')}</Text>
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
                <Ionicons name={(ub.badge?.icon as any) ?? 'ribbon'} size={28} color={c.primary} />
              )}
            </View>
            <Text style={styles.badgeName} numberOfLines={2}>{textoDoCracha(ub.badge?.name, t)}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  emptyContainer: { alignItems: 'center', padding: 20 },
  emptyText: { ...typography.bodyBold, fontSize: 14, color: c.mutedForeground },
  emptySubtext: { ...typography.body, fontSize: 12, color: c.mutedForeground, marginTop: 4 },
  row: { flexDirection: 'row', gap: 16, paddingHorizontal: 4 },
  badgeItem: { alignItems: 'center', width: 72 },
  badgeIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: c.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  badgeIcon: { fontSize: 28 },
  badgeImage: { width: 36, height: 36 },
  badgeName: { ...typography.bodyBold, fontSize: 11, textAlign: 'center', color: c.foreground },
});
