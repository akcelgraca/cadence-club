import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const raiz = path.resolve(__dirname, '../..');

/**
 * Campos que nunca podem ir para os analytics.
 *
 * Isto é uma app de corrida: o traçado de GPS é a morada de quem treina, e o
 * título de uma atividade é texto livre onde cabe o que a pessoa quiser. Um
 * `capture` descuidado com um destes campos manda isso para fora de casa, e
 * não há como o trazer de volta.
 */
const PROIBIDOS = [
  'lat', 'lng', 'latitude', 'longitude', 'coords', 'coordinates',
  'route', 'points', 'address', 'morada',
  'email', 'password', 'token',
  'title', 'titulo', 'description', 'bio',
  'full_name', 'username', 'name',
];

describe('analytics', () => {
  const src = readFileSync(path.join(raiz, 'src/lib/analytics.ts'), 'utf8');

  it('não declara nenhuma propriedade com dados pessoais ou de localização', () => {
    // O EventMap é o contrato: se um campo destes lá aparecer, foi acrescentado
    // à pressa e vai começar a sair no próximo build.
    const eventMap = src.slice(src.indexOf('type EventMap'), src.indexOf('export function track'));

    const encontrados = PROIBIDOS.filter((campo) =>
      new RegExp(`^\\s*(/\\*\\*.*)?\\s*${campo}\\s*[?:]`, 'm').test(eventMap),
    );

    expect(encontrados).toEqual([]);
  });

  it('identifica pelo id, nunca pelo email', () => {
    const identify = src.slice(src.indexOf('export function identifyUser'));
    expect(identify).toContain('posthog.identify(userId)');
    expect(identify).not.toMatch(/identify\([^)]*email/i);
  });

  it('nenhum ecrã chama o posthog diretamente', () => {
    // Tudo passa por track()/identifyUser(), senão o contrato acima não vale
    // nada — bastava um capture solto num ecrã para o contornar.
    const ficheiros = execSync(
      'find src -name "*.ts" -o -name "*.tsx" | grep -v "analytics" | grep -v "\\.test\\."',
      { cwd: raiz, encoding: 'utf8' },
    ).trim().split('\n');

    const infratores = ficheiros.filter((f) => {
      const conteudo = readFileSync(path.join(raiz, f), 'utf8');
      return /\bposthog\.(capture|identify)\s*\(/.test(conteudo);
    });

    expect(infratores).toEqual([]);
  });

  it('só aceita uma project API key (phc_), e não o valor de exemplo do .env', () => {
    // Testa a expressão tal como está na fonte, em vez de a repetir aqui: se
    // alguém a alargar para desbloquear um caso, este teste vem atrás.
    const declarada = src.match(/ANALYTICS_ENABLED = (\/.+\/)\.test/);
    expect(declarada).not.toBeNull();
    const regex = new RegExp(declarada![1].slice(1, -1));

    // O engano caro: chave por preencher, ou a personal API key. Ambas deixam
    // a app a correr sem erros e o painel vazio.
    expect(regex.test('')).toBe(false);
    expect(regex.test('your-posthog-key')).toBe(false);
    expect(regex.test('phc_COLAR_AQUI')).toBe(false);
    expect(regex.test('phx_KJ2h3kJH23kjh23KJH23kjh23KJH2')).toBe(false);

    expect(regex.test('phc_KJ2h3kJH23kjh23KJH23kjh23KJH2')).toBe(true);
  });

  it('desliga o cliente inteiro sem chave, não só o track()', () => {
    // O PostHogProvider faz autocapture de ecrãs por sua conta. Sem o
    // `disabled`, esses eventos iam bater numa chave inválida em ciclo.
    expect(src).toMatch(/disabled:\s*!ANALYTICS_ENABLED/);
  });

  it('o .env.example não sugere uma chave que passe a validação', () => {
    const exemplo = readFileSync(path.join(raiz, '.env.example'), 'utf8');
    const linha = exemplo.match(/^EXPO_PUBLIC_POSTHOG_KEY=(.*)$/m);
    expect(linha).not.toBeNull();
    expect(/^phc_[A-Za-z0-9_-]{20,}$/.test(linha![1].trim())).toBe(false);
  });
});

/**
 * O `isNovoRegisto` é a única coisa que separa um registo de uma entrada no
 * Google e na Apple. Enganar-se aqui não estoira nada: ou a métrica de
 * ativação por método fica vazia, ou fica inflacionada — e nos dois casos só
 * se descobre semanas depois, a olhar para um gráfico que mente.
 */
describe('isNovoRegisto', () => {
  const { isNovoRegisto } = require('./analytics') as typeof import('./analytics');

  it('conta acabada de criar: os dois carimbos no mesmo pedido', () => {
    expect(isNovoRegisto({
      created_at: '2026-08-24T10:00:00.000Z',
      last_sign_in_at: '2026-08-24T10:00:00.412Z',
    })).toBe(true);
  });

  it('quem já existia entra outra vez e não conta como registo', () => {
    expect(isNovoRegisto({
      created_at: '2026-07-01T09:00:00.000Z',
      last_sign_in_at: '2026-08-24T10:00:00.000Z',
    })).toBe(false);
  });

  it('sem entrada registada, a conta só pode ter nascido agora', () => {
    expect(isNovoRegisto({ created_at: '2026-08-24T10:00:00.000Z', last_sign_in_at: null })).toBe(true);
  });

  it('sem created_at não se inventa um registo', () => {
    expect(isNovoRegisto({})).toBe(false);
    expect(isNovoRegisto({ created_at: null, last_sign_in_at: '2026-08-24T10:00:00.000Z' })).toBe(false);
  });

  it('datas ilegíveis não contam como registo', () => {
    expect(isNovoRegisto({ created_at: 'ontem', last_sign_in_at: 'hoje' })).toBe(false);
  });

  it('um minuto de diferença já é uma entrada, não um registo', () => {
    // A margem é de 10s: cobre o vaivém do OAuth, não cobre voltar a entrar.
    expect(isNovoRegisto({
      created_at: '2026-08-24T10:00:00.000Z',
      last_sign_in_at: '2026-08-24T10:01:00.000Z',
    })).toBe(false);
  });
});

/**
 * O `session.test.ts` já impede que um caminho de entrada se esqueça dos
 * serviços externos. Este faz o mesmo para o `signed_up`: o projeto já
 * acrescentou o Google e a Apple uma vez e deixou-os de fora — foi assim que a
 * métrica de ativação por método ficou só com email.
 */
describe('signed_up cobre todos os métodos de entrada', () => {
  const raiz = path.resolve(__dirname, '../..');
  const authStore = readFileSync(path.join(raiz, 'src/store/authStore.ts'), 'utf8');

  it('os três métodos do EventMap disparam o evento em algum lado', () => {
    const analytics = readFileSync(path.join(raiz, 'src/lib/analytics.ts'), 'utf8');
    const linha = analytics.match(/signed_up:\s*\{\s*method:\s*([^}]+)\}/)?.[1] ?? '';
    const metodos = [...linha.matchAll(/'(\w+)'/g)].map((m) => m[1]);
    expect(metodos.sort()).toEqual(['apple', 'email', 'google']);

    // O email é certeza — tem `signUp` próprio. Os outros dois passam pela
    // deteção, porque a chamada é a mesma para entrar e para registar.
    expect(authStore).toMatch(/track\('signed_up',\s*\{\s*method:\s*'email'/);
    for (const m of ['google', 'apple']) {
      expect(authStore).toMatch(new RegExp(`trackSignUpIfNew\\([^)]*'${m}'\\)`));
    }
  });

  it('o restauro de sessão no arranque não dispara registo nenhum', () => {
    // Quem se registou pelo Google e nunca mais entrou fica com os dois
    // carimbos iguais para sempre — aplicar a deteção ao arranque somava um
    // registo por cada abertura da app.
    // Âncoras na *implementação*, não na declaração do tipo lá em cima: com
    // `indexOf('initialize:')` a fatia caía entre duas linhas da interface e
    // ficava vazia — o teste passava com a falha lá dentro. Apanhado por
    // mutação, que é para isso que ela serve.
    const inicio = authStore.indexOf('initialize: async');
    const fim = authStore.indexOf('signUp: async');
    expect(inicio).toBeGreaterThan(0);
    expect(fim).toBeGreaterThan(inicio);

    const inicializa = authStore.slice(inicio, fim);
    expect(inicializa).toMatch(/onSessionStarted\(/); // a fatia é mesmo o corpo
    expect(inicializa).not.toMatch(/trackSignUpIfNew|signed_up/);
  });
});
