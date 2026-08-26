import type { ActivityType } from '../../lib/types';

/**
 * Constrói o GPX de uma atividade.
 *
 * Função pura de propósito: recebe os dados, devolve texto. Toda a parte que
 * mexe em rede, ficheiros e partilha vive no `exportActivityGpx`, e assim o
 * formato — que é onde os erros são silenciosos — pode ser testado contra o
 * `parseGpx` que já existe do lado da importação.
 *
 * **Porquê exportar.** A app importa do Strava e do Garmin desde 20 de agosto,
 * e não deixava sair nada. Prender os dados de quem os gravou é exatamente a
 * crítica que se faz ao Strava, e um GPX abre a porta ao Garmin Connect, ao
 * Komoot, ao Runalyze e a qualquer coisa que venha a seguir.
 */

export interface PontoParaExportar {
  lat: number;
  lng: number;
  elevation?: number | null;
  /** ISO 8601. */
  timestamp: string;
  heartRate?: number | null;
}

export interface AtividadeParaExportar {
  type: ActivityType;
  title?: string | null;
  description?: string | null;
  start_time: string;
}

/**
 * O XML não perdoa texto do utilizador por escapar.
 *
 * O título e a descrição são escritos por pessoas, e basta um `&` ou um `<`
 * para o ficheiro deixar de abrir em qualquer lado — sem erro nenhum da nossa
 * parte, porque nós já o tínhamos entregue. "Corrida & bicicleta" chega para o
 * partir.
 */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Modalidade da app → o que os outros serviços esperam ler.
 *
 * O `<type>` do GPX não tem vocabulário normalizado; na prática toda a gente
 * segue os nomes que o Strava usa. O que não estiver aqui sai como `running`,
 * que é o que o nosso próprio `parseGpx` assume quando não há tipo declarado —
 * uma atividade com o tipo errado corrige-se, uma atividade recusada perde-se.
 */
const TIPO_GPX: Partial<Record<ActivityType, string>> = {
  run: 'running',
  trail_run: 'running',
  walk: 'walking',
  stroll: 'walking',
  cycle: 'cycling',
  ebike: 'cycling',
  mtb: 'cycling',
  swimming: 'swimming',
  kayak: 'kayaking',
  rowing: 'rowing',
  stand_up_paddle: 'paddling',
  ice_skating: 'skating',
  wheelchair: 'wheelchair',
  canoeing: 'canoeing',
  sailing: 'sailing',
  surf: 'surfing',
  skateboard: 'skateboarding',
  alpine_skiing: 'skiing',
  snowboard: 'snowboarding',
};

/** Seis casas decimais dão ~11 cm — mais do que qualquer GPS de telemóvel sabe. */
const casas = (n: number) => n.toFixed(6);

export function buildGpx(
  atividade: AtividadeParaExportar,
  pontos: PontoParaExportar[],
): string {
  const nome = atividade.title?.trim() || 'Cadence Club';
  const tipo = TIPO_GPX[atividade.type] ?? 'running';

  const trkpts = pontos.map((p) => {
    const partes = [`      <trkpt lat="${casas(p.lat)}" lon="${casas(p.lng)}">`];
    if (typeof p.elevation === 'number' && Number.isFinite(p.elevation)) {
      partes.push(`        <ele>${p.elevation.toFixed(1)}</ele>`);
    }
    partes.push(`        <time>${p.timestamp}</time>`);
    // O batimento não cabe no GPX base. O caminho que toda a gente usa é a
    // extensão da Garmin — é o que o Strava escreve e o que o nosso parseGpx
    // já sabe ler, por qualquer chave que acabe em `hr`.
    if (typeof p.heartRate === 'number' && Number.isFinite(p.heartRate)) {
      partes.push(
        '        <extensions>',
        '          <gpxtpx:TrackPointExtension>',
        `            <gpxtpx:hr>${Math.round(p.heartRate)}</gpxtpx:hr>`,
        '          </gpxtpx:TrackPointExtension>',
        '        </extensions>',
      );
    }
    partes.push('      </trkpt>');
    return partes.join('\n');
  });

  const descricao = atividade.description?.trim()
    ? `    <desc>${escapar(atividade.description.trim())}</desc>\n`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Cadence Club"
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapar(nome)}</name>
    <time>${atividade.start_time}</time>
  </metadata>
  <trk>
    <name>${escapar(nome)}</name>
${descricao}    <type>${tipo}</type>
    <trkseg>
${trkpts.join('\n')}
    </trkseg>
  </trk>
</gpx>
`;
}

/** Nome de ficheiro seguro em qualquer sistema, a partir do título e da data. */
export function nomeDoFicheiro(atividade: AtividadeParaExportar): string {
  const data = atividade.start_time.slice(0, 10);
  const base = (atividade.title?.trim() || 'atividade')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')     // tira acentos
    .replace(/[^a-z0-9]+/g, '-')          // barras e dois-pontos partem caminhos
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'atividade';
  return `${data}-${base}.gpx`;
}
