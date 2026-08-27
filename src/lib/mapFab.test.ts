import { readFileSync } from 'node:fs';
import path from 'node:path';
import { alturaDoBotaoDeCriar, CAROUSEL_HEIGHT, ESTADO_VAZIO_ALTURA } from './mapFab';

const raiz = path.resolve(__dirname, '../..');
const ler = (p: string) => readFileSync(path.join(raiz, p), 'utf8');

/**
 * O botão de criar rota, no mapa.
 *
 * Esteve escondido atrás do cartão "Nenhuma rota por aqui" — ou seja, invisível
 * exatamente para quem não tinha rotas e mais precisava dele, e visível para
 * quem já as tinha. Duas causas somadas, e nenhuma se via a partir da outra:
 * a altura descia para 30px quando não havia rotas, e o cartão de estado vazio
 * ocupa esse espaço; e o cartão era desenhado **depois** no JSX, portanto
 * pintava por cima. O `elevation` do botão tapava o problema no Android; no iOS
 * não há elevation.
 */
describe('altura do botão de criar rota', () => {
  it('sobe acima do carrossel quando há rotas', () => {
    expect(alturaDoBotaoDeCriar({ aCriar: false, temRotas: true })).toBe(CAROUSEL_HEIGHT + 16);
  });

  it('sobe acima do cartão de estado vazio quando NÃO há rotas', () => {
    // Era aqui que descia para 30 e desaparecia por trás da mensagem.
    const h = alturaDoBotaoDeCriar({ aCriar: false, temRotas: false });
    expect(h).toBe(ESTADO_VAZIO_ALTURA);
    expect(h).toBeGreaterThan(90);
  });

  it('sem rotas o botão nunca fica mais baixo que o cartão', () => {
    // A consequência, dita de outra maneira: seja qual for o estado, o botão
    // tem de estar acima do que ocupa o fundo do ecrã.
    const vazio = alturaDoBotaoDeCriar({ aCriar: false, temRotas: false });
    // 16 é o `bottom` do cartão; a folga acima disso é o que o liberta.
    expect(vazio).toBeGreaterThan(16 + 60);
  });
});

describe('o ecrã do mapa', () => {
  const ecra = ler('src/app/(tabs)/routes.tsx');

  it('o botão é desenhado depois do carrossel', () => {
    // Em React Native quem vem depois pinta por cima. Enquanto o FAB esteve
    // antes, o cartão de estado vazio tapava-o.
    const fab = ecra.indexOf("accessibilityLabel={t('routes_create')}");
    const carrossel = ecra.indexOf('styles.carouselState');
    expect(fab).toBeGreaterThan(0);
    expect(carrossel).toBeGreaterThan(0);
    expect(fab).toBeGreaterThan(carrossel);
  });

  it('o botão tem zIndex, não só elevation', () => {
    // O `elevation` só conta no Android — e foi por isso que isto passou
    // despercebido até alguém abrir a app num iPhone.
    const estilo = ecra.slice(ecra.indexOf('  fab: {'), ecra.indexOf('  fab: {') + 500);
    expect(estilo).toMatch(/zIndex:/);
    expect(estilo).toMatch(/elevation:/);
  });

  it('a altura vem da função, não de uma expressão à solta', () => {
    expect(ecra).toMatch(/alturaDoBotaoDeCriar\(\{/);
    expect(ecra).not.toMatch(/showCarousel \? CAROUSEL_HEIGHT \+ 16 : 30/);
  });
});
