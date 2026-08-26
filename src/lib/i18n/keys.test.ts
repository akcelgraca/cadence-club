import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import pt from './pt';

/**
 * Varre o código à procura de `t('alguma_chave')` e confirma que a chave
 * existe. Uma chave em falta não estoira nada — o i18next devolve a própria
 * chave — por isso o utilizador é que veria "plan_bike_long" no ecrã. Este
 * teste apanha isso antes de chegar lá.
 */

const raiz = path.resolve(__dirname, '../../..');

function ficheirosDeCodigo(): string[] {
  return execSync(
    'find src -name "*.tsx" -o -name "*.ts" | grep -v "/i18n/" | grep -v "\\.test\\."',
    { cwd: raiz, encoding: 'utf8' },
  ).trim().split('\n');
}

describe('chaves usadas no código', () => {
  const existentes = new Set(Object.keys(pt));

  /**
   * Uma chave com plural do i18next não existe com o nome por que é chamada:
   * o `t('segment_attempts', { count })` resolve para `segment_attempts_one`
   * ou `segment_attempts_other`, conforme o número. Sem isto, o teste dava a
   * chave como em falta e obrigava a escrever o ternário à mão — que é
   * exatamente o que o `hardcoded.test.ts` passou a proibir.
   */
  function existe(chave: string): boolean {
    return existentes.has(chave)
      || (existentes.has(`${chave}_one`) && existentes.has(`${chave}_other`));
  }

  it('todas as chamadas t() apontam para uma chave que existe', () => {
    const emFalta: string[] = [];

    for (const ficheiro of ficheirosDeCodigo()) {
      const src = readFileSync(path.join(raiz, ficheiro), 'utf8');
      for (const m of src.matchAll(/\bt\(\s*['"]([a-z_0-9]+)['"]/g)) {
        if (!existe(m[1])) emFalta.push(`${m[1]} (${ficheiro})`);
      }
    }

    expect(emFalta).toEqual([]);
  });
});
