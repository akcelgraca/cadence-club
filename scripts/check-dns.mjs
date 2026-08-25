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

/**
 * ⚠️ Os dois registos do site mudam de resposta quando a Cloudflare entra.
 *
 * Com a nuvem laranja, a Cloudflare deixa de devolver o IP da Amen e passa a
 * devolver os seus — é precisamente isso que lhe permite terminar o TLS e dar-
 * nos HTTPS. O painel dela continua a mostrar `81.88.57.70`, mas o mundo passa
 * a ver outra coisa, e o `dig CNAME www` deixa de devolver nada.
 *
 * A primeira versão deste script exigia o IP da Amen. Depois da migração
 * acusaria o site como partido estando ele bom — e um alarme falso no meio de
 * uma migração é pior do que alarme nenhum, porque ensina a ignorar os outros
 * onze.
 */
const ORIGEM_AMEN = '81.88.57.70';
const CLOUDFLARE = /^(104\.1[6-9]\.|104\.2[0-7]\.|172\.6[4-9]\.|172\.7[0-1]\.|188\.114\.|162\.15[89]\.)/;

/** Aceita a origem da Amen (antes) ou a Cloudflare (depois). */
function siteOk(resposta) {
  if (resposta.includes(ORIGEM_AMEN)) return 'direto na Amen';
  if (resposta.split('\n').some((l) => CLOUDFLARE.test(l.trim()))) return 'via Cloudflare';
  return null;
}

/** [nome, tipo, fragmento que a resposta tem de conter, para que serve] */
const ESPERADO = [
  ['www',                 'A',   null,                              'site'],
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

// O apex é verificado à parte porque a resposta certa muda com a migração.
{
  const r = consultar('', 'A');
  const onde = siteOk(r);
  if (onde) {
    console.log(`✓ A     ${'@'.padEnd(28)} site (${onde})`);
  } else {
    falhas++;
    console.error(`✗ A     ${'@'.padEnd(28)} site`);
    console.error(`      esperado: ${ORIGEM_AMEN} (Amen) ou um IP da Cloudflare`);
    console.error(`      obtido:   ${r || '(nada)'}`);
  }
}

for (const [nome, tipo, contem, para] of ESPERADO) {
  const alvo = nome ? `${nome}.${D}` : '@';
  const r = consultar(nome, tipo);
  // `contem: null` = registo do site, que muda de resposta com a migração.
  if (contem === null) {
    const onde = siteOk(r);
    if (onde) { console.log(`✓ ${tipo.padEnd(5)} ${alvo.padEnd(28)} ${para} (${onde})`); }
    else {
      falhas++;
      console.error(`✗ ${tipo.padEnd(5)} ${alvo.padEnd(28)} ${para}`);
      console.error(`      esperado: a Amen ou a Cloudflare · obtido: ${r || '(nada)'}`);
    }
    continue;
  }
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
