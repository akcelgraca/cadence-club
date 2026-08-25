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

  it('uma sessão criada fora do store é adotada por ele', () => {
    // O bug de 24 ago: o handler de deep links chamava `setSession` e mais
    // nada. O supabase-js ficava com sessão, o store continuava a null, e quem
    // acabava de confirmar o email por email caía no ecrã de início de sessão —
    // e as credenciais certas pareciam erradas porque nem chegavam a ser o
    // problema.
    const layout = readFileSync(path.join(raiz, 'src/app/_layout.tsx'), 'utf8');
    expect(layout).toMatch(/setSession\(/);
    expect(layout).toMatch(/adoptSession\(/);

    // E o `adoptSession` tem de ser o caminho completo, não um `set` solto:
    // sem criar o perfil a partir do registo pendente, a pessoa entrava na app
    // sem perfil nenhum.
    const store = readFileSync(path.join(raiz, 'src/store/authStore.ts'), 'utf8');
    // Âncoras na implementação (`: async`), nunca no nome só: a interface lá em
    // cima declara os mesmos nomes e o `indexOf` casa com ela primeiro,
    // devolvendo uma fatia vazia — um teste que examina o vazio nunca reprova.
    const corpo = store.slice(store.indexOf('adoptSession: async'), store.indexOf('signIn: async'));
    expect(corpo.length).toBeGreaterThan(200);
    // Específico de propósito. Um `toMatch(/PENDING_REGISTRATION_KEY/)` solto
    // passava com a **leitura** partida, porque o `removeItem` mais abaixo
    // continuava a satisfazê-lo — verificado por mutação.
    expect(corpo).toMatch(/getItem\(PENDING_REGISTRATION_KEY\)/);
    expect(corpo).toMatch(/createProfile\(/);
    expect(corpo).toMatch(/onSessionStarted\(/);
  });

  it('o signIn não duplica a lógica de adoção', () => {
    // Estavam a ser a mesma coisa escrita duas vezes; corrigir uma e esquecer a
    // outra era só uma questão de tempo.
    const store = readFileSync(path.join(raiz, 'src/store/authStore.ts'), 'utf8');
    const signIn = store.slice(
      store.indexOf('signIn: async'),
      store.indexOf('signInWithGoogle: async'),
    );
    expect(signIn.length).toBeGreaterThan(50);
    expect(signIn).toMatch(/adoptSession\(/);
    expect(signIn).not.toMatch(/PENDING_REGISTRATION_KEY/);
  });

  it('o session.ts liga mesmo os dois', () => {
    const src = readFileSync(path.join(raiz, 'src/services/session.ts'), 'utf8');
    const inicio = src.slice(src.indexOf('export function onSessionStarted'));
    expect(inicio).toMatch(/identifyUser\(userId\)/);
    expect(inicio).toMatch(/ligarCompras\(userId\)/);
  });
});
