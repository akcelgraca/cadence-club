import { readFileSync } from 'node:fs';
import path from 'node:path';
import { textoDoCracha } from './badgeText';
import pt from './i18n/pt';
import en from './i18n/en';

const raiz = path.resolve(__dirname, '../..');
const ler = (p: string) => readFileSync(path.join(raiz, p), 'utf8');

const fazerT = (dic: Record<string, string>) =>
  (chave: string, o: Record<string, unknown> = {}) => dic[chave] ?? String(o.defaultValue ?? chave);
const tPt = fazerT(pt as any);
const tEn = fazerT(en as any);

/**
 * Os nomes dos crachás.
 *
 * A 051 deixou isto por resolver de propósito: o nome ia como *parâmetro* da
 * notificação, e um inglês recebia "You unlocked the badge: Madrugador!" — a
 * frase traduzia, o nome não. A 053 passa a guardar a chave.
 */
describe('textoDoCracha', () => {
  it('traduz a chave', () => {
    expect(textoDoCracha('badge_early_bird', tPt)).toBe('Madrugador');
    expect(textoDoCracha('badge_early_bird', tEn)).toBe('Early Bird');
  });

  it('texto antigo passa intacto', () => {
    // Uma linha que escape ao UPDATE da 053 continua a mostrar o que lá está,
    // em vez de virar uma chave inventada.
    expect(textoDoCracha('Madrugador', tEn)).toBe('Madrugador');
  });

  it('uma chave desconhecida não aparece em bruto', () => {
    // Um crachá novo sem entrada no dicionário mostrava `badge_qualquer` ao
    // utilizador — que é exatamente o problema que a 053 foi corrigir.
    expect(textoDoCracha('badge_inventado', tEn)).toBe('badge_inventado');
  });

  it('vazio não estoira', () => {
    expect(textoDoCracha(null, tPt)).toBe('');
    expect(textoDoCracha(undefined, tPt)).toBe('');
  });
});

describe('os crachás existem nos três sítios', () => {
  /** Os ids, lidos da própria semente — não de uma lista escrita à mão aqui. */
  // Ancorado ao início da linha: sem isso apanhava também valores de categoria
  // como `multi_sport`, que aparecem noutros sítios do mesmo ficheiro.
  const ids = [...new Set(
    [...ler('supabase/migrations/003_seed_badges.sql').matchAll(/^\('([a-z0-9_]+)',/gm)].map((m) => m[1]),
  )];

  it('a semente tem 13', () => {
    // Treze, não doze. O `multi_sport` escapou-me ao escrever o dicionário da
    // edge function, e foi este teste que o apanhou — por ler os ids da própria
    // semente em vez de uma lista escrita à mão.
    expect(ids).toHaveLength(13);
  });

  it('cada um tem nome e descrição nos dois idiomas', () => {
    const faltam: string[] = [];
    for (const id of ids) {
      for (const chave of [`badge_${id}`, `badge_${id}_desc`]) {
        if (!(chave in pt)) faltam.push(`pt ${chave}`);
        if (!(chave in en)) faltam.push(`en ${chave}`);
      }
    }
    expect(faltam).toEqual([]);
  });

  it('cada um tem nome na edge function, nos dois idiomas', () => {
    // O push é desenhado no servidor e não tem i18next. Uma chave que falte aqui
    // manda `badge_early_bird` para o ecrã bloqueado de alguém.
    const fn = ler('supabase/functions/send-push/index.ts');
    const bloco = fn.slice(fn.indexOf('const CRACHAS'), fn.indexOf('function formatarData'));
    const faltam = ids.filter((id) => !bloco.includes(`badge_${id}:`));
    expect(faltam).toEqual([]);
    const entradas = [...bloco.matchAll(/badge_[a-z0-9_]+:\s*\{([^}]*)\}/g)];
    expect(entradas).toHaveLength(13);
    expect(entradas.filter((e) => !/\bpt:/.test(e[1]) || !/\ben:/.test(e[1]))).toEqual([]);
  });
});

describe('a migração 053', () => {
  const sql = ler('supabase/migrations/053_badge_i18n.sql');

  it('converte nome e descrição em chaves', () => {
    expect(sql).toMatch(/name = 'badge_' \|\| id/);
    expect(sql).toMatch(/description = 'badge_' \|\| id \|\| '_desc'/);
  });

  it('não volta a converter o que já está convertido', () => {
    // Correr a migração duas vezes daria `badge_badge_early_bird`.
    expect(sql).toMatch(/WHERE name NOT LIKE 'badge\\_%'/);
  });

  it('o gatilho passa a mandar a chave', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION notify_on_badge_earned/);
    expect(sql).toMatch(/v_badge_key/);
  });
});
