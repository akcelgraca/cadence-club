import { readFileSync } from 'node:fs';
import path from 'node:path';

const raiz = path.resolve(__dirname, '../..');
const authStore = readFileSync(path.join(raiz, 'src/store/authStore.ts'), 'utf8');

/**
 * O `authStore` é o único sítio onde uma sessão começa, e há seis caminhos para
 * lá chegar: restauro no arranque (com e sem perfil), registo, entrada por
 * email, por Google e pela Apple. Ligar os serviços externos em cada um deles à
 * mão é o tipo de coisa que fica bem hoje e parte quando se acrescentar o
 * sétimo.
 *
 * O que se perde quando um caminho fica de fora: o PostHog passa a ver um
 * utilizador anónimo (e a retenção deixa de querer dizer nada), e o RevenueCat
 * fica com um `appUserID` inventado — a compra é feita, o webhook não a
 * consegue ligar a uma conta, e alguém paga sem receber.
 */
describe('ciclo de vida da sessão', () => {
  it('todo o caminho que estabelece sessão avisa os serviços externos', () => {
    const linhas = authStore.split('\n');

    // Cada `set({...})` do store, apanhado até ao fecho: alguns cabem numa
    // linha, outros não.
    const chamadas: { linha: number; corpo: string }[] = [];
    linhas.forEach((l, i) => {
      if (!l.includes('set({')) return;
      const corpo = linhas.slice(i, i + 8).join('\n');
      chamadas.push({ linha: i, corpo: corpo.slice(0, corpo.indexOf('})') + 2) });
    });

    // Só interessam os que atribuem uma sessão a sério — o `session: null` do
    // logout não conta.
    const estabelece = chamadas.filter(
      ({ corpo }) => /\bsession\b/.test(corpo) && !/session:\s*null/.test(corpo),
    );

    // Arranque com perfil, arranque sem perfil, registo, email, Google, Apple.
    expect(estabelece.length).toBeGreaterThanOrEqual(6);

    const semAviso = estabelece.filter(
      ({ linha }) =>
        !linhas.slice(Math.max(0, linha - 8), linha).some((l) => l.includes('onSessionStarted(')),
    );

    expect(semAviso.map(({ linha }) => `authStore.ts:${linha + 1}`)).toEqual([]);
  });

  it('o authStore não liga os serviços externos por fora do session.ts', () => {
    // Senão o teste acima passava a ser decorativo: bastava chamar um e
    // esquecer o outro.
    expect(authStore).not.toMatch(/\bidentifyUser\s*\(/);
    expect(authStore).not.toMatch(/\bresetAnalytics\s*\(/);
    expect(authStore).not.toMatch(/from '\.\.\/services\/purchases'/);
  });

  it('o session.ts liga mesmo os dois', () => {
    const src = readFileSync(path.join(raiz, 'src/services/session.ts'), 'utf8');
    const inicio = src.slice(src.indexOf('export function onSessionStarted'));
    expect(inicio).toMatch(/identifyUser\(userId\)/);
    expect(inicio).toMatch(/ligarCompras\(userId\)/);
  });
});
