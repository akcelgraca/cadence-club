#!/usr/bin/env node
/**
 * Confirma que o lado Android do push está configurado.
 *
 * O erro que este script existe para apanhar não dá erro nenhum: se o pacote
 * declarado no `app.json` não for o mesmo que está registado no
 * `google-services.json`, o Firebase não reconhece a app, o
 * `getExpoPushTokenAsync()` devolve null, e a app corre sem se queixar. Só se
 * descobre a olhar para um telemóvel que nunca recebe nada.
 *
 *   npm run push:check
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ler = (f) => JSON.parse(readFileSync(path.join(raiz, f), 'utf8'));

const app = ler('app.json').expo;
const pacote = app.android?.googleServicesFile;
const falhas = [];

if (!pacote) {
  falhas.push('app.json não declara android.googleServicesFile');
} else if (!existsSync(path.join(raiz, pacote))) {
  falhas.push(
    `${pacote} não existe.\n` +
    '    Firebase Console › Project settings › a tua app Android › google-services.json,\n' +
    '    e põe-no na raiz de apps/mobile.',
  );
} else {
  const gs = ler(pacote);
  const registados = (gs.client ?? []).map((c) => c.client_info?.android_client_info?.package_name);
  if (!registados.includes(app.android.package)) {
    falhas.push(
      `o pacote não bate certo — isto é o erro silencioso.\n` +
      `    app.json:              ${app.android.package}\n` +
      `    google-services.json:  ${registados.join(', ') || '(nenhum)'}\n` +
      '    Regista o pacote certo no Firebase e volta a descarregar o ficheiro.',
    );
  }
}

// O canal tem de existir antes de a primeira notificação chegar, senão o
// Android descarta-a em silêncio.
const plugin = (app.plugins ?? []).find((p) => Array.isArray(p) && p[0] === 'expo-notifications');
if (!plugin?.[1]?.defaultChannel) {
  falhas.push('o plugin expo-notifications não define defaultChannel');
}

if (falhas.length > 0) {
  console.error('✗ Push Android por configurar:\n');
  for (const f of falhas) console.error('  •', f);
  console.error('\n  Falta ainda, e não dá para verificar daqui: a chave da conta de');
  console.error('  serviço carregada no EAS (`eas credentials` › Android › Google Service');
  console.error('  Account › FCM V1). Sem ela o Expo não tem por onde entregar.');
  process.exit(1);
}

console.log('✓ Android pronto para push:', app.android.package);
console.log('  Falta confirmar à mão a chave de serviço no EAS — `eas credentials`.');
