import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import {
  connectHealth, isHealthAvailable, isHealthConnected, syncHealthWorkouts,
} from '../services/health/sync';
import { seedHealthKitWorkouts } from '../services/health/devSeed';
import type { SyncOutcome } from '../services/health/types';

/**
 * Ligação à Saúde (iOS) ou ao Health Connect (Android).
 *
 * Substitui os antigos useHealthKit e useHealthConnect, que punham
 * `isAuthorized = true` sem falar com nada. Quem ligasse via "ligado" e nunca
 * recebia um treino — pior do que não ter o botão.
 *
 * Aqui, `isConnected` só é verdadeiro depois de a plataforma confirmar.
 */
export function useHealthSync() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<SyncOutcome | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const disponivel = await isHealthAvailable();
      const ligado = disponivel ? await isHealthConnected() : false;
      if (!ativo) return;
      setIsAvailable(disponivel);
      setIsConnected(ligado);
      setIsChecking(false);
    })();
    return () => { ativo = false; };
  }, []);

  /** Pede permissão e importa. Devolve se ficou ligado. */
  const connect = useCallback(async (): Promise<boolean> => {
    setIsSyncing(true);
    try {
      const { connected, outcome } = await connectHealth();
      setIsConnected(connected);
      if (outcome) setLastOutcome(outcome);
      return connected;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  /** Importa o que houver de novo. Não faz nada se não estiver ligado. */
  const sync = useCallback(async (): Promise<SyncOutcome | null> => {
    if (!isConnected) return null;
    setIsSyncing(true);
    try {
      const outcome = await syncHealthWorkouts();
      setLastOutcome(outcome);
      return outcome;
    } finally {
      setIsSyncing(false);
    }
  }, [isConnected]);

  /**
   * Só em desenvolvimento: escreve treinos falsos no HealthKit e importa-os.
   * É a única forma de testar isto no simulador — ver devSeed.ts.
   */
  const seedAndSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      const semente = await seedHealthKitWorkouts();
      if (semente.error) return { seeded: 0, outcome: null, error: semente.error };
      // includeOwnWorkouts porque os treinos foram escritos por esta app e o
      // filtro recordedByUs descartá-los-ia todos.
      const outcome = await syncHealthWorkouts({ includeOwnWorkouts: true });
      setLastOutcome(outcome);
      return { seeded: semente.created, outcome, error: undefined };
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return {
    /** A plataforma suporta e o módulo nativo está presente. */
    isAvailable,
    /** Confirmado pela plataforma, não assumido. */
    isConnected,
    isChecking,
    isSyncing,
    lastOutcome,
    connect,
    sync,
    seedAndSync,
    canSeed: __DEV__ && Platform.OS === 'ios',
    platformName: Platform.OS === 'ios' ? 'Apple Saúde' : 'Health Connect',
  };
}
