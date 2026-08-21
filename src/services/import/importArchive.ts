import { gunzipSync, strFromU8, unzipSync } from 'fflate';
import { supabase } from '../supabase';
import type { ActivityWindow } from '../health/types';
import { detectFormat, importTrackFile, type ImportContext } from './importFile';
import type { ArchiveOutcome, ArchiveProgress, ImportFailure } from './types';

/**
 * Importação em lote a partir de um arquivo (o `.zip` do Strava).
 *
 * PORQUÊ: importar um ficheiro de cada vez resolve o caso de quem quer trazer
 * a corrida de domingo. Não resolve o que trava mesmo a mudança de app — anos
 * de histórico. Quem tem 2000 atividades no Strava não as importa uma a uma.
 *
 * O QUE O ARQUIVO DO STRAVA TEM DE PARTICULAR: cada atividade vem **comprimida
 * duas vezes**. O zip contém `activities/1234567890.fit.gz` — gzip dentro de
 * zip. Um leitor de zip normal devolve os bytes ainda gzipados, e o parser
 * recebe lixo.
 */

/** Entradas decomprimidas de cada vez. Ver `importStravaArchive`. */
const TAMANHO_DO_LOTE = 25;

/** Ficheiros que não são atividades e aparecem no arquivo do Strava. */
function ehEntradaDeAtividade(nome: string): boolean {
  // O macOS mete uma pasta de metadados em qualquer zip que crie.
  if (nome.startsWith('__MACOSX/') || nome.includes('/._')) return false;
  if (nome.endsWith('/')) return false;
  return detectFormat(nomeInterno(nome)) !== null;
}

/**
 * O nome sem a camada do gzip.
 *
 * `activities/123.fit.gz` → `activities/123.fit`, que é o que o
 * `detectFormat` sabe interpretar.
 */
export function nomeInterno(nome: string): string {
  return nome.toLowerCase().endsWith('.gz') ? nome.slice(0, -3) : nome;
}

/**
 * Lista as entradas sem descomprimir nada.
 *
 * O `filter` do fflate é chamado para cada entrada e decide se ela é
 * expandida. Devolvendo sempre false, percorre-se o índice do zip e não se
 * gasta memória com o conteúdo.
 */
export function listarAtividades(zip: Uint8Array): string[] {
  const nomes: string[] = [];
  unzipSync(zip, {
    filter: (f) => {
      if (ehEntradaDeAtividade(f.name)) nomes.push(f.name);
      return false;
    },
  });
  // Os nomes do Strava são ids crescentes no tempo, portanto ordenar por nome
  // aproxima a ordem cronológica — o histórico entra do mais antigo para o
  // mais recente, que é como faz sentido lê-lo depois.
  return nomes.sort();
}

/** Conteúdo de uma entrada, já sem gzip e na forma que o parser quer. */
export function conteudoDaEntrada(nome: string, bruto: Uint8Array): string | Uint8Array {
  const bytes = nome.toLowerCase().endsWith('.gz') ? gunzipSync(bruto) : bruto;
  // O FIT é binário; os outros dois são XML. O `strFromU8` do fflate faz a
  // descodificação UTF-8 sem depender do `TextDecoder`, que não existe em
  // todas as versões do Hermes.
  return detectFormat(nomeInterno(nome)) === 'fit' ? bytes : strFromU8(bytes);
}

/** As janelas de tudo o que o utilizador já tem. Uma consulta, não duas mil. */
async function lerTodasAsJanelas(userId: string): Promise<ActivityWindow[]> {
  const { data } = await supabase
    .from('activities')
    .select('start_time, end_time, source, external_id')
    .eq('user_id', userId);

  // Sem lista não se deduplica contra o que já lá está — mas importar na mesma
  // é melhor do que falhar: a restrição de `external_id` na base de dados
  // continua a apanhar o reimport do mesmo ficheiro.
  if (!Array.isArray(data)) return [];

  return data.map((a: any) => ({
    startTime: a.start_time,
    endTime: a.end_time,
    source: a.source,
    externalId: a.external_id,
  }));
}

export interface ArchiveOptions {
  onProgress?: (p: ArchiveProgress) => void;
  /** Chamada entre lotes. Devolver true interrompe o que falta. */
  deveParar?: () => boolean;
}

/**
 * Importa um arquivo inteiro.
 *
 * **Por lotes, e não tudo de uma vez.** O `unzipSync` expande o que o filtro
 * deixar passar; expandir 2000 atividades para memória de uma vez rebenta num
 * telemóvel. Com lotes, o que está expandido a cada momento são 25 ficheiros,
 * e o resto continua comprimido dentro do zip.
 *
 * **Uma consulta à base de dados, não uma por ficheiro.** As janelas são lidas
 * uma vez e vão crescendo em memória à medida que as atividades entram — o que
 * também faz a deduplicação funcionar *dentro* do próprio arquivo, onde os
 * duplicados são comuns.
 */
export async function importStravaArchive(
  zip: Uint8Array,
  opcoes: ArchiveOptions = {},
): Promise<ArchiveOutcome> {
  const resultado: ArchiveOutcome = {
    total: 0, imported: 0, skipped: 0, failed: 0, failures: {}, cancelled: false,
  };

  let nomes: string[];
  try {
    nomes = listarAtividades(zip);
  } catch (err: any) {
    return { ...resultado, error: err?.message ?? 'arquivo ilegível' };
  }

  resultado.total = nomes.length;
  if (nomes.length === 0) return { ...resultado, error: 'sem atividades no arquivo' };

  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { ...resultado, error: 'sessão expirada' };

  const contexto: ImportContext = {
    janelas: await lerTodasAsJanelas(user.user.id),
    userId: user.user.id,
  };

  for (let i = 0; i < nomes.length; i += TAMANHO_DO_LOTE) {
    if (opcoes.deveParar?.()) {
      resultado.cancelled = true;
      break;
    }

    const lote = new Set(nomes.slice(i, i + TAMANHO_DO_LOTE));
    let expandido: Record<string, Uint8Array>;
    try {
      expandido = unzipSync(zip, { filter: (f) => lote.has(f.name) });
    } catch (err: any) {
      // Um lote ilegível não deita fora o arquivo todo.
      resultado.failed += lote.size;
      resultado.failures.malformed = (resultado.failures.malformed ?? 0) + lote.size;
      continue;
    }

    for (const nome of lote) {
      const bruto = expandido[nome];
      if (!bruto) {
        resultado.failed += 1;
        resultado.failures.malformed = (resultado.failures.malformed ?? 0) + 1;
        continue;
      }

      try {
        const conteudo = conteudoDaEntrada(nome, bruto);
        const r = await importTrackFile(nomeInterno(nome), conteudo, contexto);

        if (r.imported > 0) {
          resultado.imported += r.imported;
          // Faz o ficheiro seguinte ser deduplicado contra este.
          if (r.janela) contexto.janelas.push(r.janela);
        } else if (r.failure) {
          resultado.failed += 1;
          resultado.failures[r.failure] = (resultado.failures[r.failure] ?? 0) + 1;
        } else {
          resultado.skipped += r.skipped || 1;
        }
      } catch {
        // Um ficheiro estragado no meio de 2000 não pode parar a importação.
        resultado.failed += 1;
        resultado.failures.malformed = (resultado.failures.malformed ?? 0) + 1;
      }

      opcoes.onProgress?.({
        done: resultado.imported + resultado.skipped + resultado.failed,
        total: resultado.total,
        imported: resultado.imported,
      });
    }
  }

  return resultado;
}

/** Só para o tipo ser exportado a partir daqui também. */
export type { ImportFailure };
