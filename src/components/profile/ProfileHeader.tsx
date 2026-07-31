import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../common/Avatar';
import type { Profile } from '../../lib/types';
import { colors, typography } from '../../lib/theme';

interface ProfileHeaderProps {
  profile: Profile;
  isOwnProfile?: boolean;
}

export function ProfileHeader({ profile, isOwnProfile = false }: ProfileHeaderProps) {
  const displayName = (() => {
    const parts = profile.full_name?.split(' ') || [];
    if (parts.length >= 2) return `${parts[0]} ${parts[parts.length - 1]}`;
    return parts[0] || '';
  })();

  const avatar = (
    <Avatar
      uri={profile.avatar_url}
      name={displayName}
      size={80}
      radius={16}
    />
  );

  return (
    <View style={styles.container}>
      <View style={styles.mainRow}>
        <View>{avatar}</View>
        <View style={styles.textGroup}>
          <Text style={styles.name}>{displayName || '-'}</Text>
          <Text style={styles.username}>@{profile.username || '-'}</Text>
        </View>
        {isOwnProfile && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/profile/edit')}
            >
              <Ionicons name="pencil-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/profile/settings')}
            >
              <Ionicons name="settings-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
        )}
      </View>
      {!!profile.bio && (
        <Text style={styles.bio}>{profile.bio}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: colors.background,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  textGroup: { flex: 1, gap: 2 },
  name: {
    fontFamily: 'BarlowCondensed_900Black',
    fontSize: 32,
    color: colors.foreground,
    textTransform: 'uppercase',
    lineHeight: 34,
  },
  username: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 14,
    color: colors.mutedForeground,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    alignSelf: 'flex-start',
  },
  actionButton: {
    padding: 8,
    borderRadius: 20,
  },
  bio: {
    ...typography.body,
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 12,
    lineHeight: 20,
  },
});
