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

  it('todas as chamadas t() apontam para uma chave que existe', () => {
    const emFalta: string[] = [];

    for (const ficheiro of ficheirosDeCodigo()) {
      const src = readFileSync(path.join(raiz, ficheiro), 'utf8');
      for (const m of src.matchAll(/\bt\(\s*['"]([a-z_0-9]+)['"]/g)) {
        if (!existentes.has(m[1])) emFalta.push(`${m[1]} (${ficheiro})`);
      }
    }

    expect(emFalta).toEqual([]);
  });
});
