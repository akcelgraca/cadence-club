import { useState, useCallback, useMemo } from 'react';
import { useColors } from '../hooks/useColors';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';

import { useFocusEffect } from 'expo-router/react-navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getSavedPosts, unsavePost } from '../services/social';
import { SocialPostCard } from '../components/social/SocialPostCard';
import { typography, withAlpha, type Colors } from '../lib/theme';
import type { Activity } from '../lib/types';
import { useTranslation } from 'react-i18next';
import { goBackOr } from '../lib/navigation';

export default function SavedPostsScreen() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
  const [posts, setPosts] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    getSavedPosts()
      .then((rows) => setPosts(rows as Activity[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleUnsave = (activity: Activity) => {
    Alert.alert(
      t('saved_remove_title'),
      t('saved_remove_confirm', { title: activity.title ?? t('saved_this_post') }),
      [
      { text: t('cancel'), style: 'cancel' },
      {
        text: 'Remover', style: 'destructive',
        onPress: async () => {
          setPosts((prev) => prev.filter((p) => p.id !== activity.id));
          try {
            await unsavePost(activity.id);
          } catch {
            load(); // repor em caso de erro
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOr('/(tabs)')} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={c.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('saved_title')}</Text>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={c.primary} /></View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View>
              <View style={styles.savedBar}>
                <Ionicons name="bookmark" size={13} color={c.primary} />
                <Text style={styles.savedBarText}>{t('activity_saved_title')}</Text>
                <View style={{ flex: 1 }} />
                <TouchableOpacity onPress={() => handleUnsave(item)} hitSlop={8}>
                  <Text style={styles.removeText}>{t('saved_remove_action')}</Text>
                </TouchableOpacity>
              </View>
              <SocialPostCard
                activity={item}
                onDeleted={() => setPosts((prev) => prev.filter((p) => p.id !== item.id))}
              />
            </View>
          )}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="bookmark-outline" size={40} color={c.primary} />
              </View>
              <Text style={styles.emptyTitle}>{t('saved_empty')}</Text>
              <Text style={styles.emptySub}>
                {t('saved_empty_body')}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  headerTitle: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 18,
    color: c.foreground,
  },

  savedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 2,
  },
  savedBarText: {
    fontFamily: 'Barlow_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.5,
    color: c.primary,
    textTransform: 'uppercase',
  },
  removeText: { ...typography.bodyMedium, fontSize: 12, color: c.mutedForeground },

  empty: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 40, gap: 10 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: withAlpha(c.primary, 0.1),
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { ...typography.bodyBold, fontSize: 17, color: c.foreground },
  emptySub: {
    ...typography.body, fontSize: 14, color: c.mutedForeground,
    textAlign: 'center', lineHeight: 20,
  },
});
