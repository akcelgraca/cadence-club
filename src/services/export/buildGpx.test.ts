import { buildGpx, nomeDoFicheiro } from './buildGpx';
import { parseGpx } from '../import/parseGpx';

/**
 * O teste que interessa é de ida e volta.
 *
 * A app já sabe **ler** GPX desde 18 de agosto. Escrever um e voltar a lê-lo
 * com o próprio `parseGpx` prova o formato de uma maneira que nenhuma
 * comparação de strings prova: se o que sai não voltar a entrar, também não
 * entra no Garmin Connect nem no Komoot — e isso só se descobria com alguém a
 * tentar e a não perceber porquê.
 */

/**
 * O `parseGpx` devolve `null` para ficheiros que não consegue ler. Aqui isso
 * seria falha do que acabámos de escrever, e não vale calar o compilador com
 * um `!` — se acontecer, o teste deve dizer exatamente isso.
 */
function lerOuFalhar(gpx: string) {
  const t = parseGpx(gpx);
  if (!t) throw new Error('o nosso próprio leitor recusou o GPX que acabámos de gerar');
  return t;
}

const atividade = {
  type: 'run' as const,
  title: 'Corrida da manhã',
  description: null,
  start_time: '2026-08-26T07:00:00.000Z',
};

const pontos = [
  { lat: 38.7223, lng: -9.1393, elevation: 12.5, timestamp: '2026-08-26T07:00:00.000Z', heartRate: 132 },
  { lat: 38.7233, lng: -9.1403, elevation: 14.0, timestamp: '2026-08-26T07:00:10.000Z', heartRate: 141 },
  { lat: 38.7243, lng: -9.1413, elevation: 15.5, timestamp: '2026-08-26T07:00:20.000Z', heartRate: 148 },
];

describe('buildGpx — ida e volta pelo nosso próprio leitor', () => {
  const gpx = buildGpx(atividade, pontos);
  const lido = lerOuFalhar(gpx);

  it('os pontos sobrevivem', () => {
    expect(lido.points).toHaveLength(3);
    expect(lido.points[0].lat).toBeCloseTo(38.7223, 5);
    expect(lido.points[0].lng).toBeCloseTo(-9.1393, 5);
  });

  it('a altimetria sobrevive', () => {
    expect(lido.points.map((p) => p.elevation)).toEqual([12.5, 14, 15.5]);
  });

  it('os tempos sobrevivem, e em ordem', () => {
    expect(lido.points.map((p) => p.time)).toEqual([
      '2026-08-26T07:00:00.000Z',
      '2026-08-26T07:00:10.000Z',
      '2026-08-26T07:00:20.000Z',
    ]);
  });

  it('a frequência cardíaca sobrevive', () => {
    // Não cabe no GPX base — vai na extensão da Garmin, que é o que o Strava
    // escreve e o que o nosso leitor procura.
    expect(lido.points.map((p) => p.heartRate)).toEqual([132, 141, 148]);
  });

  it('o nome e a modalidade sobrevivem', () => {
    expect(lido.name).toBe('Corrida da manhã');
    expect(lido.rawType).toBe('running');
  });
});

describe('buildGpx — o que costuma partir ficheiros', () => {
  it('escapa texto do utilizador', () => {
    // "Corrida & bicicleta" chega para o XML deixar de abrir em qualquer lado,
    // e o erro apareceria do outro lado, dias depois.
    const gpx = buildGpx(
      { ...atividade, title: 'Corrida & bicicleta <rápida>', description: 'Fui com o "João"' },
      pontos,
    );
    expect(gpx).toContain('Corrida &amp; bicicleta &lt;rápida&gt;');
    expect(gpx).not.toMatch(/<name>[^<]*&(?!amp;|lt;|gt;|quot;|apos;)/);
    expect(lerOuFalhar(gpx).name).toBe('Corrida & bicicleta <rápida>');
  });

  it('aguenta pontos sem altimetria e sem batimento', () => {
    const gpx = buildGpx(atividade, [
      { lat: 1, lng: 2, timestamp: '2026-08-26T07:00:00.000Z' },
    ]);
    expect(gpx).not.toContain('<ele>');
    expect(gpx).not.toContain('gpxtpx:hr');
    expect(lerOuFalhar(gpx).points).toHaveLength(1);
  });

  it('uma modalidade sem equivalente sai como running em vez de se perder', () => {
    // Uma atividade com o tipo errado corrige-se do outro lado; uma atividade
    // recusada por tipo desconhecido perde-se.
    const gpx = buildGpx({ ...atividade, type: 'yoga' as any }, pontos);
    expect(lerOuFalhar(gpx).rawType).toBe('running');
  });

  it('as coordenadas não perdem precisão que interesse', () => {
    // Seis casas são ~11 cm. Menos do que isso e o traçado ganha degraus.
    const gpx = buildGpx(atividade, [
      { lat: 38.722301, lng: -9.139299, timestamp: '2026-08-26T07:00:00.000Z' },
    ]);
    expect(gpx).toContain('lat="38.722301"');
    expect(gpx).toContain('lon="-9.139299"');
  });
});

describe('nomeDoFicheiro', () => {
  it('leva a data e um título legível', () => {
    expect(nomeDoFicheiro(atividade)).toBe('2026-08-26-corrida-da-manha.gpx');
  });

  it('não deixa passar nada que parta um caminho', () => {
    // Uma barra no título criava uma pasta, ou fazia a escrita falhar.
    const n = nomeDoFicheiro({ ...atividade, title: 'Treino 10/08 "duro": manhã' });
    expect(n).not.toMatch(/[\/\\:"]/);
    expect(n.endsWith('.gpx')).toBe(true);
  });

  it('sem título continua a dar um nome válido', () => {
    expect(nomeDoFicheiro({ ...atividade, title: null })).toBe('2026-08-26-atividade.gpx');
  });
});
