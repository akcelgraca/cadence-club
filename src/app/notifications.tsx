import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '../hooks/useNotifications';
import { markAsRead, markAllAsRead } from '../services/notifications';
import { useQueryClient } from '@tanstack/react-query';
import { formatRelativeTime } from '../utils/dateHelpers';
import { colors, typography, withAlpha } from '../lib/theme';
import type { Notification } from '../lib/types';

const NOTIFICATION_ICONS: Record<string, string> = {
  kudo: 'heart',
  comment: 'chatbubble',
  follow: 'person-add',
  streak: 'flame',
  badge: 'ribbon',
};

function getNotificationRoute(item: Notification): { pathname: string; params: any } | null {
  switch (item.type) {
    case 'kudo':
    case 'comment':
      return item.reference_id
        ? { pathname: '/activity/[id]', params: { id: item.reference_id } }
        : null;
    case 'follow':
      return item.actor_id
        ? { pathname: '/profile/[id]', params: { id: item.actor_id } }
        : null;
    case 'streak':
    case 'badge':
      return { pathname: '/(tabs)/profile', params: {} };
    default:
      return null;
  }
}

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isRefetching,
    isError,
    refetch,
  } = useNotifications();

  const notifications = data?.pages.flat() ?? [];
  const hasUnread = notifications.some((n) => !n.is_read);

  const handlePress = async (item: Notification) => {
    // Mark as read
    if (!item.is_read) {
      try {
        await markAsRead(item.id);
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
      } catch {}
    }

    const route = getNotificationRoute(item);
    if (route) {
      router.push(route);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
    } catch {}
  };

  const renderItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.notificationItem, !item.is_read && styles.notificationUnread]}
      onPress={() => handlePress(item)}
    >
      <View style={[styles.iconContainer, !item.is_read && styles.iconContainerUnread]}>
        <Ionicons
          name={(NOTIFICATION_ICONS[item.type] ?? 'notifications') as any}
          size={18}
          color={!item.is_read ? colors.primary : colors.mutedForeground}
        />
      </View>
      <View style={styles.notificationContent}>
        <Text style={[styles.notificationMessage, !item.is_read && styles.notificationMessageUnread]}>
          {item.message}
        </Text>
        <Text style={styles.notificationTime}>{formatRelativeTime(item.created_at)}</Text>
      </View>
      {!item.is_read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      {hasUnread && (
        <TouchableOpacity onPress={handleMarkAllRead}>
          <Text style={styles.markAllRead}>{t('notifications_mark_all_read')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="notifications-off-outline" size={48} color={colors.mutedForeground} />
        <Text style={styles.emptyTitle}>{t('notifications_empty')}</Text>
        <Text style={styles.emptySubtitle}>
          {t('notifications_empty_subtext')}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.centerLoader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : isError ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.destructive} />
          <Text style={styles.emptyTitle}>{t('error_loading')}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.3}
          refreshing={isRefetching}
          onRefresh={() => refetch()}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 16,
  },
  markAllRead: {
    ...typography.body,
    fontSize: 13,
    color: colors.primary,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
    gap: 12,
  },
  notificationUnread: {
    borderColor: withAlpha(colors.primary, 0.2),
    backgroundColor: withAlpha(colors.primary, 0.03),
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerUnread: {
    backgroundColor: withAlpha(colors.primary, 0.1),
  },
  notificationContent: {
    flex: 1,
  },
  notificationMessage: {
    ...typography.body,
    fontSize: 14,
    color: colors.mutedForeground,
    lineHeight: 20,
  },
  notificationMessageUnread: {
    color: colors.foreground,
    fontFamily: 'Barlow_600SemiBold',
  },
  notificationTime: {
    ...typography.body,
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  centerLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  emptyTitle: {
    ...typography.bodyBold,
    fontSize: 18,
    color: colors.foreground,
  },
  emptySubtitle: {
    ...typography.body,
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  retryButtonText: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.primaryForeground,
  },
});
