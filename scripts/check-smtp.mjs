#!/usr/bin/env node
/**
 * Confirma que o SMTP próprio funciona — antes de o colar no Supabase.
 *
 * O painel do Supabase aceita as credenciais sem as testar: guarda-as, diz
 * "Settings saved" e só se descobre que estão erradas quando o próximo registo
 * devolve 500 com `Error sending confirmation email`. Foi exatamente assim que
 * o serviço embutido nos apanhou a 20 de agosto (ver 3.2.7 do ESTADO).
 *
 * Este script faz o que o GoTrue vai fazer: liga-se ao servidor, negoceia TLS,
 * autentica-se, e envia uma mensagem real para o endereço de teste. Se passar,
 * as mesmas quatro linhas coladas no painel vão funcionar.
 *
 *   npm run smtp:check
 *
 * Lê do `.env` (que é gitignorado — as credenciais nunca entram no repositório
 * nem no bundle da app, ao contrário das `EXPO_PUBLIC_*`):
 *
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_TEST_TO
 */
import net from 'node:net';
import tls from 'node:tls';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPO_LIMITE_MS = 20_000;

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
 * Uma resposta SMTP pode ocupar várias linhas: as intermédias trazem um hífen
 * a seguir ao código (`250-STARTTLS`) e só a última traz um espaço (`250 OK`).
 * Ler chunk a chunk sem esperar por essa última linha é a forma clássica de
 * ficar a meio de uma resposta e a interpretar mal.
 */
function respostaCompleta(texto) {
  const linhas = texto.split('\r\n');
  if (linhas[linhas.length - 1] !== '') return false;
  return /^\d{3} /.test(linhas[linhas.length - 2] ?? '');
}

function criarSessao(socket) {
  let buffer = '';
  let aguardar = null;
  let erro = null;

  const aoDados = (chunk) => {
    buffer += chunk;
    if (aguardar && respostaCompleta(buffer)) {
      const texto = buffer;
      buffer = '';
      const resolver = aguardar.resolve;
      aguardar = null;
      resolver({ codigo: parseInt(texto.slice(0, 3), 10), texto: texto.trim() });
    }
  };
  const aoErro = (e) => {
    erro = e;
    if (aguardar) {
      const rejeitar = aguardar.reject;
      aguardar = null;
      rejeitar(e);
    }
  };

  socket.setEncoding('utf8');
  socket.on('data', aoDados);
  socket.on('error', aoErro);
  socket.on('timeout', () => aoErro(new Error('TEMPO_LIMITE')));

  return {
    ler() {
      if (erro) return Promise.reject(erro);
      if (respostaCompleta(buffer)) {
        const texto = buffer;
        buffer = '';
        return Promise.resolve({ codigo: parseInt(texto.slice(0, 3), 10), texto: texto.trim() });
      }
      return new Promise((resolve, reject) => {
        aguardar = { resolve, reject };
      });
    },
    escrever(linha) {
      socket.write(linha + '\r\n');
      return this.ler();
    },
    /** Antes de embrulhar o socket em TLS há que largar os ouvintes: senão
     *  este continua a apanhar os bytes já cifrados e a estragar o handshake. */
    desligar() {
      socket.removeListener('data', aoDados);
      socket.removeListener('error', aoErro);
      socket.removeAllListeners('timeout');
    },
  };
}

function ligar(host, porta, seguro) {
  return new Promise((resolve, reject) => {
    const socket = seguro
      ? tls.connect({ host, port: porta, servername: host })
      : net.connect({ host, port: porta });
    socket.setTimeout(TEMPO_LIMITE_MS);
    socket.once(seguro ? 'secureConnect' : 'connect', () => resolve(socket));
    socket.once('error', reject);
    socket.once('timeout', () => reject(new Error('TEMPO_LIMITE')));
  });
}

function exigir(resposta, esperado, passo) {
  const ok = Array.isArray(esperado) ? esperado.includes(resposta.codigo) : resposta.codigo === esperado;
  if (!ok) {
    const e = new Error(`${passo} devolveu ${resposta.codigo}`);
    e.smtp = resposta;
    e.passo = passo;
    throw e;
  }
  return resposta;
}

/** Uma linha do corpo que comece por ponto termina a mensagem, se não for escapada. */
function protegerPontos(corpo) {
  return corpo.replace(/\r\n\./g, '\r\n..');
}

