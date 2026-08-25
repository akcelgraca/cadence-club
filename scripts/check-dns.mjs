#!/usr/bin/env node
/**
 * A zona do cadenceclub.pt continua inteira?
 *
 * Escrito antes de mover os nameservers para a Cloudflare (25 ago 2026). O modo
 * clássico de partir uma migração destas é um registo que ninguém se lembrou que
 * existia — e o sintoma aparece dias depois, sem ninguém ligar as duas coisas:
 * o email deixa de chegar, ou o FTP deixa de resolver.
 *
 * Os valores esperados foram tirados da zona da Amen ANTES da migração.
 *
 *   npm run dns:check
 */
import { execSync } from 'node:child_process';

const D = 'cadenceclub.pt';

/** [nome, tipo, fragmento que a resposta tem de conter, para que serve] */
const ESPERADO = [
  ['',                    'A',   '81.88.57.70',                     'site'],
  ['www',                 'CNAME', 'onstatic-pt.setupdns.net',      'site'],
  ['',                    'MX',  'mail-pt.securemail.pro',          'CORREIO — recebe email'],
  ['',                    'TXT', 'v=spf1 include:spf.webapps.net',  'CORREIO — SPF do domínio'],
  ['mail',                'CNAME', 'mail-pt.securemail.pro',        'CORREIO — IMAP/POP'],
  ['smtp',                'CNAME', 'smtp-pt.securemail.pro',        'CORREIO — envio'],
  // O webmail é uma cadeia: webmail-pt.setupdns.net → webmail-pt.securemail.pro.
  // O que a zona guarda é o primeiro; verificar o último dava falso negativo.
  ['webmail',             'CNAME', 'webmail-pt.setupdns.net',       'CORREIO — webmail'],
  ['autoconfig',          'CNAME', 'tb-pt.securemail.pro',          'CORREIO — configuração automática'],
  ['ftp',                 'CNAME', D,                                'FTP do alojamento'],
  ['send',                'MX',  'feedback-smtp.eu-west-1.amazonses.com', 'RESEND — devoluções'],
  ['send',                'TXT', 'v=spf1 include:amazonses.com',    'RESEND — SPF'],
  ['resend._domainkey',   'TXT', 'p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCsxWNak7ICI6DoNeTfspNDx1blELbU6EIwygZZ7nUV', 'RESEND — DKIM'],
  ['_dmarc',              'TXT', 'v=DMARC1',                        'RESEND — DMARC'],
];

function consultar(nome, tipo) {
  const alvo = nome ? `${nome}.${D}` : D;
  try {
    // @8.8.8.8 de propósito: interessa o que o mundo vê, não a cache local.
    return execSync(`dig +short @8.8.8.8 ${tipo} ${alvo}`, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

let falhas = 0;
console.log(`Zona de ${D} — 13 registos esperados\n`);

for (const [nome, tipo, contem, para] of ESPERADO) {
  const alvo = nome ? `${nome}.${D}` : '@';
  const r = consultar(nome, tipo);
  if (r.includes(contem)) {
    console.log(`✓ ${tipo.padEnd(5)} ${alvo.padEnd(28)} ${para}`);
  } else {
    falhas++;
    console.error(`✗ ${tipo.padEnd(5)} ${alvo.padEnd(28)} ${para}`);
    console.error(`      esperado conter: ${contem.slice(0, 60)}`);
    console.error(`      obtido:          ${r || '(nada)'}`);
  }
}

console.log('\nNameservers:', consultar('', 'NS').split('\n').join(' '));

console.log();
if (falhas) {
  console.error(`${falhas} registo(s) em falta. NÃO dês a migração por concluída.`);
  console.error('Os marcados CORREIO partem o email; o de FTP parte o envio de ficheiros.');
  process.exit(1);
}
console.log('Zona completa.');
