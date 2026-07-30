import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getNotifications, getUnreadCount } from '../services/notifications';
import { supabase } from '../services/supabase';

export function useNotifications() {
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: ['notifications'],
    queryFn: ({ pageParam = 0 }) => getNotifications(pageParam, 20),
    getNextPageParam: (lastPage, pages) => {
      if (!lastPage || lastPage.length < 20) return undefined;
      return pages.length;
    },
    initialPageParam: 0,
  });

  // Subscribe to real-time new notifications
  useEffect(() => {
    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['unreadCount'],
    queryFn: getUnreadCount,
    refetchInterval: 30_000, // poll every 30s as fallback
  });
}
