#!/usr/bin/env node
/**
 * Gera todos os ícones da marca a partir de uma única fonte: a geometria do
 * símbolo, aqui em baixo, num grelha de 100×100.
 *
 * Porque é que isto é um script e não sete PNG desenhados à mão: os sete
 * ficheiros anteriores tinham divergido entre si (os três do adaptativo do
 * Android eram literalmente o mesmo ficheiro, `md5` igual, e o `splash-icon`
 * era cópia do `icon`). Enquanto o desenho vive em código, um ajuste de traço
 * propaga-se a tudo com `npm run brand:build` e não há forma de ficarem
 * dessincronizados.
 *
 * Não há dependências: nem `sharp`, nem `rsvg`, nem `cairosvg` — nenhum deles
 * existe nesta máquina. O rasterizador é um campo de distâncias com anti-alias
 * analítico, que para formas feitas só de arcos e segmentos dá um resultado
 * melhor do que sobreamostrar.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = join(RAIZ, 'assets');

/**
 * O catálogo de ícones do projeto iOS.
 *
 * O `assets/icon.png` não é o que o iPhone mostra: o Xcode lê daqui, e quem
 * copia de um para o outro é o `expo prebuild`. Como o `ios/` está no
 * `.gitignore` e o `build-iphone.sh` vai direto ao `xcodebuild`, o prebuild não
 * corre desde 18 ago — mudar o ícone e compilar dava BUILD SUCCEEDED com o
 * ícone antigo no telemóvel, sem um único aviso. Escrever aqui fecha o buraco.
 */
const IOS_APPICON = join(
  RAIZ, 'ios', 'CadenceClub', 'Images.xcassets', 'AppIcon.appiconset',
  'App-Icon-1024x1024@1x.png',
);

/* ─────────────────────────── a marca ─────────────────────────── */

/** Grelha de desenho. O SVG mestre em `assets/brand/` usa a mesma. */
const GRID = 100;

/**
 * O C. Aberto à direita num vão de 86°, que é por onde a batida aponta.
 * Ângulos em graus no sentido do ecrã (y para baixo): o arco vai dos 43° aos
 * 317°, passando pelo 180° — ou seja, tudo menos o vão da direita.
 */
const ARC = { cx: 50, cy: 50, r: 33, width: 11, from: 43, to: 317 };

/**
 * O traçado do batimento, dentro do contra-forma do C.
 * Seis pontos e não mais: cada vértice a mais é um vértice que se fecha
 * sozinho aos 34 px do ecrã inicial.
 */
const ECG = {
  width: 8,
  points: [[32, 50], [42, 50], [48, 38], [55, 62], [60, 50], [68, 50]],
};

/**
 * Lado da caixa que a marca ocupa de facto na grelha: o círculo exterior do C,
 * `2 × (r + traço/2)`. É a partir disto — e não dos 100 da grelha — que se
 * calcula a margem de cada ícone, senão a margem real seria sempre maior do
 * que a pedida.
 */
const EXTENT = 2 * (ARC.r + ARC.width / 2); // 77

/* ──────────────────────── campo de distâncias ──────────────────────── */

const RAD = Math.PI / 180;

function distanceToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const wx = px - ax, wy = py - ay;
  const len2 = vx * vx + vy * vy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
  return Math.hypot(wx - t * vx, wy - t * vy);
}

/** Distância ao arco, com as pontas redondas a virem de graça pelos extremos. */
function distanceToArc(px, py) {
  const dx = px - ARC.cx, dy = py - ARC.cy;
  const a0 = ARC.from * RAD;
  const span = ((ARC.to - ARC.from) * RAD + 2 * Math.PI) % (2 * Math.PI);
  const rel = (Math.atan2(dy, dx) - a0 + 2 * Math.PI * 2) % (2 * Math.PI);
  if (rel <= span) return Math.abs(Math.hypot(dx, dy) - ARC.r);
  return Math.min(
    Math.hypot(px - (ARC.cx + ARC.r * Math.cos(a0)), py - (ARC.cy + ARC.r * Math.sin(a0))),
    Math.hypot(px - (ARC.cx + ARC.r * Math.cos(a0 + span)), py - (ARC.cy + ARC.r * Math.sin(a0 + span))),
  );
}

