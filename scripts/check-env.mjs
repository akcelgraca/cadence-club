#!/usr/bin/env node
/**
 * As variáveis `EXPO_PUBLIC_*` chegam mesmo aos builds do EAS?
 *
 * O `.env` é gitignorado, portanto **não sobe para o EAS**. Quem não reparar
 * nisso compila com os valores por omissão do `constants.ts` —
 * `https://YOUR_PROJECT.supabase.co` — e a app instala, abre, e só falha ao
 * primeiro pedido, com `UnknownHostException: unable to resolve`. Aconteceu no
 * primeiro build Android com push, a 20 ago: o Supabase, o Mapbox e o Google
 * saíram todos vazios.
 *
 *   npm run env:check
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Os nomes que o código realmente lê — em todo o `src`, não só no
 * `constants.ts`; as chaves do RevenueCat, por exemplo, vivem no
 * `services/purchases`.
 *
 * Varrer o código em vez de manter uma lista à mão é o que apanhou, a 22 de
 * agosto, os dois `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID`: estavam no `.env` e no
 * ambiente do EAS, e não eram lidos por ninguém. O login com Google vai pelo
 * `signInWithOAuth` do Supabase, cuja configuração está no painel do Supabase
 * e não na app.
 */
const usadas = [
  ...new Set(
    execSync('grep -rho "process\\.env\\.EXPO_PUBLIC_[A-Z0-9_]*" src || true', {
      cwd: raiz,
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean)
      .map((l) => l.replace('process.env.', '')),
  ),
].sort();

console.log(`Variáveis lidas pelo código: ${usadas.length}\n`);

// ── .env, para o desenvolvimento local ──────────────────────────────────────
let local = {};
try {
  local = Object.fromEntries(
    readFileSync(path.join(raiz, '.env'), 'utf8')
      .split('\n')
      .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
      }),
  );
} catch { /* sem .env */ }

const porPreencher = (v) => !v || /^(your-|phc_COLAR|YOUR_)/.test(v) || v.includes('YOUR_PROJECT');

/**
 * Vazias de propósito, enquanto a monetização estiver desligada.
 *
 * O `services/purchases` degrada em silêncio sem elas — `isAvailable()` devolve
 * false e o paywall diz que não está configurado. Falhar por causa delas seria
 * treinar-nos a ignorar este script.
 */
const OPCIONAIS = new Set(['EXPO_PUBLIC_REVENUECAT_IOS_KEY', 'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY']);

let falhou = false;

console.log('.env (desenvolvimento local)');
for (const nome of usadas) {
  const mau = porPreencher(local[nome]);
  if (mau && !OPCIONAIS.has(nome)) falhou = true;
  const marca = mau ? (OPCIONAIS.has(nome) ? '–' : '✗') : '✓';
  const nota = mau ? (OPCIONAIS.has(nome) ? '  (vazia de propósito)' : '  ← por preencher') : '';
  console.log(`  ${marca} ${nome}${nota}`);
}

// ── EAS, que é o que os builds usam ─────────────────────────────────────────
for (const ambiente of ['preview', 'production']) {
  console.log(`\nEAS · ${ambiente}`);
  let saida;
  try {
    saida = execSync(`eas env:list ${ambiente}`, { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    console.log('  ? não deu para consultar (eas login?)');
    continue;
  }
  for (const nome of usadas) {
    // Só o nome. O valor nunca é impresso.
    const existe = new RegExp(`^${nome}=`, 'm').test(saida);
    if (!existe && !OPCIONAIS.has(nome)) falhou = true;
    const marca = existe ? '✓' : (OPCIONAIS.has(nome) ? '–' : '✗');
    const nota = existe ? '' : (OPCIONAIS.has(nome) ? '  (vazia de propósito)' : '  ← em falta no EAS');
    console.log(`  ${marca} ${nome}${nota}`);
  }
}

// ── O perfil tem de apontar para o ambiente, senão nada disto é usado ───────
console.log('\neas.json');
const eas = JSON.parse(readFileSync(path.join(raiz, 'eas.json'), 'utf8'));
for (const [perfil, cfg] of Object.entries(eas.build ?? {})) {
  const ok = !!cfg.environment;
  if (!ok) falhou = true;
  console.log(`  ${ok ? '✓' : '✗'} ${perfil}${ok ? ` → ${cfg.environment}` : '  ← sem "environment", as variáveis do EAS não se aplicam'}`);
}

process.exit(falhou ? 1 : 0);
