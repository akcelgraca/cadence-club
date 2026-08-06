jest.mock('./supabase', () => {
  const { createSupabaseMock } = require('../test-utils/supabaseMock');
  return { supabase: createSupabaseMock() };
});

import { supabase } from './supabase';
import type { SupabaseMock } from '../test-utils/supabaseMock';
import { metersToLatDegrees } from '../test-utils/geoFixtures';
import {
  trimRouteForZones,
  getMyPrivacyZones,
  createPrivacyZone,
  applyZonesToAllActivities,
  type PrivacyZone,
} from './privacyZones';

const mockSupabase = supabase as unknown as SupabaseMock;

const CASA = { lat: 38.7223, lng: -9.1393 };

function zona(overrides: Partial<PrivacyZone> = {}): PrivacyZone {
  return { id: 'zona-1', label: 'Casa', ...CASA, radius: 200, ...overrides };
}

/** Ponto a N metros a norte de casa. */
function aNorte(metros: number) {
  return { lat: CASA.lat + metersToLatDegrees(metros), lng: CASA.lng };
}

describe('trimRouteForZones', () => {
  it('devolve o traçado intacto quando não há zonas', () => {
    const pontos = [aNorte(0), aNorte(500)];
    expect(trimRouteForZones(pontos, [])).toBe(pontos);
  });

  it('remove os pontos dentro do raio', () => {
    const pontos = [aNorte(0), aNorte(100), aNorte(199), aNorte(500)];
    const resultado = trimRouteForZones(pontos, [zona()]);

    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toEqual(aNorte(500));
  });

  it('remove o ponto que cai exatamente em cima do raio', () => {
    // A fronteira pertence à zona: em dúvida, protege-se a morada.
    const resultado = trimRouteForZones([aNorte(200)], [zona({ radius: 200 })]);
    expect(resultado).toEqual([]);
  });

  it('mantém o ponto imediatamente a seguir ao raio', () => {
    const resultado = trimRouteForZones([aNorte(201)], [zona({ radius: 200 })]);
    expect(resultado).toHaveLength(1);
  });

  it('aplica todas as zonas, não só a primeira', () => {
    const trabalho = { lat: 38.75, lng: -9.15 };
    const zonas = [zona(), zona({ id: 'zona-2', label: 'Trabalho', ...trabalho, radius: 300 })];

    const pontos = [
      aNorte(50),                                       // dentro de casa
      { lat: trabalho.lat, lng: trabalho.lng },          // dentro do trabalho
      aNorte(5000),                                      // no meio do caminho
    ];

    expect(trimRouteForZones(pontos, zonas)).toEqual([aNorte(5000)]);
  });

  it('esvazia o traçado quando todo ele cai dentro da zona', () => {
    const zonaGrande = zona({ radius: 5000 });
    expect(trimRouteForZones([aNorte(0), aNorte(100), aNorte(2000)], [zonaGrande])).toEqual([]);
  });

  it('preserva os restantes campos dos pontos', () => {
    const pontos = [
      { ...aNorte(0), elevation: 12, timestamp: '2026-07-15T08:00:00.000Z' },
      { ...aNorte(900), elevation: 30, timestamp: '2026-07-15T08:05:00.000Z' },
    ];
    const resultado = trimRouteForZones(pontos, [zona()]);

    expect(resultado).toEqual([pontos[1]]);
    expect(resultado[0].timestamp).toBe('2026-07-15T08:05:00.000Z');
  });

  it('não altera o array original', () => {
    const pontos = [aNorte(0), aNorte(900)];
    trimRouteForZones(pontos, [zona()]);
    expect(pontos).toHaveLength(2);
  });
});