function montarMensagem({ de, para, dominio }) {
  const agora = new Date();
  const cabecalhos = [
    `From: Cadence Club <${de}>`,
    `To: <${para}>`,
    'Subject: =?utf-8?B?' + Buffer.from('Cadence Club — teste de SMTP').toString('base64') + '?=',
    `Date: ${agora.toUTCString()}`,
    `Message-ID: <${agora.getTime()}.smtp-check@${dominio}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
  ].join('\r\n');

  const corpo = [
    'Se estás a ler isto, o SMTP próprio funciona.',
    '',
    'Enviado por `npm run smtp:check` do Cadence Club.',
    'As mesmas credenciais podem ir para o painel do Supabase:',
    'Project Settings → Authentication → SMTP Settings.',
    '',
    'Antes de dar por fechado, confirma duas coisas nesta mensagem:',
    '  1. chegou à Caixa de entrada e não ao Spam;',
    '  2. o cabeçalho traz `dkim=pass` e `spf=pass`',
    '     (no Gmail: ⋮ → Mostrar original).',
  ].join('\r\n');

  return protegerPontos(`${cabecalhos}\r\n\r\n${corpo}`);
}

async function principal() {
  // O `.env` é a fonte normal; as variáveis de ambiente sobrepõem-se, o que
  // permite experimentar credenciais sem lhes tocar:
  //   SMTP_HOST=... SMTP_USER=... npm run smtp:check
  const doAmbiente = Object.fromEntries(
    ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'SMTP_TEST_TO']
      .filter((k) => process.env[k])
      .map((k) => [k, process.env[k]]),
  );
  const env = { ...lerEnv(), ...doAmbiente };
  const host = env.SMTP_HOST ?? '';
  const porta = parseInt(env.SMTP_PORT ?? '587', 10);
  const utilizador = env.SMTP_USER ?? '';
  const palavraPasse = env.SMTP_PASS ?? '';
  const de = env.SMTP_FROM ?? '';
  const para = env.SMTP_TEST_TO ?? '';

  const emFalta = Object.entries({ SMTP_HOST: host, SMTP_USER: utilizador, SMTP_PASS: palavraPasse, SMTP_FROM: de, SMTP_TEST_TO: para })
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (emFalta.length) {
    console.error('✗ Falta preencher no `.env`:', emFalta.join(', '));
    console.error();
    console.error('  O `.env.example` tem o bloco a copiar, e o');
    console.error('  `supabase/SMTP.md` explica onde ir buscar cada valor.');
    process.exit(1);
  }

  // As `EXPO_PUBLIC_*` são embutidas no bundle da app, que é lido por qualquer
  // pessoa com o .apk. Uma palavra-passe de SMTP lá dentro é uma conta de envio
  // oferecida a spammers — e a reputação do domínio vai atrás.
  const publicas = Object.keys(env).filter((k) => k.startsWith('EXPO_PUBLIC_') && /SMTP/i.test(k));
  if (publicas.length) {
    console.error('✗ PERIGO:', publicas.join(', '), 'começa por `EXPO_PUBLIC_`.');
    console.error('  Tudo o que tem esse prefixo é embutido no bundle da app e fica legível.');
    console.error('  Renomeia sem o prefixo. Se já foi para uma build, roda a credencial.');
    process.exit(1);
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(de)) {
    console.error('✗ SMTP_FROM não é um endereço válido:', de);
    process.exit(1);
  }

  const dominio = de.split('@')[1];
  const implicito = porta === 465;

  console.log(`→ ${host}:${porta} (${implicito ? 'TLS direto' : 'STARTTLS'}), de ${de} para ${para}`);

  let socket;
  try {
    socket = await ligar(host, porta, implicito);
  } catch (e) {
    console.error('✗ Não foi possível ligar:', e.message);
    console.error();
    if (e.message === 'TEMPO_LIMITE') {
      console.error('  Sem resposta. Ou o host está errado, ou a rede bloqueia a porta.');
      console.error('  Muitos ISPs bloqueiam a 25 — usa a 587 ou a 465.');
    } else if (e.code === 'ENOTFOUND') {
      console.error('  O nome do servidor não resolve. Confirma o SMTP_HOST.');
    }
    process.exit(1);
  }

  let sessao = criarSessao(socket);

  try {
    exigir(await sessao.ler(), 220, 'Ligação');
    let saudacao = exigir(await sessao.escrever('EHLO cadence-club.local'), 250, 'EHLO');

    if (!implicito) {
      if (!/STARTTLS/i.test(saudacao.texto)) {
        console.error('✗ O servidor não anuncia STARTTLS na porta', porta);
        console.error('  Sem TLS as credenciais viajariam em claro. O Supabase exige TLS.');
        console.error('  Tenta a porta 465 (TLS direto).');
        process.exit(1);
      }
      exigir(await sessao.escrever('STARTTLS'), 220, 'STARTTLS');
      sessao.desligar();
      socket = await new Promise((resolve, reject) => {
        const seguro = tls.connect({ socket, servername: host }, () => resolve(seguro));
        seguro.once('error', reject);
      });
      socket.setTimeout(TEMPO_LIMITE_MS);
      sessao = criarSessao(socket);
      saudacao = exigir(await sessao.escrever('EHLO cadence-club.local'), 250, 'EHLO (pós-TLS)');
    }

    if (!/AUTH[ =-].*LOGIN/i.test(saudacao.texto)) {
      console.log('  (o servidor não anuncia AUTH LOGIN; a tentar na mesma)');
    }

    exigir(await sessao.escrever('AUTH LOGIN'), 334, 'AUTH LOGIN');
    exigir(await sessao.escrever(Buffer.from(utilizador).toString('base64')), 334, 'utilizador');
    exigir(await sessao.escrever(Buffer.from(palavraPasse).toString('base64')), 235, 'palavra-passe');
    console.log('✓ autenticado');

    exigir(await sessao.escrever(`MAIL FROM:<${de}>`), 250, 'MAIL FROM');
    exigir(await sessao.escrever(`RCPT TO:<${para}>`), [250, 251], 'RCPT TO');
    exigir(await sessao.escrever('DATA'), 354, 'DATA');

    socket.write(montarMensagem({ de, para, dominio }) + '\r\n.\r\n');
    const aceite = exigir(await sessao.ler(), 250, 'entrega');
    console.log('✓ aceite pelo servidor:', aceite.texto.split('\r\n')[0]);

    await sessao.escrever('QUIT').catch(() => {});
    socket.end();

    console.log();
    console.log('SMTP a funcionar. Agora, por esta ordem:');
    console.log(`  1. abre a caixa de ${para} e confirma que a mensagem chegou`);
    console.log('     — se caiu no Spam, o DNS está incompleto (ver supabase/SMTP.md §3)');
    console.log('  2. cola estes valores no painel: Project Settings → Authentication →');
    console.log('     SMTP Settings → Enable Custom SMTP');
    console.log('  3. sobe o rate limit em Authentication → Rate Limits → Emails');
    console.log('     (o valor de fábrica com SMTP próprio continua baixo)');
    console.log('  4. volta a ligar o "Confirm email" e regista uma conta de teste');
  } catch (e) {
    console.error();
    if (e.message === 'TEMPO_LIMITE') {
      console.error('✗ O servidor deixou de responder a meio da sessão.');
      process.exit(1);
    }
    console.error(`✗ ${e.passo ?? 'SMTP'} falhou`);
    if (e.smtp) console.error('  ' + e.smtp.texto.split('\r\n').join('\n  '));
    console.error();
    const codigo = e.smtp?.codigo;
    if (codigo === 535 || codigo === 534 || e.passo === 'palavra-passe') {
      console.error('  Autenticação recusada. Nos fornecedores modernos o SMTP_USER quase');
      console.error('  nunca é o teu email — no Resend é literalmente `resend`, no Brevo é');
      console.error('  o email da conta, no SES é uma credencial gerada só para SMTP.');
      console.error('  A palavra-passe é a API key inteira, incluindo o prefixo.');
    } else if (e.passo === 'MAIL FROM' || e.passo === 'RCPT TO') {
      console.error('  O servidor recusou o remetente ou o destinatário. Normalmente é o');
      console.error(`  domínio \`${dominio}\` ainda por verificar no fornecedor, ou a conta`);
      console.error('  em modo de teste — nesse modo só se pode enviar para o próprio email.');
    }
    process.exit(1);
  }
}

principal().catch((e) => {
  console.error('✗ erro inesperado:', e);
  process.exit(1);
});
