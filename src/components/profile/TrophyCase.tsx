import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { UserBadge } from '../../lib/types';
import { colors, typography } from '../../lib/theme';
import { getBadgeImage } from '../../lib/badgeImages';

interface TrophyCaseProps {
  badges: UserBadge[];
}

export function TrophyCase({ badges }: TrophyCaseProps) {
  const { t } = useTranslation();
  const [selectedBadge, setSelectedBadge] = useState<UserBadge | null>(null);

  if (badges.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{t('profile_no_badges')}</Text>
        <Text style={styles.emptySubtext}>{t('profile_no_badges_subtitle')}</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.row}>
          {badges.map((ub) => (
            <TouchableOpacity
              key={ub.id}
              style={styles.badgeItem}
              onPress={() => setSelectedBadge(ub)}
              activeOpacity={0.7}
            >
              <View style={styles.badgeIconContainer}>
                {getBadgeImage(ub.badge?.icon ?? '') ? (
                  <Image source={getBadgeImage(ub.badge?.icon ?? '')} style={styles.badgeImage} resizeMode="contain" />
                ) : (
                  <Ionicons name={(ub.badge?.icon as any) ?? 'ribbon'} size={28} color={colors.primary} />
                )}
              </View>
              <Text style={styles.badgeName} numberOfLines={2}>{ub.badge?.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Modal
        visible={!!selectedBadge}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedBadge(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedBadge(null)}
        >
          <View style={styles.modalContent}>
            {getBadgeImage(selectedBadge?.badge?.icon ?? '') ? (
          <Image source={getBadgeImage(selectedBadge?.badge?.icon ?? '')} style={styles.modalBadgeImage} resizeMode="contain" />
        ) : (
          <Ionicons name={(selectedBadge?.badge?.icon as any) ?? 'ribbon'} size={56} color={colors.primary} />
        )}
            <Text style={styles.modalName}>{selectedBadge?.badge?.name}</Text>
            <Text style={styles.modalDescription}>{selectedBadge?.badge?.description}</Text>
            {selectedBadge?.activity_id ? (
              <Text style={styles.modalActivity}>
                {t('badge_earned_in_activity')}
              </Text>
            ) : (
              <Text style={styles.modalActivity}>
                {t('badge_earned_on')}{' '}
                {new Date(selectedBadge?.earned_at ?? '').toLocaleDateString('pt-PT')}
              </Text>
            )}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setSelectedBadge(null)}
            >
              <Text style={styles.modalCloseText}>{t('training_close')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
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
  modalBadgeImage: { width: 72, height: 72, marginBottom: 12 },
  badgeName: { ...typography.bodyBold, fontSize: 11, textAlign: 'center', color: colors.foreground },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlayDark,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  modalIcon: { fontSize: 56, marginBottom: 12 },
  modalName: { ...typography.bodyBold, fontSize: 20, textAlign: 'center', marginBottom: 8, color: colors.foreground },
  modalDescription: { ...typography.body, fontSize: 14, color: colors.mutedForeground, textAlign: 'center', marginBottom: 12 },
  modalActivity: { ...typography.body, fontSize: 12, color: colors.mutedForeground, marginBottom: 16 },
  modalCloseButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  modalCloseText: { ...typography.bodyBold, color: colors.primaryForeground },
});
