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
