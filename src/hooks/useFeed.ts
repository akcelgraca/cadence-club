import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { getFeed } from '../services/activities';
import { supabase } from '../services/supabase';
import { FEED_PAGE_SIZE } from '../lib/constants';
import { useFeedStore } from '../store/feedStore';

export function useFeed() {
  const queryClient = useQueryClient();
  const filter = useFeedStore((s) => s.filter);
  const [userId, setUserId] = useState<string | null>(null);

  // Track auth state so query key and subscription react to login/logout
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const query = useInfiniteQuery({
    queryKey: ['feed', userId, filter],
    queryFn: ({ pageParam = 0 }) => getFeed(pageParam, FEED_PAGE_SIZE, filter),
    getNextPageParam: (lastPage, pages) => {
      if (!lastPage || lastPage.length < FEED_PAGE_SIZE) return undefined;
      return pages.length;
    },
    initialPageParam: 0,
    enabled: !!userId,
  });

  // Subscribe to real-time new activities — re-subscribe on auth change
  useEffect(() => {
    if (!userId) return;

    const channelName = 'feed-realtime';

    // Clean up any stale channel with the same name (React Strict Mode / HMR)
    supabase.getChannels().forEach((ch) => {
      if (ch.topic === `realtime:${channelName}`) {
        supabase.removeChannel(ch);
      }
    });

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activities' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['feed'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);

  return query;
}
