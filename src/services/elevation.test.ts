import { getElevationProfile } from './elevation';

const mockFetch = globalThis.fetch as jest.Mock;

/** Resposta bem-sucedida da Open-Meteo. */
function respostaComElevacoes(elevations: number[] | undefined) {
  return { ok: true, status: 200, json: async () => ({ elevation: elevations }) };
}

/** Caminho de N pontos no formato [lng, lat] usado pelas rotas. */
function caminho(n: number): [number, number][] {
  return Array.from({ length: n }, (_, i) => [-9.1393 + i * 0.001, 38.7223 + i * 0.001]);
}

/** Parâmetros de query do último pedido feito. */
function ultimosParametros(): URLSearchParams {
  const url = mockFetch.mock.calls.at(-1)![0] as string;
  return new URLSearchParams(url.split('?')[1]);
}

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  (console.error as jest.Mock).mockRestore();
});

describe('getElevationProfile', () => {
  it('não vai à rede com menos de dois pontos', async () => {
    await expect(getElevationProfile([])).resolves.toEqual({ elevations: [], elevationGain: 0 });
    await expect(getElevationProfile(caminho(1)))
      .resolves.toEqual({ elevations: [], elevationGain: 0 });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('soma apenas as subidas', async () => {
    // 100 → 150 → 120 → 200: sobe 50, desce 30, sobe 80 = 130 m de ganho.
    mockFetch.mockResolvedValue(respostaComElevacoes([100, 150, 120, 200]));

    await expect(getElevationProfile(caminho(4))).resolves.toEqual({
      elevations: [100, 150, 120, 200],
      elevationGain: 130,
    });
  });

  it('devolve ganho nulo num percurso sempre a descer', async () => {
    mockFetch.mockResolvedValue(respostaComElevacoes([200, 150, 100]));
    const { elevationGain } = await getElevationProfile(caminho(3));
    expect(elevationGain).toBe(0);
  });

  it('arredonda o ganho ao metro', async () => {
    mockFetch.mockResolvedValue(respostaComElevacoes([100, 100.4, 100.9]));
    const { elevationGain } = await getElevationProfile(caminho(3));
    expect(elevationGain).toBe(1);
  });

  it('envia latitudes e longitudes na ordem certa', async () => {
    mockFetch.mockResolvedValue(respostaComElevacoes([10, 20]));

    await getElevationProfile([[-9.1393, 38.7223], [-8.6291, 41.1579]]);

    const params = ultimosParametros();
    // O caminho vem em [lng, lat]; trocar aqui pedia a elevação do sítio errado.
    expect(params.get('latitude')).toBe('38.7223,41.1579');
    expect(params.get('longitude')).toBe('-9.1393,-8.6291');
  });

  describe('amostragem', () => {
    it('não pede mais de 50 pontos à API', async () => {
      mockFetch.mockResolvedValue(respostaComElevacoes(new Array(50).fill(100)));

      await getElevationProfile(caminho(500));

      expect(ultimosParametros().get('latitude')!.split(',')).toHaveLength(50);
    });

    it('mantém o início e o fim do percurso ao amostrar', async () => {
      const percurso = caminho(500);
      mockFetch.mockResolvedValue(respostaComElevacoes(new Array(50).fill(100)));

      await getElevationProfile(percurso);

      const latitudes = ultimosParametros().get('latitude')!.split(',').map(Number);
      expect(latitudes[0]).toBeCloseTo(percurso[0][1], 6);
      expect(latitudes.at(-1)).toBeCloseTo(percurso.at(-1)![1], 6);
    });

    it('não amostra percursos que já cabem no limite', async () => {
      mockFetch.mockResolvedValue(respostaComElevacoes(new Array(10).fill(100)));

      await getElevationProfile(caminho(10));

      expect(ultimosParametros().get('latitude')!.split(',')).toHaveLength(10);
    });
  });

  describe('quando a API não colabora', () => {
    it('devolve perfil vazio num erro HTTP', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });

      await expect(getElevationProfile(caminho(4)))
        .resolves.toEqual({ elevations: [], elevationGain: 0 });
    });

    it('devolve perfil vazio quando a rede falha', async () => {
      mockFetch.mockRejectedValue(new Error('sem rede'));

      await expect(getElevationProfile(caminho(4)))
        .resolves.toEqual({ elevations: [], elevationGain: 0 });
    });

    it('devolve perfil vazio quando a resposta não traz elevações', async () => {
      mockFetch.mockResolvedValue(respostaComElevacoes(undefined));

      await expect(getElevationProfile(caminho(4)))
        .resolves.toEqual({ elevations: [], elevationGain: 0 });
    });

    it('devolve perfil vazio para uma lista de elevações vazia', async () => {
      mockFetch.mockResolvedValue(respostaComElevacoes([]));

      await expect(getElevationProfile(caminho(4)))
        .resolves.toEqual({ elevations: [], elevationGain: 0 });
    });
  });
});
