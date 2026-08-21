jest.mock('../supabase', () => {
  const { createSupabaseMock } = require('../../test-utils/supabaseMock');
  return { supabase: createSupabaseMock() };
});

// O expo-crypto precisa do módulo nativo. Aqui só interessa que o mesmo
// conteúdo dê sempre o mesmo id — é isso que faz a deduplicação funcionar.
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_a: string, s: string) =>
    's' + Array.from(s).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(16),
  digest: async (_a: string, b: ArrayBuffer) =>
    new Uint8Array([...new Uint8Array(b)].slice(0, 8)).buffer,
}));

import { gzipSync, strToU8, zipSync } from 'fflate';
import { supabase } from '../supabase';
import type { SupabaseMock } from '../../test-utils/supabaseMock';
import {
  conteudoDaEntrada, importStravaArchive, listarAtividades, nomeInterno,
} from './importArchive';

const mock = supabase as unknown as SupabaseMock;

/**
 * Um GPX mínimo mas válido.
 *
 * `minuto` afasta as atividades umas das outras: sobrepostas no tempo, a
 * deduplicação descarta-as — que é o comportamento certo, mas não é o que
 * cada teste quer medir. E dez minutos de duração porque abaixo de um minuto
 * o `planImport` descarta por ser curto de mais.
 */
function gpx(minuto: number): string {
  const inicio = new Date(Date.UTC(2026, 6, 15, 8, minuto, 0));
  const fim = new Date(inicio.getTime() + 10 * 60_000);
  return `<?xml version="1.0"?><gpx><trk><trkseg>
    <trkpt lat="38.7223" lon="-9.1393"><ele>10</ele><time>${inicio.toISOString()}</time></trkpt>
    <trkpt lat="38.7300" lon="-9.1400"><ele>20</ele><time>${fim.toISOString()}</time></trkpt>
  </trkseg></trk></gpx>`;
}

describe('nomeInterno', () => {
  it('tira a camada do gzip', () => {
    // É isto que faz o `detectFormat` reconhecer um `.fit.gz` do Strava.
    expect(nomeInterno('activities/123.fit.gz')).toBe('activities/123.fit');
    expect(nomeInterno('activities/123.gpx')).toBe('activities/123.gpx');
  });
});

describe('listarAtividades', () => {
  const arquivo = zipSync({
    'activities/100.gpx.gz': gzipSync(strToU8(gpx(1))),
    'activities/050.tcx': strToU8('<TrainingCenterDatabase/>'),
    'activities/200.fit.gz': gzipSync(new Uint8Array([1, 2, 3])),
    // Ruído que um arquivo do Strava traz mesmo:
    'activities.csv': strToU8('id,name\n1,Corrida'),
    'profile.json': strToU8('{}'),
    '__MACOSX/activities/._100.gpx': strToU8('lixo'),
  });

  it('encontra só o que é atividade', () => {
    expect(listarAtividades(arquivo)).toEqual([
      'activities/050.tcx',
      'activities/100.gpx.gz',
      'activities/200.fit.gz',
    ]);
  });

  it('ignora a pasta de metadados do macOS', () => {
    expect(listarAtividades(arquivo).some((n) => n.includes('__MACOSX'))).toBe(false);
  });

  it('devolve por ordem de nome, que no Strava é ordem de tempo', () => {
    // Os nomes são ids crescentes, portanto o histórico entra do mais antigo
    // para o mais recente.
    const nomes = listarAtividades(arquivo);
    expect(nomes).toEqual([...nomes].sort());
  });
});

describe('conteudoDaEntrada', () => {
  it('descomprime o gzip que o Strava põe dentro do zip', () => {
    // O engano central deste formato: cada atividade vem comprimida duas
    // vezes. Um leitor de zip normal devolve bytes ainda gzipados.
    const bruto = gzipSync(strToU8(gpx(1)));
    const saida = conteudoDaEntrada('activities/1.gpx.gz', bruto);
    expect(typeof saida).toBe('string');
    expect(saida as string).toContain('<trkpt');
  });

  it('devolve texto para XML e bytes para FIT', () => {
    expect(typeof conteudoDaEntrada('a/1.gpx', strToU8('<gpx/>'))).toBe('string');
    expect(conteudoDaEntrada('a/1.fit', new Uint8Array([1, 2]))).toBeInstanceOf(Uint8Array);
  });
});

describe('importStravaArchive', () => {
  beforeEach(() => {
    mock.setUser('utilizador-1');
    mock.setTable('activities', { data: { id: 'nova' } });
    mock.setTable('activity_points', { data: null });
  });

  it('importa as atividades do arquivo', async () => {
    const arquivo = zipSync({
      'activities/1.gpx.gz': gzipSync(strToU8(gpx(1))),
      'activities/2.gpx.gz': gzipSync(strToU8(gpx(60))),
    });

    const r = await importStravaArchive(arquivo);
    expect(r.total).toBe(2);
    expect(r.imported).toBe(2);
    expect(r.failed).toBe(0);
  });

  it('deduplica dentro do próprio arquivo', async () => {
    // O mesmo treino duas vezes com nomes diferentes — acontece em arquivos
    // do Strava. Sem juntar a janela do que acabou de entrar, os dois passavam.
    const conteudo = gzipSync(strToU8(gpx(1)));
    const arquivo = zipSync({
      'activities/1.gpx.gz': conteudo,
      'activities/2.gpx.gz': conteudo,
    });

    const r = await importStravaArchive(arquivo);
    expect(r.imported).toBe(1);
    expect(r.skipped).toBe(1);
  });

  it('um ficheiro estragado não para os outros', async () => {
    const arquivo = zipSync({
      'activities/1.gpx.gz': gzipSync(strToU8(gpx(1))),
      'activities/2.gpx.gz': gzipSync(strToU8('isto não é xml nenhum')),
      'activities/3.gpx.gz': gzipSync(strToU8(gpx(120))),
    });

    const r = await importStravaArchive(arquivo);
    expect(r.imported).toBe(2);
    expect(r.failed).toBe(1);
    // O motivo é contado, para a interface poder explicar em vez de só somar.
    expect(Object.values(r.failures).reduce((a, b) => a + b, 0)).toBe(1);
  });

  it('vai dizendo como vai indo', async () => {
    const arquivo = zipSync({
      'activities/1.gpx.gz': gzipSync(strToU8(gpx(1))),
      'activities/2.gpx.gz': gzipSync(strToU8(gpx(60))),
    });

    const passos: number[] = [];
    await importStravaArchive(arquivo, { onProgress: (p) => passos.push(p.done) });
    expect(passos).toEqual([1, 2]);
  });

  it('pode ser interrompido, e o que entrou fica', async () => {
    const arquivo = zipSync({
      'activities/1.gpx.gz': gzipSync(strToU8(gpx(1))),
      'activities/2.gpx.gz': gzipSync(strToU8(gpx(60))),
    });

    const r = await importStravaArchive(arquivo, { deveParar: () => true });
    expect(r.cancelled).toBe(true);
    expect(r.imported).toBe(0);
  });

  it('diz quando o arquivo não tem atividades nenhumas', async () => {
    const arquivo = zipSync({ 'leia-me.txt': strToU8('nada aqui') });
    const r = await importStravaArchive(arquivo);
    expect(r.total).toBe(0);
    expect(r.error).toBeTruthy();
  });
});