describe('getMyPrivacyZones', () => {
  it('extrai lat/lng do GeoJSON devolvido pelo PostGIS', () => {
    mockSupabase.setTable('privacy_zones', {
      data: [
        {
          id: 'zona-1',
          label: 'Casa',
          radius: 250,
          created_at: '2026-07-01T00:00:00.000Z',
          // O GeoJSON vem em [lng, lat] — a ordem inversa da habitual.
          center: { type: 'Point', coordinates: [CASA.lng, CASA.lat] },
        },
      ],
    });

    return getMyPrivacyZones().then((zonas) => {
      expect(zonas).toEqual([
        {
          id: 'zona-1',
          label: 'Casa',
          radius: 250,
          created_at: '2026-07-01T00:00:00.000Z',
          lat: CASA.lat,
          lng: CASA.lng,
        },
      ]);
    });
  });

  it('filtra pelo utilizador autenticado', async () => {
    mockSupabase.setUser('user-42');
    mockSupabase.setTable('privacy_zones', { data: [] });

    await getMyPrivacyZones();

    expect(mockSupabase.queryFor('privacy_zones').eq).toHaveBeenCalledWith('user_id', 'user-42');
    mockSupabase.setUser('user-1');
  });

  it('devolve vazio sem sessão iniciada', async () => {
    mockSupabase.setUser(null);
    await expect(getMyPrivacyZones()).resolves.toEqual([]);
    mockSupabase.setUser('user-1');
  });

  it('devolve vazio quando a query falha', async () => {
    mockSupabase.setTable('privacy_zones', { error: { message: 'boom' } });
    await expect(getMyPrivacyZones()).resolves.toEqual([]);
  });

  it('não estoira quando o centro vem noutro formato', async () => {
    // Consoante a versão, o PostgREST devolve WKB em hexadecimal em vez de
    // GeoJSON. Preferimos coordenadas inúteis a uma exceção.
    mockSupabase.setTable('privacy_zones', {
      data: [{ id: 'z', label: 'Casa', radius: 200, center: '0101000020E6100000' }],
    });

    const [zona] = await getMyPrivacyZones();
    expect(zona.lat).toBe(0);
    expect(zona.lng).toBe(0);
  });
});

describe('createPrivacyZone', () => {
  it('escreve o ponto em EWKT com a longitude primeiro', async () => {
    // POINT(lng lat) — trocar a ordem punha a zona no sítio errado do mundo
    // e deixava a morada exposta.
    const query = mockSupabase.setTable('privacy_zones', {});
    mockSupabase.setUser('user-7');

    await createPrivacyZone({ label: 'Casa', lat: CASA.lat, lng: CASA.lng, radius: 300 });

    expect(query.insert).toHaveBeenCalledWith({
      user_id: 'user-7',
      label: 'Casa',
      radius: 300,
      center: `SRID=4326;POINT(${CASA.lng} ${CASA.lat})`,
    });
    mockSupabase.setUser('user-1');
  });

  it('recusa sem sessão iniciada', async () => {
    mockSupabase.setUser(null);
    await expect(
      createPrivacyZone({ label: 'Casa', lat: 0, lng: 0, radius: 200 }),
    ).rejects.toThrow('Not authenticated');
    mockSupabase.setUser('user-1');
  });

  it('propaga o erro da base de dados', async () => {
    mockSupabase.setTable('privacy_zones', { error: { message: 'RLS' } });
    await expect(
      createPrivacyZone({ label: 'Casa', lat: 0, lng: 0, radius: 200 }),
    ).rejects.toEqual({ message: 'RLS' });
  });
});

describe('applyZonesToAllActivities', () => {
  it('devolve o número de atividades reescritas', async () => {
    mockSupabase.setRpc('apply_privacy_zones_to_all', { data: 12 });
    await expect(applyZonesToAllActivities()).resolves.toBe(12);
  });

  it('devolve 0 quando a função falha, em vez de estoirar', async () => {
    mockSupabase.setRpc('apply_privacy_zones_to_all', { error: { message: 'timeout' } });
    await expect(applyZonesToAllActivities()).resolves.toBe(0);
  });

  it('devolve 0 quando não vem contagem', async () => {
    mockSupabase.setRpc('apply_privacy_zones_to_all', { data: null });
    await expect(applyZonesToAllActivities()).resolves.toBe(0);
  });
});
