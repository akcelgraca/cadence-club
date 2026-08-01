import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router/react-navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getSavedPosts, unsavePost } from '../services/social';
import { SocialPostCard } from '../components/social/SocialPostCard';
import { colors, typography, withAlpha } from '../lib/theme';
import type { Activity } from '../lib/types';

export default function SavedPostsScreen() {
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
    Alert.alert('Remover dos guardados', `Remover "${activity.title ?? 'este post'}"?`, [
      { text: 'Cancelar', style: 'cancel' },
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
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Guardados</Text>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View>
              <View style={styles.savedBar}>
                <Ionicons name="bookmark" size={13} color={colors.primary} />
                <Text style={styles.savedBarText}>Guardado</Text>
                <View style={{ flex: 1 }} />
                <TouchableOpacity onPress={() => handleUnsave(item)} hitSlop={8}>
                  <Text style={styles.removeText}>Remover</Text>
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
                <Ionicons name="bookmark-outline" size={40} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Ainda sem posts guardados</Text>
              <Text style={styles.emptySub}>
                Usa o menu "…" de um post no feed e escolhe "Guardar post".
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 18,
    color: colors.foreground,
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
    color: colors.primary,
    textTransform: 'uppercase',
  },
  removeText: { ...typography.bodyMedium, fontSize: 12, color: colors.mutedForeground },

  empty: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 40, gap: 10 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: withAlpha(colors.primary, 0.1),
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { ...typography.bodyBold, fontSize: 17, color: colors.foreground },
  emptySub: {
    ...typography.body, fontSize: 14, color: colors.mutedForeground,
    textAlign: 'center', lineHeight: 20,
  },
});
