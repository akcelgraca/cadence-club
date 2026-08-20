import { formatDuration, formatRelativeTime, formatDate, localeTag, monthNames } from './dateHelpers';
import i18n from '../lib/i18n';

describe('formatDuration', () => {
  it('omite as horas abaixo de uma hora', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(9)).toBe('0:09');
    expect(formatDuration(60)).toBe('1:00');
    expect(formatDuration(605)).toBe('10:05');
    expect(formatDuration(3599)).toBe('59:59');
  });

  it('mostra as horas a partir dos 3600 s', () => {
    expect(formatDuration(3600)).toBe('1:00:00');
    expect(formatDuration(3661)).toBe('1:01:01');
    expect(formatDuration(45296)).toBe('12:34:56');
  });

  it('trunca os segundos fracionários', () => {
    expect(formatDuration(90.9)).toBe('1:30');
  });

  it('preenche minutos e segundos com dois dígitos', () => {
    expect(formatDuration(3725)).toBe('1:02:05');
  });
});

describe('formatRelativeTime', () => {
  const agora = new Date('2026-07-15T12:00:00.000Z');

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(agora);
    // O idioma tem de ser fixado: estas frases passaram a vir do i18n, e o
    // idioma por omissão nos testes é o do ambiente, não o português.
    i18n.changeLanguage('pt');
  });

  afterEach(() => {
    jest.useRealTimers();
    i18n.changeLanguage('pt');
  });

  /** Data a N segundos no passado. */
  function haSegundos(segundos: number): string {
    return new Date(agora.getTime() - segundos * 1000).toISOString();
  }

  it('diz "agora" no primeiro minuto', () => {
    expect(formatRelativeTime(haSegundos(0))).toBe('agora');
    expect(formatRelativeTime(haSegundos(59))).toBe('agora');
  });

  it('conta minutos até à hora', () => {
    expect(formatRelativeTime(haSegundos(60))).toBe('há 1min');
    expect(formatRelativeTime(haSegundos(59 * 60))).toBe('há 59min');
  });

  it('conta horas até ao dia', () => {
    expect(formatRelativeTime(haSegundos(3600))).toBe('há 1h');
    expect(formatRelativeTime(haSegundos(23 * 3600))).toBe('há 23h');
  });

  it('conta dias até à semana', () => {
    expect(formatRelativeTime(haSegundos(24 * 3600))).toBe('há 1 dias');
    expect(formatRelativeTime(haSegundos(6 * 24 * 3600))).toBe('há 6 dias');
  });

  it('conta semanas até ao mês', () => {
    expect(formatRelativeTime(haSegundos(7 * 24 * 3600))).toBe('há 1 sem');
    expect(formatRelativeTime(haSegundos(29 * 24 * 3600))).toBe('há 4 sem');
  });

  it('passa a data absoluta a partir de 30 dias', () => {
    const antigo = haSegundos(30 * 24 * 3600);
    const resultado = formatRelativeTime(antigo);
    expect(resultado).not.toMatch(/^há /);
    expect(resultado).toBe(new Date(antigo).toLocaleDateString('pt-PT'));
  });
});

describe('formatDate', () => {
  it('escreve a data por extenso em português', () => {
    const resultado = formatDate('2026-07-15T08:00:00.000Z');
    expect(resultado).toContain('2026');
    expect(resultado).toContain('15');
    // Mês por extenso, não numérico.
    expect(resultado).toMatch(/[a-zçã]{3,}/i);
  });
});

describe('idioma', () => {
  afterEach(() => i18n.changeLanguage('pt'));

  it('a etiqueta de locale segue o idioma da app', () => {
    i18n.changeLanguage('pt');
    expect(localeTag()).toBe('pt-PT');
    i18n.changeLanguage('en');
    expect(localeTag()).toBe('en-GB');
  });

  it('os meses vêm no idioma em vigor', () => {
    // Havia quatro listas de meses escritas à mão, todas em português, e uma
    // delas com "Marco" sem cedilha. Isto é o que impede a quinta.
    i18n.changeLanguage('pt');
    const pt = monthNames('long');
    expect(pt).toHaveLength(12);
    expect(pt[2]).toBe('Março');

    i18n.changeLanguage('en');
    expect(monthNames('long')[2]).toBe('March');
  });

  it('o tempo relativo também muda de idioma', () => {
    const haUmaHora = new Date(Date.now() - 3600 * 1000).toISOString();
    i18n.changeLanguage('pt');
    expect(formatRelativeTime(haUmaHora)).toBe('há 1h');
    i18n.changeLanguage('en');
    expect(formatRelativeTime(haUmaHora)).toBe('1h ago');
  });
});
