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
