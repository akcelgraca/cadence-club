import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useState } from 'react';
import { followUser, unfollowUser } from '../../services/social';
import { colors, typography } from '../../lib/theme';

interface FollowButtonProps {
  userId: string;
  initialFollowing: boolean;
}

export function FollowButton({ userId, initialFollowing }: FollowButtonProps) {
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
      style={[styles.button, following ? styles.buttonFollowing : styles.buttonFollow]}
      onPress={handlePress}
      disabled={loading}
    >
      <Text style={[styles.text, following ? styles.textFollowing : styles.textFollow]}>
        {loading ? '...' : following ? 'A seguir' : 'Seguir'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  buttonFollow: { backgroundColor: colors.primary },
  buttonFollowing: { backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.border },
  text: { ...typography.bodyBold, fontSize: 14 },
  textFollow: { color: colors.primaryForeground },
  textFollowing: { color: colors.foreground },
});
