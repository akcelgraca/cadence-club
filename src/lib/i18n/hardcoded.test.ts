import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

/**
 * Procura texto visível escrito diretamente no JSX, em vez de passar pelo t().
 *
 *   <Text>Última atividade</Text>        ← apanha
 *   <Text>{t('home_last_activity')}</Text>  ← certo
 *
 * Existe porque foi exatamente isto que escapou à primeira migração: a busca
 * inicial só olhou para strings entre aspas, e a maior parte do texto de uma
 * app React Native não está entre aspas — está como conteúdo de JSX.
 */

const raiz = path.resolve(__dirname, '../../..');

/** Palavras que são marca, não texto traduzível. */
const EXCECOES = new Set(['adence', 'Club']);

function ficheirosDeEcra(): string[] {
  return execSync('find src -name "*.tsx" | grep -v "\\.test\\."', {
    cwd: raiz, encoding: 'utf8',
  }).trim().split('\n');
}

/** Descarta o que não é texto: fragmentos de expressões, números, unidades. */
function pareceTexto(s: string): boolean {
  if (s.length < 2) return false;
  if (/[&|?()=<>{}]/.test(s)) return false;          // pedaços de expressões JSX
  if (/^[\d\s.,:%°·—–-]+$/.test(s)) return false;    // só números e pontuação
  if (/^(km|m|kg|h|min|s|ft|mi|mph|bpm|@)$/i.test(s)) return false;
  if (!/[A-Za-zÀ-ÿ]{2}/.test(s)) return false;
  return !EXCECOES.has(s);
}

/**
 * Texto visível passado por propriedade, e não como conteúdo de JSX.
 *
 *   label: 'Tempo'          ← apanha
 *   label: t('post_stat_time')  ← certo
 *
 * Existe porque o `label: 'Tempo'` do WeeklyChartCard escapou à migração de
 * i18n **e** ao teste do JSX: não é conteúdo entre tags, é uma string dentro
 * de um objeto de propriedades.
 */
describe('texto fixo em propriedades', () => {
  /** Propriedades cujo valor chega aos olhos de alguém. */
  const PROPS = ['label', 'title', 'placeholder', 'subtitle', 'accessibilityLabel', 'unit'];

  it('todo o texto passado por propriedade passa pelo t()', () => {
    const encontrados: string[] = [];
    const padrao = new RegExp(`\\b(${PROPS.join('|')})\\s*[:=]\\s*(['"])([^'"\n]{2,})\\2`, 'g');

    for (const ficheiro of ficheirosDeEcra()) {
      const src = readFileSync(path.join(raiz, ficheiro), 'utf8');
      for (const m of src.matchAll(padrao)) {
        const valor = m[3].trim();
        // Basta começar por maiúscula, ou ter acento. A versão anterior exigia
        // acento OU (espaço E maiúscula), e por isso deixou passar as abas do
        // Social e do Perfil — 'Clubes', 'Mensagens', 'Resumo' não têm acento
        // nem espaço. Chaves e identificadores nestas propriedades são
        // minúsculos ou camelCase, portanto a maiúscula chega para os separar.
        const pareceTextoHumano =
          /[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/.test(valor) || /^[A-ZÁÉÍÓÚ]/.test(valor);
        if (pareceTextoHumano) encontrados.push(`${valor}  (${ficheiro})`);
      }
    }

    expect(encontrados).toEqual([]);
  });
});

describe('texto fixo no JSX', () => {
  it('todo o texto visível passa pelo t()', () => {
    const encontrados: string[] = [];

    for (const ficheiro of ficheirosDeEcra()) {
      const src = readFileSync(path.join(raiz, ficheiro), 'utf8');

      // Texto na mesma linha das tags: <Text>Olá</Text>
      // O (?<!=) descarta genéricos como `() => Promise<void>`, onde o ">"
      // vem da seta e não de uma tag.
      for (const m of src.matchAll(/(?<!=)>([^<>{}\n]+)</g)) {
        const s = m[1].trim();
        if (pareceTexto(s)) encontrados.push(`${s}  (${ficheiro})`);
      }

      // Texto numa linha própria entre as tags.
      for (const m of src.matchAll(/>\s*\n\s*([A-Za-zÀ-ÿ][^<>{}\n]+)\s*\n\s*</g)) {
        const s = m[1].trim();
        if (pareceTexto(s)) encontrados.push(`${s}  (${ficheiro})`);
      }
    }

    expect(encontrados).toEqual([]);
  });
});

/**
 * Nomes de mês e etiquetas de locale escritos à mão.
 *
 * Havia quatro listas de meses espalhadas pelo código — todas em português, e
 * uma delas com "Marco" sem cedilha — e `'pt-PT'` escrito à mão em oito
 * sítios. Nada disto passa por `t()`, portanto os outros testes de i18n não o
 * viam: para eles, `['Jan', 'Fev', ...]` é só um array de strings.
 */
describe('datas e locales fixos', () => {
  it('ninguém escreve nomes de mês à mão', () => {
    // Abreviados e por extenso. A primeira versão só cobria os abreviados, e
    // por isso deixou passar `['month_jan', ..., 'Julho', 'Agosto', ...]` no
    // histórico — uma lista meio migrada, com seis chaves e seis literais.
    const meses =
      /'(Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez|Janeiro|Fevereiro|Mar[cç]o|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)'\s*,\s*'/;
    const infratores = ficheirosDeEcra().filter((f) =>
      meses.test(readFileSync(path.join(raiz, f), 'utf8')),
    );
    expect(infratores).toEqual([]);
  });

  it("ninguém fixa o locale em 'pt-PT'", () => {
    // O sítio certo é `localeTag()`, que segue o idioma da app.
    const infratores = ficheirosDeEcra().filter((f) =>
      /['"]pt-PT['"]/.test(readFileSync(path.join(raiz, f), 'utf8')),
    );
    expect(infratores).toEqual([]);
  });
});
