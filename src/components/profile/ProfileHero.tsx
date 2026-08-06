import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../common/Avatar';
import { FollowButton } from '../social/FollowButton';
import { colors, typography, withAlpha } from '../../lib/theme';
import type { Profile } from '../../lib/types';
import { useTranslation } from 'react-i18next';

/**
 * Cabeçalho do perfil desenhado como um dorsal de prova: identidade em cima,
 * faixa perfurada com os números em baixo. O número em destaque é a sequência
 * de dias — a app mede consistência, não performance.
 */

const PERFORATION_DOTS = 34;

function Perforation() {
  return (
    <View style={styles.perforation} pointerEvents="none">
      {Array.from({ length: PERFORATION_DOTS }).map((_, i) => (
        <View key={i} style={styles.perfDot} />
      ))}
    </View>
  );
}

interface BibStatProps {
  value: string | number;
  label: string;
  highlight?: boolean;
  onPress?: () => void;
}

function BibStat({ value, label, highlight, onPress }: BibStatProps) {
  const content = (
    <View style={styles.bibStat}>
      <Text style={[styles.bibValue, highlight && styles.bibValueHighlight]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.bibLabel} numberOfLines={2}>{label}</Text>
    </View>
  );

  if (!onPress) return content;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.6} style={{ flex: 1 }}>
      {content}
    </TouchableOpacity>
  );
}

interface ProfileHeroProps {
  profile: Profile;
  streakDays: number;
  activityCount: number;
  followerCount: number;
  followingCount: number;
  /** Perfil próprio mostra editar/definições; o de outros mostra seguir/mensagem. */
  isOwnProfile?: boolean;
  isFollowing?: boolean;
}

export function ProfileHero({
  profile, streakDays, activityCount, followerCount, followingCount,
  isOwnProfile = false, isFollowing = false,
}: ProfileHeroProps) {
  const { t } = useTranslation();
  const displayName = (() => {
    const parts = profile.full_name?.split(' ') || [];
    if (parts.length >= 2) return `${parts[0]} ${parts[parts.length - 1]}`;
    return parts[0] || t('profile_athlete');
  })();

  return (
    <View style={styles.container}>
      {/* Identidade */}
      <View style={styles.identityRow}>
        <View style={styles.avatarRing}>
          <Avatar uri={profile.avatar_url} name={displayName} size={62} />
        </View>

        <View style={styles.identityText}>
          <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
          <Text style={styles.handle} numberOfLines={1}>
            @{profile.username || '—'}{profile.city ? `  ·  ${profile.city}` : ''}
          </Text>
        </View>

        {isOwnProfile && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => router.push('/saved')}
              accessibilityLabel={t('profile_saved_posts')}
            >
              <Ionicons name="bookmark-outline" size={17} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => router.push('/profile/edit')}
              accessibilityLabel={t('profile_edit_action')}
            >
              <Ionicons name="pencil-outline" size={17} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => router.push('/profile/settings')}
              accessibilityLabel={t('profile_settings_action')}
            >
              <Ionicons name="settings-outline" size={17} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {!!profile.bio && (
        <Text style={styles.bio} numberOfLines={2}>{profile.bio}</Text>
      )}

      {/* Seguir / mensagem — só no perfil de outros */}
      {!isOwnProfile && (
        <View style={styles.socialActions}>
          <FollowButton userId={profile.id} initialFollowing={isFollowing} fullWidth />
          <TouchableOpacity
            style={styles.messageBtn}
            accessibilityLabel={t('profile_send_message')}
            onPress={() =>
              router.push({
                pathname: '/messages/[id]',
                params: {
                  id: 'draft',
                  userId: profile.id,
                  name: profile.full_name || profile.username || t('profile_athlete'),
                  avatarUrl: profile.avatar_url ?? '',
                },
              } as any)
            }
          >
            <Ionicons name="chatbubble-outline" size={17} color={colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Dorsal */}
      <View style={styles.bib}>
        <Perforation />
        <View style={styles.bibRow}>
          <BibStat value={streakDays} label={t('profile_streak_days')} highlight />
          <View style={styles.bibDivider} />
          <BibStat value={activityCount} label={t('profile_activities')} />
          <View style={styles.bibDivider} />
          <BibStat
            value={followerCount}
            label={t('followers')}
            onPress={() => router.push(`/profile/${profile.id}/follow-list?type=followers`)}
          />
          <View style={styles.bibDivider} />
          <BibStat
            value={followingCount}
            label={t('profile_following_label')}
            onPress={() => router.push(`/profile/${profile.id}/follow-list?type=following`)}
          />
        </View>
        <Perforation />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.card, paddingTop: 12 },

  // Identidade
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  avatarRing: {
    padding: 2,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  identityText: { flex: 1, minWidth: 0 },
  name: {
    fontFamily: 'BarlowCondensed_900Black',
    fontSize: 27,
    lineHeight: 29,
    letterSpacing: 0.5,
    color: colors.foreground,
    textTransform: 'uppercase',
  },
  handle: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 1,
  },
  actions: { flexDirection: 'row', gap: 2 },
  actionBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },

  bio: {
    ...typography.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.mutedForeground,
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  // Seguir / mensagem
  socialActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  messageBtn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: withAlpha(colors.primary, 0.35),
  },

  // Dorsal
  bib: { marginTop: 14 },
  perforation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  perfDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: withAlpha(colors.foreground, 0.18),
  },
  bibRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  bibStat: { flex: 1, alignItems: 'center', paddingHorizontal: 2 },
  bibValue: {
    fontFamily: 'BarlowCondensed_900Black',
    fontSize: 30,
    lineHeight: 32,
    color: colors.foreground,
  },
  bibValueHighlight: { color: colors.primary },
  bibLabel: {
    fontFamily: 'Barlow_500Medium',
    fontSize: 9,
    letterSpacing: 0.9,
    lineHeight: 12,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 2,
  },
  bibDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: 6,
    backgroundColor: colors.border,
  },
});
