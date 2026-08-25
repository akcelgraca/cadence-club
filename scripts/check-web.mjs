#!/usr/bin/env node
/**
 * As páginas públicas estão prontas para ir para o ar?
 *
 * Não é um teste do Jest de propósito. Enquanto a morada e a região não
 * estiverem preenchidas, isto falha — e um teste sempre vermelho na suite
 * ensina toda a gente a ignorar a suite. Aqui falha só a quem o corre, que é
 * quem está a preparar o lançamento.
 *
 *   npm run web:check
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(raiz, 'web');

let problemas = 0;
const falha = (m) => { console.error('✗ ' + m); problemas++; };
const ok = (m) => console.log('✓ ' + m);

// 1. os ficheiros existem
const precisos = ['index.html', 'privacidade.html', 'termos.html', 'estilo.css', 'idioma.js'];
const presentes = readdirSync(web);
const emFalta = precisos.filter((f) => !presentes.includes(f));
if (emFalta.length) falha(`ficheiros em falta: ${emFalta.join(', ')}`);
else ok(`os ${precisos.length} ficheiros estão lá`);

// 2. espaços por preencher — o que torna uma política pior do que nenhuma
for (const f of ['privacidade.html', 'termos.html']) {
  const src = readFileSync(path.join(web, f), 'utf8');
  const brancos = [...new Set([...src.matchAll(/\[([A-ZÇÃÕÁÉÍÓÚ ]{3,})\]/g)].map((m) => m[1]))];
  if (brancos.length) falha(`${f}: por preencher → ${brancos.map((b) => `[${b}]`).join(', ')}`);
  else ok(`${f} sem espaços por preencher`);
}

// 3. os dois idiomas em cada documento
for (const f of ['privacidade.html', 'termos.html', 'index.html']) {
  const src = readFileSync(path.join(web, f), 'utf8');
  const idiomas = [...src.matchAll(/data-lang="(\w+)"/g)].map((m) => m[1]);
  if (!idiomas.includes('pt') || !idiomas.includes('en')) falha(`${f} não tem os dois idiomas`);
  else ok(`${f} bilingue`);
}

// 4. os URLs que a app abre têm de bater certo com os ficheiros
const ecra = readFileSync(path.join(raiz, 'src/app/profile/settings.tsx'), 'utf8');
for (const [url, ficheiro] of [
  ['https://cadenceclub.pt/privacidade.html', 'privacidade.html'],
  ['https://cadenceclub.pt/termos.html', 'termos.html'],
]) {
  if (!ecra.includes(url)) falha(`a app não abre ${url}`);
  else if (!presentes.includes(ficheiro)) falha(`${url} aponta para um ficheiro que não existe`);
  else ok(`${url} → web/${ficheiro}`);
}

// 5. estão mesmo publicadas? (só se houver rede)
const publicadas = process.argv.includes('--online');
if (publicadas) {
  for (const url of ['https://cadenceclub.pt/privacidade.html', 'https://cadenceclub.pt/termos.html']) {
    try {
      const r = await fetch(url, { redirect: 'follow' });
      if (r.ok) ok(`${url} responde ${r.status}`);
      else falha(`${url} responde ${r.status} — a App Store verifica isto`);
    } catch (e) {
      falha(`${url} não responde: ${e.message}`);
    }
  }
} else {
  console.log('· (usa --online para confirmar que já estão publicadas)');
}

console.log();
if (problemas) {
  console.error(`${problemas} problema(s). As páginas ainda não estão prontas para a loja.`);
  process.exit(1);
}
console.log('Páginas prontas.');
