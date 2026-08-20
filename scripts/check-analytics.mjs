#!/usr/bin/env node
/**
 * Confirma que os analytics estão mesmo a recolher.
 *
 * Pôr a chave no `.env` e ver a app arrancar sem erros não prova nada: o SDK
 * do PostHog engole chaves inválidas em silêncio, e a única forma de descobrir
 * era abrir o painel dias depois e encontrá-lo vazio. Este script lê o `.env`,
 * valida o formato da chave, confirma-a contra o servidor e envia um evento
 * real. Se passar, o relógio dos 30 dias de retenção arrancou.
 *
 *   npm run analytics:check
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function lerEnv() {
  let bruto;
  try {
    bruto = readFileSync(path.join(raiz, '.env'), 'utf8');
  } catch {
    return {};
  }
  return Object.fromEntries(
    bruto
      .split('\n')
      .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
      }),
  );
}

/**
 * Fixo e anónimo de propósito. O nome da máquina seria o mais prático, mas num
 * Mac costuma trazer o nome do dono lá dentro — e a regra desta app é que daqui
 * não sai nada que identifique ninguém, nem sequer em scripts de manutenção.
 * Com um id fixo, todos os testes ficam agrupados num "utilizador" só, fácil de
 * distinguir de tráfego real.
 */
const DISTINCT_ID = 'smoke-test';

const env = lerEnv();
const chave = env.EXPO_PUBLIC_POSTHOG_KEY ?? '';
const host = (env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com').replace(/\/$/, '');

// O mesmo teste que o `src/lib/analytics.ts` faz em runtime. Se falhar aqui,
// a app também não está a enviar nada.
if (!/^phc_[A-Za-z0-9_-]{20,}$/.test(chave)) {
  console.error('✗ EXPO_PUBLIC_POSTHOG_KEY inválida ou por preencher:', chave || '(vazia)');
  console.error();
  console.error('  A chave certa é a *project* API key, em');
  console.error('  Settings › Project › Project API key. Começa por `phc_`.');
  console.error('  A que começa por `phx_` é a personal API key — não serve para o SDK.');
  process.exit(1);
}

/**
 * O `.env` é gitignorado, portanto não sobe para o EAS: os builds de loja leem
 * a chave do `eas.json`. Ter uma e não a outra é o pior dos casos — recolhe-se
 * no simulador, e nada de quem instala a app a sério.
 */
try {
  const eas = JSON.parse(readFileSync(path.join(raiz, 'eas.json'), 'utf8'));
  const emFalta = ['preview', 'production'].filter(
    (perfil) => eas.build?.[perfil]?.env?.EXPO_PUBLIC_POSTHOG_KEY !== chave,
  );
  if (emFalta.length > 0) {
    console.warn(`⚠ eas.json: perfis sem esta chave — ${emFalta.join(', ')}.`);
    console.warn('  Os builds desses perfis vão sair sem recolher nada. Põe lá a mesma chave.');
    console.warn();
  }
} catch {
  // Sem eas.json não há builds do EAS para verificar.
}

/**
 * Validar a chave antes de enviar o evento.
 *
 * O endpoint de captura devolve 200 a qualquer chave, válida ou não — aceita o
 * pedido e deita o evento fora mais à frente, em silêncio. É exatamente a
 * armadilha que este script existe para apanhar, por isso a verificação passa
 * pelo `/flags`, que é o único que responde 401 a uma chave desconhecida.
 */
const auth = await fetch(`${host}/flags?v=2`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ api_key: chave, distinct_id: DISTINCT_ID }),
});

if (!auth.ok) {
  console.error(`✗ ${host} rejeitou a chave (${auth.status}):`, (await auth.text()).slice(0, 200));
  if (auth.status === 401) {
    console.error();
    console.error('  401 = chave desconhecida nesta região. Ou está errada, ou o projeto');
    console.error('  foi criado na outra cloud — troca o EXPO_PUBLIC_POSTHOG_HOST entre');
    console.error('  https://eu.i.posthog.com e https://us.i.posthog.com.');
  }
  process.exit(1);
}

// Chave boa. Agora um evento a sério, para haver o que ver no painel.
const resposta = await fetch(`${host}/i/v0/e/`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    api_key: chave,
    event: 'analytics_smoke_test',
    distinct_id: DISTINCT_ID,
    properties: { source: 'npm run analytics:check' },
    timestamp: new Date().toISOString(),
  }),
});

if (!resposta.ok) {
  console.error(`✗ ${host} recusou o evento (${resposta.status}):`, (await resposta.text()).slice(0, 300));
  process.exit(1);
}

console.log('✓ Chave válida em', host, '— evento `analytics_smoke_test` enviado.');
console.log('  Vê-o em Activity dentro de segundos.');
console.log('  A partir daqui, a app instalada começa a contar retenção.');
