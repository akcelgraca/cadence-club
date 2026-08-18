jest.mock('./supabase', () => {
  const { createSupabaseMock } = require('../test-utils/supabaseMock');
  return { supabase: createSupabaseMock() };
});

import { supabase } from './supabase';
import type { SupabaseMock } from '../test-utils/supabaseMock';
import { gatingEnabled, getMySubscription, FREE_STATE } from './subscription';

const mockSupabase = supabase as unknown as SupabaseMock;

describe('getMySubscription', () => {
  it('lê o estado do servidor', async () => {
    mockSupabase.setRpc('get_my_subscription', {
      data: {
        is_premium: true,
        status: 'active',
        store: 'app_store',
        product_id: 'cadence_premium_annual',
        current_period_end: '2027-08-03T00:00:00.000Z',
        will_renew: true,
      },
    });

    await expect(getMySubscription()).resolves.toEqual({
      isPremium: true,
      status: 'active',
      store: 'app_store',
      productId: 'cadence_premium_annual',
      currentPeriodEnd: '2027-08-03T00:00:00.000Z',
      willRenew: true,
    });
  });

  it('degrada para o plano gratuito quando a rede falha', async () => {
    // Assumir premium em caso de dúvida abria a porta a bloquear a rede e
    // ter tudo de graça.
    mockSupabase.setRpc('get_my_subscription', { error: { message: 'timeout' } });
    await expect(getMySubscription()).resolves.toEqual(FREE_STATE);
  });

  it('degrada para o plano gratuito quando não vem linha', async () => {
    mockSupabase.setRpc('get_my_subscription', { data: null });
    await expect(getMySubscription()).resolves.toEqual(FREE_STATE);
  });

  it('trata campos em falta como plano gratuito', async () => {
    mockSupabase.setRpc('get_my_subscription', { data: { is_premium: false } });

    const estado = await getMySubscription();
    expect(estado.isPremium).toBe(false);
    expect(estado.willRenew).toBe(false);
    expect(estado.currentPeriodEnd).toBeNull();
  });

  it('mantém o acesso a quem cancelou mas ainda tem período pago', async () => {
    // will_renew false não é o mesmo que sem acesso — o servidor decide pelo
    // current_period_end, e o cliente limita-se a respeitar.
    mockSupabase.setRpc('get_my_subscription', {
      data: {
        is_premium: true,
        status: 'active',
        store: 'play_store',
        product_id: 'cadence_premium_monthly',
        current_period_end: '2026-09-01T00:00:00.000Z',
        will_renew: false,
      },
    });

    const estado = await getMySubscription();
    expect(estado.isPremium).toBe(true);
    expect(estado.willRenew).toBe(false);
  });
});

describe('gatingEnabled', () => {
  it('lê a flag do servidor', async () => {
    mockSupabase.setRpc('premium_gating_enabled', { data: true });
    await expect(gatingEnabled()).resolves.toBe(true);
  });

  it('devolve false quando o gating está desligado', async () => {
    mockSupabase.setRpc('premium_gating_enabled', { data: false });
    await expect(gatingEnabled()).resolves.toBe(false);
  });

  it('em erro deixa a app aberta', async () => {
    // Falhar a ler a flag não pode fechar funcionalidades a quem já as usava.
    // O contrário — assumir que está fechado — transformava uma falha de rede
    // num paywall para toda a gente. Os limites a sério são impostos no
    // servidor, por isso arriscar aqui não custa nada.
    mockSupabase.setRpc('premium_gating_enabled', {
      data: null,
      error: { message: 'network' },
    });
    await expect(gatingEnabled()).resolves.toBe(false);
  });

  it('não confunde um valor estranho com verdadeiro', async () => {
    mockSupabase.setRpc('premium_gating_enabled', { data: 'sim' });
    await expect(gatingEnabled()).resolves.toBe(false);
  });
});
