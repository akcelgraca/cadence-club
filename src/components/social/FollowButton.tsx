import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useState } from 'react';
import { followUser, unfollowUser } from '../../services/social';
import { colors, typography } from '../../lib/theme';
import { useTranslation } from 'react-i18next';

interface FollowButtonProps {
  userId: string;
  initialFollowing: boolean;
  /** Ocupa a largura disponível — usado na barra de ações do perfil. */
  fullWidth?: boolean;
}

export function FollowButton({ userId, initialFollowing, fullWidth }: FollowButtonProps) {
  const { t } = useTranslation();
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    setLoading(true);
    const newFollowing = !following;
    setFollowing(newFollowing);
    try {
      if (newFollowing) {
        await followUser(userId);
      } else {
        await unfollowUser(userId);
      }
    } catch {
      setFollowing(!newFollowing);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        following ? styles.buttonFollowing : styles.buttonFollow,
        fullWidth && styles.buttonFullWidth,
      ]}
      onPress={handlePress}
      disabled={loading}
    >
      <Text style={[styles.text, following ? styles.textFollowing : styles.textFollow]}>
        {loading ? '...' : following ? t('follow_following') : t('follow')}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  buttonFullWidth: { flex: 1, alignItems: 'center', borderRadius: 22, paddingVertical: 11 },
  buttonFollow: { backgroundColor: colors.primary },
  buttonFollowing: { backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.border },
  text: { ...typography.bodyBold, fontSize: 14 },
  textFollow: { color: colors.primaryForeground },
  textFollowing: { color: colors.foreground },
});
