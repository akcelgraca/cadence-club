import { lightColors, darkColors, resolveTheme } from './theme';

/**
 * Duas paletas que têm de andar a par.
 *
 * O modo escuro parte de uma maneira silenciosa: acrescenta-se uma cor nova ao
 * modo claro, esquece-se a escura, e o `undefined` que sai daí não estoira —
 * vira uma borda invisível ou um texto preto sobre preto num ecrã que ninguém
 * abriu ainda.
 */
describe('paletas', () => {
  it('têm exatamente as mesmas chaves', () => {
    const claras = Object.keys(lightColors).sort();
    const escuras = Object.keys(darkColors).sort();

    expect(escuras.filter((k) => !claras.includes(k))).toEqual([]);
    expect(claras.filter((k) => !escuras.includes(k))).toEqual([]);
  });

  it('nenhuma cor fica por definir', () => {
    for (const [chave, valor] of Object.entries(darkColors)) {
      expect(`${chave}=${valor}`).toMatch(/=(#|rgba?\(|light|dark)/);
    }
  });

  it('as duas diferem mesmo — não é a mesma paleta duas vezes', () => {
    // Já aconteceu neste ficheiro: `colors` e `lightColors` são cópias uma da
    // outra. Uma paleta escura copiada passaria em tudo o resto.
    expect(darkColors.background).not.toBe(lightColors.background);
    expect(darkColors.foreground).not.toBe(lightColors.foreground);
  });
});

describe('resolveTheme', () => {
  it('a preferência explícita ganha ao sistema', () => {
    expect(resolveTheme('dark', 'light')).toBe(darkColors);
    expect(resolveTheme('light', 'dark')).toBe(lightColors);
  });

  it("'system' segue o telemóvel", () => {
    expect(resolveTheme('system', 'dark')).toBe(darkColors);
    expect(resolveTheme('system', 'light')).toBe(lightColors);
  });

  it("'system' fica em claro enquanto o sistema não responde", () => {
    // No arranque o valor chega como null (e no Android pode vir
    // 'unspecified'). Escurecer por um instante e voltar atrás seria pior do
    // que começar como a app sempre começou.
    expect(resolveTheme('system', null)).toBe(lightColors);
    expect(resolveTheme('system', undefined)).toBe(lightColors);
    expect(resolveTheme('system', 'unspecified')).toBe(lightColors);
  });
});

describe('nada volta a ficar preso ao tema claro', () => {
  const { readFileSync } = require('node:fs');
  const { execSync } = require('node:child_process');
  const path = require('node:path');
  const raiz = path.resolve(__dirname, '../..');

  it('nenhum ficheiro importa uma paleta fixa', () => {
    // `lightColors`/`darkColors` importados diretamente num ecrã dão o mesmo
    // resultado que o antigo `colors`: um `StyleSheet.create` avaliado uma vez,
    // com uma paleta que nunca muda. Tudo tem de passar pelo useColors().
    const ficheiros: string[] = execSync(
      'find src -name "*.tsx" -o -name "*.ts"',
      { cwd: raiz, encoding: 'utf8' },
    ).trim().split('\n')
      .filter((f: string) => !f.includes('lib/theme') && !f.includes('hooks/useColors') && !f.includes('.test.'));

    const infratores = ficheiros.filter((f: string) =>
      /import[^;]*\b(colors|lightColors|darkColors)\b[^;]*from[^;]*theme/.test(
        readFileSync(path.join(raiz, f), 'utf8'),
      ),
    );

    expect(infratores).toEqual([]);
  });
});
