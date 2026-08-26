import { supabase } from '../supabase';
import { buildGpx, nomeDoFicheiro, type PontoParaExportar, type AtividadeParaExportar } from './buildGpx';

/**
 * Exporta uma atividade para GPX e entrega-a ao menu de partilha.
 *
 * A parte que mexe em rede, ficheiros e partilha vive aqui; o formato está no
 * `buildGpx`, que é puro e testado. Os módulos nativos são importados dentro da
 * função, como no `useShareActivity`, para não rebentarem no arranque de uma
 * build onde não estejam presentes.
 */

/** Um erro que a interface sabe traduzir, em vez de mostrar texto de sistema. */
export class ErroDeExportacao extends Error {
  constructor(public readonly motivo: 'sem_pontos' | 'sem_partilha' | 'falhou') {
    super(motivo);
  }
}

/**
 * Os pontos vêm em páginas.
 *
 * O PostgREST corta em 1000 linhas por omissão, em silêncio — uma corrida de
 * duas horas a um ponto por segundo são 7200. Sem paginar, exportava-se a
 * primeira meia hora e o ficheiro parecia bom.
 */
const PAGINA = 1000;

async function buscarPontos(activityId: string): Promise<PontoParaExportar[]> {
  const todos: PontoParaExportar[] = [];
  for (let pagina = 0; ; pagina++) {
    const { data, error } = await supabase
      .from('activity_points')
      .select('lat, lng, elevation, timestamp')
      .eq('activity_id', activityId)
      .order('timestamp', { ascending: true })
      .range(pagina * PAGINA, (pagina + 1) * PAGINA - 1);

    if (error) throw new ErroDeExportacao('falhou');
    if (!data?.length) break;
    todos.push(...(data as PontoParaExportar[]));
    if (data.length < PAGINA) break;
  }
  return todos;
}

export async function exportActivityGpx(
  atividade: AtividadeParaExportar & { id: string; avg_heart_rate?: number | null },
): Promise<void> {
  const pontos = await buscarPontos(atividade.id);

  // Uma atividade de ginásio ou vinda da Saúde não tem traçado — os pontos de
  // GPS ficam no relógio. Um GPX sem pontos é um ficheiro que nenhum serviço
  // aceita, e é melhor dizê-lo do que entregar um ficheiro vazio.
  if (pontos.length === 0) throw new ErroDeExportacao('sem_pontos');

  const gpx = buildGpx(atividade, pontos);

  const { File, Paths } = await import('expo-file-system');
  const ficheiro = new File(Paths.cache, nomeDoFicheiro(atividade));
  try {
    ficheiro.create({ overwrite: true });
  } catch {
    // Já existir não é problema — o `write` a seguir substitui o conteúdo.
  }
  ficheiro.write(gpx);

  const partilha = (await import('expo-sharing')) as any;
  const disponivel = partilha.isAvailableAsync ?? partilha.default?.isAvailableAsync;
  const partilhar = partilha.shareAsync ?? partilha.default?.shareAsync;
  if (!disponivel || !partilhar || !(await disponivel())) {
    throw new ErroDeExportacao('sem_partilha');
  }

  await partilhar(ficheiro.uri, {
    // `application/gpx+xml` é o correto, mas há apps no Android que só
    // reconhecem o genérico. O UTI do iOS vai à parte, e é o que decide lá.
    mimeType: 'application/gpx+xml',
    UTI: 'public.xml',
    dialogTitle: nomeDoFicheiro(atividade),
  });
}
