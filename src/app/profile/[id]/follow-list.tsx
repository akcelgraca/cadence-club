import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getFollowers, getFollowing } from '../../../services/social';
import { supabase } from '../../../services/supabase';
import { Avatar } from '../../../components/common/Avatar';
import { FollowButton } from '../../../components/social/FollowButton';
import { useAuthStore } from '../../../store/authStore';
import { colors, typography } from '../../../lib/theme';

interface FollowItem {
  follower_id?: string;
  following_id?: string;
  profile: {
    id: string;
    full_name: string;
    username: string;
    avatar_url: string | null;
  } | null;
}

export default function FollowListScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type: 'followers' | 'following' }>();
  const isFollowers = type === 'followers';
  const currentUserId = useAuthStore((s) => s.session?.user.id);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['followList', id, type],
    queryFn: () => (isFollowers ? getFollowers(id) : getFollowing(id)),
    enabled: !!id,
  });

  // Fetch the set of user IDs that the current user follows
  const { data: myFollowingIds } = useQuery({
    queryKey: ['myFollowingIds', currentUserId],
    queryFn: async () => {
      if (!currentUserId) return new Set<string>();
      const { data } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUserId);
      return new Set((data ?? []).map((f) => f.following_id));
    },
    enabled: !!currentUserId,
  });

  const items = (data ?? []) as unknown as FollowItem[];
  const title = isFollowers ? 'Seguidores' : 'A seguir';

  const renderItem = ({ item }: { item: FollowItem }) => {
    const profile = item.profile;
    if (!profile) return null;
    const userId = isFollowers ? item.follower_id : item.following_id;
    const isFollowingThisUser = userId ? (myFollowingIds?.has(userId) ?? false) : false;
    // Don't show follow button for the current user
    const isSelf = userId === currentUserId;

    return (
      <TouchableOpacity
        style={styles.item}
        onPress={() => router.push(`/profile/${profile.id}`)}
      >
        <Avatar uri={profile.avatar_url} name={profile.full_name} size={48} />
        <View style={styles.info}>
          <Text style={styles.name}>{profile.full_name}</Text>
          <Text style={styles.username}>@{profile.username}</Text>
        </View>
        {userId && !isSelf && (
          <FollowButton userId={userId} initialFollowing={isFollowingThisUser} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title, headerShown: true }} />
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.destructive} />
          <Text style={styles.errorText}>Erro ao carregar</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => (isFollowers ? item.follower_id : item.following_id) ?? ''}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>
                {isFollowers ? 'Ainda sem seguidores.' : 'Ainda nao segues ninguem.'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 12 },
  errorText: { ...typography.body, fontSize: 16, color: colors.destructive },
  emptyText: { ...typography.body, fontSize: 14, color: colors.mutedForeground },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
    gap: 12,
  },
  info: { flex: 1 },
  name: { ...typography.bodyBold, fontSize: 15, color: colors.foreground },
  username: { ...typography.body, fontSize: 13, color: colors.mutedForeground, marginTop: 1 },
});
