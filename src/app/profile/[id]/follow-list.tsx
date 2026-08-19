import { useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useColors } from '../../../hooks/useColors';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getFollowers, getFollowing } from '../../../services/social';
import { supabase } from '../../../services/supabase';
import { Avatar } from '../../../components/common/Avatar';
import { FollowButton } from '../../../components/social/FollowButton';
import { useAuthStore } from '../../../store/authStore';
import { typography, type Colors } from '../../../lib/theme';
import { useTranslation } from 'react-i18next';

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
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
  const { id, type } = useLocalSearchParams<{ id: string; type: 'followers' | 'following' }>();
  const isFollowers = type === 'followers';
  const currentUserId = useAuthStore((s) => s.session?.user.id);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['followList', id, type],
    queryFn: async (): Promise<FollowItem[]> => {
      const rows = isFollowers ? await getFollowers(id) : await getFollowing(id);
      return rows as unknown as FollowItem[];
    },
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
  const title = isFollowers ? 'Seguidores' : t('following');

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
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={c.destructive} />
          <Text style={styles.errorText}>{t('error_loading')}</Text>
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
                {isFollowers ? t('profile_no_followers') : t('profile_not_following')}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  list: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 12 },
  errorText: { ...typography.body, fontSize: 16, color: c.destructive },
  emptyText: { ...typography.body, fontSize: 14, color: c.mutedForeground },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    backgroundColor: c.card,
    borderRadius: 12,
    gap: 12,
  },
  info: { flex: 1 },
  name: { ...typography.bodyBold, fontSize: 15, color: c.foreground },
  username: { ...typography.body, fontSize: 13, color: c.mutedForeground, marginTop: 1 },
});
