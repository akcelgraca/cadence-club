import {
  metersToDisplay,
  formatDistanceImperial,
  paceToDisplay,
  speedToDisplay,
  elevationToDisplay,
} from './convertUnits';

describe('metersToDisplay', () => {
  describe('métrico', () => {
    it('usa metros abaixo de 1 km', () => {
      expect(metersToDisplay(0)).toEqual({ value: 0, unit: 'm' });
      expect(metersToDisplay(999)).toEqual({ value: 999, unit: 'm' });
      expect(metersToDisplay(450.6)).toEqual({ value: 451, unit: 'm' });
    });

    it('passa a quilómetros a partir de 1000 m', () => {
      expect(metersToDisplay(1000)).toEqual({ value: 1, unit: 'km' });
      expect(metersToDisplay(5500)).toEqual({ value: 5.5, unit: 'km' });
    });

    it('arredonda ao quilómetro acima de 10 km', () => {
      expect(metersToDisplay(10000)).toEqual({ value: 10, unit: 'km' });
      expect(metersToDisplay(42195)).toEqual({ value: 42, unit: 'km' });
    });

    it('é métrico por omissão', () => {
      expect(metersToDisplay(5000)).toEqual(metersToDisplay(5000, 'metric'));
    });
  });

  describe('imperial', () => {
    it('usa pés abaixo de 0,1 milha', () => {
      expect(metersToDisplay(100, 'imperial')).toEqual({ value: 328, unit: 'ft' });
      expect(metersToDisplay(0, 'imperial')).toEqual({ value: 0, unit: 'ft' });
    });

    it('usa milhas acima de 0,1 milha', () => {
      const { value, unit } = metersToDisplay(1000, 'imperial');
      expect(unit).toBe('mi');
      expect(value).toBeCloseTo(0.621371, 6);
    });

    it('arredonda à milha acima de 10 milhas', () => {
      // Maratona: 42,195 km ≈ 26,2 milhas
      expect(metersToDisplay(42195, 'imperial')).toEqual({ value: 26, unit: 'mi' });
    });
  });
});

describe('formatDistanceImperial', () => {
  it('formata distâncias métricas', () => {
    expect(formatDistanceImperial(0)).toBe('0 m');
    expect(formatDistanceImperial(750)).toBe('750 m');
    expect(formatDistanceImperial(1000)).toBe('1.0 km');
    expect(formatDistanceImperial(5500)).toBe('5.5 km');
    expect(formatDistanceImperial(42195)).toBe('42 km');
  });

  it('formata distâncias imperiais', () => {
    expect(formatDistanceImperial(100, 'imperial')).toBe('328 ft');
    expect(formatDistanceImperial(1000, 'imperial')).toBe('0.6 mi');
    expect(formatDistanceImperial(5000, 'imperial')).toBe('3.1 mi');
    expect(formatDistanceImperial(42195, 'imperial')).toBe('26 mi');
  });

  it('não escreve metros quando o utilizador escolheu imperial', () => {
    // Sub-quilómetro em imperial tem de sair em pés ou milhas, nunca em "m".
    expect(formatDistanceImperial(500, 'imperial')).not.toMatch(/\bm$/);
    expect(formatDistanceImperial(50, 'imperial')).not.toMatch(/\bm$/);
  });
});

describe('paceToDisplay', () => {
  it('formata o ritmo métrico em minutos por quilómetro', () => {
    expect(paceToDisplay(330)).toBe('5\'30"/km');
    expect(paceToDisplay(300)).toBe('5\'00"/km');
    expect(paceToDisplay(65)).toBe('1\'05"/km');
  });

  it('preenche os segundos com zero à esquerda', () => {
    expect(paceToDisplay(305)).toBe('5\'05"/km');
  });

  it('converte para minutos por milha em imperial', () => {
    // 5'30"/km = 8'51"/mi
    expect(paceToDisplay(330, 'imperial')).toBe('8\'51"/mi');
  });

  it('mostra travessões quando não há ritmo', () => {
    expect(paceToDisplay(null)).toBe('--:--/km');
    expect(paceToDisplay(0)).toBe('--:--/km');
    expect(paceToDisplay(-5)).toBe('--:--/km');
    expect(paceToDisplay(null, 'imperial')).toBe('--:--/mi');
  });

  it('aguenta ritmos acima de uma hora por quilómetro', () => {
    expect(paceToDisplay(3900)).toBe('65\'00"/km');
  });
});

describe('speedToDisplay', () => {
  it('converte ritmo em velocidade métrica', () => {
    expect(speedToDisplay(360)).toBe('10.0 km/h');
    expect(speedToDisplay(300)).toBe('12.0 km/h');
  });

  it('converte ritmo em velocidade imperial', () => {
    // 10 km/h = 6,21 mph
    expect(speedToDisplay(360, 'imperial')).toBe('6.2 mph');
  });

  it('mostra travessões quando não há ritmo', () => {
    expect(speedToDisplay(null)).toBe('-- km/h');
    expect(speedToDisplay(0)).toBe('-- km/h');
    expect(speedToDisplay(null, 'imperial')).toBe('-- mph');
  });
});

describe('elevationToDisplay', () => {
  it('arredonda ao metro em métrico', () => {
    expect(elevationToDisplay(0)).toBe('0 m');
    expect(elevationToDisplay(123.4)).toBe('123 m');
    expect(elevationToDisplay(123.6)).toBe('124 m');
  });

  it('converte para pés em imperial', () => {
    expect(elevationToDisplay(100, 'imperial')).toBe('328 ft');
    expect(elevationToDisplay(0, 'imperial')).toBe('0 ft');
  });
});
