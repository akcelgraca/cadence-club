import { readFileSync } from 'node:fs';
import path from 'node:path';

const raiz = path.resolve(__dirname, '../..');
const ler = (p: string) => readFileSync(path.join(raiz, p), 'utf8');

/** Os tipos declarados em `NotificationType`, lidos da própria fonte. */
function tiposDeclarados(): string[] {
  const types = ler('src/lib/types.ts');
  const bloco = types.slice(
    types.indexOf('export type NotificationType'),
    types.indexOf('export interface Notification'),
  );
  return [...bloco.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

/**
 * Um tipo de notificação toca em cinco sítios, e falhar um deles falha de
 * maneiras diferentes:
 *
 *   • o CHECK em SQL — o `INSERT` do gatilho rebenta **dentro da transação de
 *     quem enviou**. A mensagem não chega a ser gravada. É o pior dos cinco.
 *   • o ícone — quadrado vazio na lista
 *   • a rota — tocar na notificação não faz nada
 *   • o título na edge function — chega "Nova Notificacao" ao telemóvel
 *   • o interruptor — não há como silenciar
 *
 * Nenhum destes é apanhado pelo compilador, porque quatro deles vivem em
 * ficheiros que o TypeScript não lê.
 */
describe('tipos de notificação', () => {
  const tipos = tiposDeclarados();

  it('há tipos declarados', () => {
    expect(tipos.length).toBeGreaterThanOrEqual(9);
  });

  it('todos existem no CHECK da base de dados', () => {
    // Sem isto o gatilho rebenta na transação de quem enviou a mensagem.
    const sql = ler('supabase/migrations/047_more_notifications.sql');
    const check = sql
      .slice(sql.indexOf('notifications_type_check'), sql.indexOf('-- ── 2.'))
      // Comentar uma entrada tira-a do CHECK tal como apagá-la. Sem isto, o
      // teste passava a olhar para uma linha comentada — verificado.
      .split('\n')
      .map((l) => l.replace(/--.*$/, ''))
      .join('\n');
    expect(tipos.filter((t) => !check.includes(`'${t}'`))).toEqual([]);
  });

  it('todos têm ícone e rota na lista de notificações', () => {
    const ecra = ler('src/app/notifications.tsx');
    const icones = ecra.slice(ecra.indexOf('NOTIFICATION_ICONS'), ecra.indexOf('function getNotificationRoute'));
    const rotas = ecra.slice(ecra.indexOf('function getNotificationRoute'), ecra.indexOf('export default'));

    expect(tipos.filter((t) => !new RegExp(`\\b${t}:`).test(icones))).toEqual([]);
    expect(tipos.filter((t) => !rotas.includes(`case '${t}'`))).toEqual([]);
  });

  it('todos têm título e interruptor na edge function', () => {
    const fn = ler('supabase/functions/send-push/index.ts');
    const titulos = fn.slice(fn.indexOf('const TITLES'), fn.indexOf('const PREF_POR_TIPO'));
    const prefs = fn.slice(fn.indexOf('const PREF_POR_TIPO'), fn.indexOf('interface NotificationRecord'));

    expect(tipos.filter((t) => !new RegExp(`\\b${t}:`).test(titulos))).toEqual([]);
    expect(tipos.filter((t) => !new RegExp(`\\b${t}:`).test(prefs))).toEqual([]);
  });

  it('todos são encaminhados quando se toca no push', () => {
    const hook = ler('src/hooks/usePushNotifications.ts');
    expect(tipos.filter((t) => !hook.includes(`case '${t}'`))).toEqual([]);
  });
});

describe('interruptores de notificação', () => {
  /** As chaves de `NotificationPreferences`. */
  const chaves = (() => {
    const types = ler('src/lib/types.ts');
    const bloco = types.slice(
      types.indexOf('export interface NotificationPreferences'),
      types.indexOf('export interface UserSettings'),
    );
    return [...bloco.matchAll(/^\s{2}(\w+): boolean;/gm)].map((m) => m[1]);
  })();

  it('cada um tem interruptor no ecrã e texto traduzido', () => {
    const ecra = ler('src/app/profile/settings.tsx');
    const en = ler('src/lib/i18n/en.ts');
    const pt = ler('src/lib/i18n/pt.ts');

    expect(chaves.length).toBeGreaterThanOrEqual(8);
    expect(chaves.filter((k) => !ecra.includes(`settings.notifications.${k}`))).toEqual([]);
    expect(chaves.filter((k) => !en.includes(`settings_notif_${k}:`))).toEqual([]);
    expect(chaves.filter((k) => !pt.includes(`settings_notif_${k}:`))).toEqual([]);
  });

  it('as preferências chegam ao servidor', () => {
    // Enquanto viveram só no AsyncStorage, os interruptores não desligavam
    // nada: quem envia o push é a edge function, e ela nunca soube deles.
    const store = ler('src/store/settingsStore.ts');
    expect(store).toMatch(/syncNotificationPrefs\(/);
    const push = ler('src/services/push.ts');
    expect(push).toMatch(/notification_prefs/);
  });
});

/**
 * O texto das notificações vive em três dicionários que ninguém obriga a
 * concordar: `pt.ts`, `en.ts` e — porque o push é desenhado no servidor — a
 * tabela `CORPOS` dentro da edge function.
 *
 * Divergirem falha em silêncio, e de maneiras diferentes conforme o sítio: uma
 * chave que falte no `en.ts` mostra português a um inglês; uma que falte na
 * edge function manda o push em português na mesma; uma que falte no SQL não
 * chega a existir. Nenhuma delas estoira, e nenhuma aparece nos testes de
 * ecrã — por isso são estes que as apanham.
 */
describe('texto traduzido das notificações', () => {
  const migracao = ler('supabase/migrations/051_notification_i18n.sql');
  const chaves = [...new Set([...migracao.matchAll(/'(notif_\w+)'/g)].map((m) => m[1]))];

  it('a migração 051 define uma chave por tipo de notificação', () => {
    expect(chaves).toHaveLength(tiposDeclarados().length);
  });

  it('cada chave existe nos dois dicionários da app', () => {
    const pt = ler('src/lib/i18n/pt.ts');
    const en = ler('src/lib/i18n/en.ts');
    expect(chaves.filter((k) => !pt.includes(`${k}:`))).toEqual([]);
    expect(chaves.filter((k) => !en.includes(`${k}:`))).toEqual([]);
  });

  it('cada chave existe também na edge function, nos dois idiomas', () => {
    const fn = ler('supabase/functions/send-push/index.ts');
    const corpos = fn.slice(fn.indexOf('const CORPOS'), fn.indexOf('function formatarData'));
    expect(chaves.filter((k) => !corpos.includes(`${k}:`))).toEqual([]);
    // Uma entrada com um idioma só passaria no teste de cima e mandava
    // `undefined` para metade das pessoas.
    // Delimitar cada entrada pela chave seguinte, e não por `}`: os próprios
    // marcadores `{{club}}` trazem chavetas, e um regex ingénuo corta a meio.
    const posicoes = chaves.map((k) => [k, corpos.indexOf(`${k}:`)] as const);
    const semIdioma = posicoes.filter(([, i]) => {
      const seguintes = posicoes.map(([, j]) => j).filter((j) => j > i);
      const bloco = corpos.slice(i, seguintes.length ? Math.min(...seguintes) : corpos.length);
      return !/\bpt:/.test(bloco) || !/\ben:/.test(bloco);
    });
    expect(semIdioma.map(([k]) => k)).toEqual([]);
  });

  it('os marcadores {{}} batem certo entre os três sítios', () => {
    // Um `{{club}}` que em inglês fosse `{{clube}}` aparecia em bruto ao
    // utilizador — o i18next não interpola o que não reconhece.
    const marcadores = (s: string) =>
      [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort().join(',');

    const ptSrc = ler('src/lib/i18n/pt.ts');
    const enSrc = ler('src/lib/i18n/en.ts');
    const fnSrc = ler('supabase/functions/send-push/index.ts');

    const linha = (src: string, chave: string, idioma?: string) => {
      const re = idioma
        ? new RegExp(`${chave}:[\\s\\S]{0,200}?${idioma}:\\s*(['"\`])(.*?)\\1`)
        : new RegExp(`${chave}:\\s*(['"\`])(.*?)\\1`);
      return src.match(re)?.[2] ?? '';
    };

    const divergentes = chaves.filter((k) => {
      const esperado = marcadores(linha(ptSrc, k));
      return [
        marcadores(linha(enSrc, k)),
        marcadores(linha(fnSrc, k, 'pt')),
        marcadores(linha(fnSrc, k, 'en')),
      ].some((m) => m !== esperado);
    });

    expect(divergentes).toEqual([]);
  });
});
