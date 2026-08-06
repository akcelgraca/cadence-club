import { formatPace, formatSpeed, formatElevation } from './formatPace';
import { paceToDisplay, speedToDisplay, elevationToDisplay } from './convertUnits';

/**
 * Estes três são invólucros de convertUnits. O que interessa garantir é o
 * contrato de compatibilidade: sem sistema de unidades, o comportamento tem
 * de continuar métrico — muitos ecrãs ainda chamam sem argumento.
 */

describe('invólucros de formatação', () => {
  it('formatPace delega e assume métrico por omissão', () => {
    expect(formatPace(330)).toBe(paceToDisplay(330, 'metric'));
    expect(formatPace(330)).toBe('5\'30"/km');
    expect(formatPace(330, 'imperial')).toBe(paceToDisplay(330, 'imperial'));
  });

  it('formatSpeed delega e assume métrico por omissão', () => {
    expect(formatSpeed(360)).toBe(speedToDisplay(360, 'metric'));
    expect(formatSpeed(360)).toBe('10.0 km/h');
    expect(formatSpeed(360, 'imperial')).toBe(speedToDisplay(360, 'imperial'));
  });

  it('formatElevation delega e assume métrico por omissão', () => {
    expect(formatElevation(100)).toBe(elevationToDisplay(100, 'metric'));
    expect(formatElevation(100)).toBe('100 m');
    expect(formatElevation(100, 'imperial')).toBe('328 ft');
  });

  it('aguenta ritmo em falta sem estoirar', () => {
    expect(formatPace(null)).toBe('--:--/km');
    expect(formatSpeed(null)).toBe('-- km/h');
  });
});