function distanceToEcg(px, py) {
  let best = Infinity;
  for (let i = 0; i < ECG.points.length - 1; i++) {
    const [ax, ay] = ECG.points[i];
    const [bx, by] = ECG.points[i + 1];
    const d = distanceToSegment(px, py, ax, ay, bx, by);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Distância com sinal à marca inteira: negativa dentro do traço.
 * A união das duas formas é o mínimo das duas — as juntas redondas do traçado
 * saem daí sem código extra.
 */
function signedDistance(px, py, withEcg) {
  const arc = distanceToArc(px, py) - ARC.width / 2;
  if (!withEcg) return arc;
  return Math.min(arc, distanceToEcg(px, py) - ECG.width / 2);
}

/* ─────────────────────────── rasterizador ─────────────────────────── */

function hex(value) {
  const h = value.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/**
 * @param size    lado do PNG em píxeis
 * @param options.fill      cor da marca
 * @param options.background  cor de fundo, ou `null` para transparente
 * @param options.coverage  fração do lado que a marca ocupa
 * @param options.withEcg   `false` desenha só o C, sem o traçado
 */
function render(size, { fill, background = null, coverage, withEcg = true }) {
  const [fr, fg, fb] = hex(fill);
  const [br, bg, bb] = hex(background ?? '#000000');
  const opaque = background !== null;

  // Píxeis por unidade da grelha, e o inverso — a largura de um píxel medida
  // em unidades de desenho, que é a janela do anti-alias.
  const scale = (size * coverage) / EXTENT;
  const aa = 1 / scale;

  const channels = opaque ? 3 : 4;
  const stride = size * channels;
  const raw = Buffer.alloc(size * (stride + 1));

  for (let y = 0; y < size; y++) {
    const row = y * (stride + 1);
    raw[row] = 0; // filtro "None": as formas são suaves, um filtro não paga
    const dy = (y + 0.5 - size / 2) / scale + ARC.cy;

    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - size / 2) / scale + ARC.cx;
      const sd = signedDistance(dx, dy, withEcg);
      const alpha = Math.max(0, Math.min(1, 0.5 - sd / aa));

      const at = row + 1 + x * channels;
      if (opaque) {
        // Composto sobre o fundo: o iOS rejeita canal alfa no ícone da app.
        raw[at] = Math.round(br + (fr - br) * alpha);
        raw[at + 1] = Math.round(bg + (fg - bg) * alpha);
        raw[at + 2] = Math.round(bb + (fb - bb) * alpha);
      } else {
        raw[at] = fr;
        raw[at + 1] = fg;
        raw[at + 2] = fb;
        raw[at + 3] = Math.round(alpha * 255);
      }
    }
  }
  return png(size, size, raw, opaque ? 2 : 6);
}

/** Chapa de cor sólida — o fundo do ícone adaptativo do Android. */
function solid(size, color) {
  const [r, g, b] = hex(color);
  const stride = size * 3;
  const raw = Buffer.alloc(size * (stride + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (stride + 1);
    for (let x = 0; x < size; x++) {
      const at = row + 1 + x * 3;
      raw[at] = r; raw[at + 1] = g; raw[at + 2] = b;
    }
  }
  return png(size, size, raw, 2);
}

/* ───────────────────────────── PNG ───────────────────────────── */

function chunk(type, data) {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([head, body, crc]);
}

let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function png(width, height, raw, colorType) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;           // 8 bits por canal
  ihdr[9] = colorType;   // 2 = RGB, 6 = RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ───────────────────────────── paleta ───────────────────────────── */

const INK = '#101211';   // o fundo do tema escuro; a chapa de todos os ícones
const LIME = '#9ED42F';  // o verde da marca sobre fundo escuro
const WHITE = '#FFFFFF';

/**
 * Zona de segurança do ícone adaptativo do Android: de 108dp de tela só 72dp
 * ficam sempre visíveis e apenas os 66dp centrais são garantidos, seja qual
 * for a máscara do fabricante. 66/108 = 61%; a marca fica bem dentro disso.
 */
const ANDROID_SAFE = 0.46;

const OUTPUTS = [
  // O ícone da app. Sem alfa, por exigência do iOS.
  ['icon.png', () => render(1024, { fill: LIME, background: INK, coverage: 0.62 })],
  // O splash desenha sobre a cor de fundo configurada, por isso vai transparente.
  ['splash-icon.png', () => render(1024, { fill: LIME, coverage: 0.5 })],
  ['android-icon-background.png', () => solid(432, INK)],
  ['android-icon-foreground.png', () => render(432, { fill: LIME, coverage: ANDROID_SAFE })],
  // O monocromático é uma silhueta: o Android pinta-o com a cor do sistema.
  ['android-icon-monochrome.png', () => render(432, { fill: WHITE, coverage: ANDROID_SAFE })],
  ['favicon.png', () => render(196, { fill: LIME, background: INK, coverage: 0.64 })],
  // O da notificação chega ao ecrã a 24dp e a uma cor só. Testado a esse
  // tamanho: o traçado amolece mas ainda se lê, e vale mais um desenho só em
  // todo o lado do que uma variante simplificada a viver por sua conta.
  ['notification-icon.png', () => render(96, { fill: WHITE, coverage: 0.78 })],
];

mkdirSync(ASSETS, { recursive: true });
let appIcon = null;
for (const [name, build] of OUTPUTS) {
  const buffer = build();
  writeFileSync(join(ASSETS, name), buffer);
  if (name === 'icon.png') appIcon = buffer;
  console.log(`  ${name.padEnd(30)} ${String(buffer.length).padStart(7)} bytes`);
}

// O projeto iOS pode não existir — é gerado e está no `.gitignore`.
if (existsSync(dirname(IOS_APPICON))) {
  writeFileSync(IOS_APPICON, appIcon);
  console.log(`  ios/…/App-Icon-1024x1024@1x.png ${String(appIcon.length).padStart(7)} bytes`);
} else {
  console.log('  (projeto iOS ausente — corre `npx expo prebuild` antes de compilar)');
}

console.log('\nícones da marca gerados.');
console.log('⚠️  Android: os mipmaps são .webp e só o `expo prebuild --platform android` os regenera.');
