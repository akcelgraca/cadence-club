import { readFileSync } from 'node:fs';
import path from 'node:path';

const raiz = path.resolve(__dirname, '../..');
const ler = (p: string) => readFileSync(path.join(raiz, p), 'utf8');

/**
 * Apagar a conta é o caminho que ninguém testa e todos assumem.
 *
 * Até 24 de agosto o botão existia, pedia confirmação, aceitava o toque e
 * depois dizia "Funcionalidade em desenvolvimento" — pior do que não existir,
 * porque o fluxo parecia o de uma eliminação a sério até ao fim. A diretriz
 * 5.1.1(v) da Apple obriga a que dê para apagar a conta de dentro da app.
 */
describe('apagar conta', () => {
  const fn = ler('supabase/functions/delete-account/index.ts');
  const servico = ler('src/services/auth.ts');
  const ecra = ler('src/app/profile/settings.tsx');
  const store = ler('src/store/authStore.ts');

  it('o ecrã já não mostra o alerta de "em desenvolvimento"', () => {
    const bloco = ecra.slice(ecra.indexOf('handleDeleteAccount'), ecra.indexOf('const apagarConta'));
    expect(bloco).not.toMatch(/settings_delete_wip/);
    expect(ecra).toMatch(/deleteAccount\(\)/);
  });

  it('a app nunca traz a service role — quem apaga é a edge function', () => {
    // Com a service role dentro do bundle, qualquer pessoa que o abrisse
    // apagava a conta de qualquer outra.
    expect(servico).not.toMatch(/SERVICE_ROLE/i);
    expect(servico).toMatch(/functions\.invoke\('delete-account'/);
    expect(fn).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('o id apagado vem do token, nunca do corpo do pedido', () => {
    // É a diferença entre apagar a própria conta e apagar a de quem se quiser:
    // o URL de uma edge function deriva-se do projeto, e este repositório é
    // público.
    expect(fn).toMatch(/auth\.getUser\(\)/);
    expect(fn).toMatch(/deleteUser\(user\.id\)/);
    expect(fn).not.toMatch(/req\.json\(\)/);
    expect(fn).not.toMatch(/body\.user_id|body\.userId/);
  });

  it('recusa quem não se identifica', () => {
    // Específico: procurar as palavras `Authorization` e `401` algures no
    // ficheiro passava com a guarda trocada por `if (false)` — verificado por
    // mutação. O que importa é a condição existir e responder 401.
    expect(fn).toMatch(/if\s*\(!authHeader\)/);
    const guarda = fn.slice(fn.indexOf('if (!authHeader)'), fn.indexOf('const supabaseUrl'));
    expect(guarda).toMatch(/401/);
  });

  it('apaga também os ficheiros, que a cascata não toca', () => {
    // Os dois buckets são públicos. Um URL que continuasse a servir a foto de
    // quem pediu para apagar a conta é uma falha de privacidade, não desarrumo.
    expect(fn).toMatch(/avatars/);
    expect(fn).toMatch(/activity-photos/);
    expect(fn).toMatch(/\.remove\(/);
    // A função existir não chega — tem de ser chamada. Apagar só a chamada
    // deixava os nomes dos buckets no ficheiro e o teste passava.
    expect(fn).toMatch(/await apagarFicheiros\(/);
  });

  it('os ficheiros são apagados antes do utilizador', () => {
    // Pela ordem inversa ficavam órfãos e públicos, sem sequer se saber de quem
    // eram — o id já não existiria para os ligar a ninguém.
    const chamada = fn.indexOf('await apagarFicheiros(');
    const apagar = fn.indexOf('deleteUser(user.id)');
    // Sem isto, uma chamada inexistente dava `-1`, que é menor que tudo — e o
    // teste passava precisamente no caso que devia apanhar.
    expect(chamada).toBeGreaterThan(0);
    expect(apagar).toBeGreaterThan(0);
    expect(chamada).toBeLessThan(apagar);
  });

  it('o telemóvel só é limpo depois de o servidor confirmar', () => {
    // Ao contrário, alguém ficava deslogado de uma conta que continuava a
    // existir, sem forma de voltar a entrar para tentar de novo.
    const bloco = store.slice(store.indexOf('deleteAccount: async'), store.indexOf('signOut: async'));
    expect(bloco.length).toBeGreaterThan(50);
    expect(bloco.indexOf('authService.deleteAccount()')).toBeLessThan(bloco.indexOf('signOut()'));
  });

  it('pede duas confirmações antes de apagar', () => {
    const bloco = ecra.slice(ecra.indexOf('const handleDeleteAccount'), ecra.indexOf('const apagarConta'));
    expect((bloco.match(/Alert\.alert\(/g) ?? []).length).toBe(2);
    expect(bloco).toMatch(/settings_delete_second_title/);
  });
});

/**
 * Os links legais das Definições.
 *
 * Até 24 de agosto apontavam os quatro para `cadenceclub.app` — um domínio que
 * não é nosso e não resolve. A App Store exige um URL de política de privacidade
 * **acessível** e verifica-o; um link morto dentro da app é o mesmo problema
 * visto de outro ângulo, e nada no código o denunciava.
 */
describe('links legais', () => {
  const ecra = ler('src/app/profile/settings.tsx');

  it('nenhum link aponta para um domínio que não temos', () => {
    expect(ecra).not.toMatch(/cadenceclub\.app/);
    expect(ecra).not.toMatch(/cadenceclub\.site/);
  });

  it('privacidade e termos apontam para páginas que existem no repositório', () => {
    const paginas: Record<string, string> = {
      'https://legal.cadenceclub.pt/privacidade.html': 'web/privacidade.html',
      'https://legal.cadenceclub.pt/termos.html': 'web/termos.html',
    };
    for (const [url, ficheiro] of Object.entries(paginas)) {
      expect(ecra).toContain(url);
      // Se o ficheiro for renomeado sem mexer na app, o link morre em silêncio.
      expect(() => ler(ficheiro)).not.toThrow();
    }
  });

  // Os espaços por preencher das páginas NÃO são verificados aqui de propósito.
  // Seria um teste vermelho permanente até alguém preencher a morada, e um teste
  // que está sempre a falhar ensina toda a gente a ignorar a suite inteira.
  // Vive no `npm run web:check`, com os outros `*:check` de pré-lançamento.

  it('um mailto não é aberto pelo WebBrowser', () => {
    // O `openBrowserAsync` abre páginas; com um `mailto:` não acontece nada e
    // não há erro nenhum a dizê-lo.
    const bloco = ecra.slice(ecra.indexOf('const openLink'), ecra.indexOf('const handleStub'));
    expect(bloco).toMatch(/mailto:/);
    expect(bloco).toMatch(/Linking\.openURL/);
  });
});
