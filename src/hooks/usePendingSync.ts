import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { getPendingCount, syncPendingActivities } from '../services/pendingSync';
import { useNetworkStatus } from './useNetworkStatus';

/**
 * Envia as atividades que ficaram em fila.
 *
 * Tenta ao arrancar, quando a rede volta e quando a app regressa ao primeiro
 * plano — os três momentos em que é plausível haver ligação outra vez.
 */
export function usePendingSync() {
  const { isConnected } = useNetworkStatus();
  const queryClient = useQueryClient();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const runningRef = useRef(false);

  const refreshCount = useCallback(async () => {
    setPendingCount(await getPendingCount());
  }, []);

  const runSync = useCallback(async () => {
    // Duas sincronizações em paralelo duplicariam atividades
    if (runningRef.current) return;
    const count = await getPendingCount();
    if (count === 0) {
      setPendingCount(0);
      return;
    }

    runningRef.current = true;
    setSyncing(true);
    try {
      const result = await syncPendingActivities();
      if (result.sent > 0) {
        queryClient.invalidateQueries({ queryKey: ['myActivities'] });
        queryClient.invalidateQueries({ queryKey: ['historyActivities'] });
        queryClient.invalidateQueries({ queryKey: ['feed'] });
        queryClient.invalidateQueries({ queryKey: ['profileStats'] });
        queryClient.invalidateQueries({ queryKey: ['weeklySummary'] });
        queryClient.invalidateQueries({ queryKey: ['weeklyDailyBreakdown'] });
        queryClient.invalidateQueries({ queryKey: ['monthlyStats'] });
      }
      setPendingCount(result.failed);
    } finally {
      runningRef.current = false;
      setSyncing(false);
    }
  }, [queryClient]);

  // Arranque e sempre que a ligação volta
  useEffect(() => {
    refreshCount();
    if (isConnected) runSync();
  }, [isConnected, runSync, refreshCount]);

  // Regresso ao primeiro plano
  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === 'active' && isConnected) runSync();
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [isConnected, runSync]);

  return { pendingCount, syncing, runSync };
}
