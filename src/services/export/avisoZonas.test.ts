import { trimRouteForZones } from '../privacyZones';

/**
 * O aviso de zona de privacidade na exportação.
 *
 * O ficheiro leva o traçado completo de propósito — são os dados de quem correu
 * e o objetivo é levá-los inteiros para outro serviço. Mas as zonas escondem o
 * traçado **dentro da app**, e um ficheiro que sai dela não passa por elas: quem
 * o partilhar partilha a casa.
 *
 * A contagem é derivada do `trimRouteForZones`, que já tem os seus testes. O que
 * se testa aqui é a decisão: **quando** é que se avisa.
 */

const casa = { lat: 38.7223, lng: -9.1393 };
const zona = { id: 'z', user_id: 'u', lat: casa.lat, lng: casa.lng, radius: 200, created_at: '' } as any;

/** Um ponto a `metros` a norte da casa. */
const aNorte = (metros: number) => ({
  lat: casa.lat + metros / 111_320,
  lng: casa.lng,
  timestamp: '2026-08-26T07:00:00.000Z',
});

/** A mesma conta que o serviço faz, sem a ida à rede. */
const emZona = (pontos: any[], zonas: any[]) => pontos.length - trimRouteForZones(pontos, zonas).length;

describe('quando é que a exportação avisa', () => {
  it('não avisa quando o percurso não passa por zona nenhuma', () => {
    const pontos = [aNorte(5000), aNorte(6000)];
    expect(emZona(pontos, [zona])).toBe(0);
  });

  it('avisa, e diz quantos pontos', () => {
    const pontos = [aNorte(0), aNorte(50), aNorte(5000)];
    expect(emZona(pontos, [zona])).toBe(2);
  });

  it('sem zonas definidas não há nada a avisar', () => {
    expect(emZona([aNorte(0), aNorte(50)], [])).toBe(0);
  });
});

describe('quando não se consegue verificar', () => {
  /**
   * `null` não é zero, e a diferença é a que interessa.
   *
   * Sem rede não se leem as zonas. Tratar isso como "não atravessa" exportava em
   * silêncio o traçado de casa de quem tem zonas definidas — a falha aconteceria
   * exatamente a quem se tinha dado ao trabalho de as criar.
   */
  it('a dúvida também avisa', () => {
    const decidir = (emZona: number | null) => emZona === null || emZona > 0;
    expect(decidir(null)).toBe(true);
    expect(decidir(0)).toBe(false);
    expect(decidir(3)).toBe(true);
  });

  it('o serviço trata a falha de rede como dúvida, não como zero', () => {
    const src = require('node:fs').readFileSync(
      require('node:path').resolve(__dirname, 'exportActivityGpx.ts'), 'utf8');
    const fn = src.slice(src.indexOf('export async function pontosDentroDeZonas'),
                         src.indexOf('@param confirmarZonas'));
    expect(fn).toMatch(/catch\s*\{\s*return null;/);
    // E a decisão tem de aceitar o null como motivo para avisar.
    expect(src).toMatch(/emZona === null \|\| emZona > 0/);
  });

  it('sem callback de confirmação a exportação não é bloqueada', () => {
    // O aviso é do ecrã. Um chamador que não o forneça — um teste, um script —
    // não pode ficar preso à espera de uma resposta que ninguém vai dar.
    const src = require('node:fs').readFileSync(
      require('node:path').resolve(__dirname, 'exportActivityGpx.ts'), 'utf8');
    expect(src).toMatch(/if \(confirmarZonas\) \{/);
  });
});
