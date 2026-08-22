import { notificationText, formatarDataDoEvento } from './notificationText';
import pt from './i18n/pt';
import en from './i18n/en';

/**
 * Um `t` que se comporta como o i18next no que aqui interessa: procura a
 * chave, interpola `{{}}`, e devolve o `defaultValue` quando não a encontra.
 * Sem isto o teste passaria a testar o i18next em vez do nosso código.
 */
const fazerT = (dic: Record<string, string>) =>
  (chave: string, opcoes: Record<string, unknown> = {}) => {
    const modelo = dic[chave];
    if (modelo === undefined) return String(opcoes.defaultValue ?? chave);
    return modelo.replace(/\{\{(\w+)\}\}/g, (bruto, k) =>
      opcoes[k] === undefined ? bruto : String(opcoes[k]));
  };

const tPt = fazerT(pt as unknown as Record<string, string>);
const tEn = fazerT(en as unknown as Record<string, string>);

describe('notificationText', () => {
  it('traduz a partir da chave e dos parâmetros', () => {
    const n = {
      message: 'João deu-te um boost!',
      message_key: 'notif_kudo',
      message_params: { actor: 'João' },
    };
    expect(notificationText(n, tPt, 'pt')).toBe('João deu-te um boost!');
    expect(notificationText(n, tEn, 'en')).toBe('João gave you a boost!');
  });

  it('linhas anteriores à 051 caem no texto português que lá está', () => {
    // Sem chave não há nada a traduzir. Mostrar a coluna `message` é
    // exatamente o que essas pessoas já viam — não é regressão, é o estado
    // anterior preservado.
    const n = { message: 'Ana comentou na tua atividade.', message_key: null, message_params: {} };
    expect(notificationText(n, tEn, 'en')).toBe('Ana comentou na tua atividade.');
  });

  it('uma chave que não exista no dicionário não aparece em bruto', () => {
    // O i18next devolveria `notif_inventado`, e era isso que o utilizador via.
    const n = {
      message: 'Aconteceu alguma coisa.',
      message_key: 'notif_inventado',
      message_params: {},
    };
    expect(notificationText(n, tEn, 'en')).toBe('Aconteceu alguma coisa.');
  });

  it('a data do evento é formatada no locale de quem lê', () => {
    const n = {
      message: 'Clube: Prova · 14/09 18:30',
      message_key: 'notif_event',
      message_params: { club: 'Clube', title: 'Prova', starts_at: '2026-09-14T17:30:00Z' },
    };
    // O `starts_at` nunca aparece: é convertido em `date` antes de interpolar.
    expect(notificationText(n, tPt, 'pt')).not.toContain('2026-09-14');
    expect(notificationText(n, tPt, 'pt')).toContain('Clube: Prova ·');
  });

  it('aguenta parâmetros em falta sem estoirar', () => {
    const n = { message: 'x', message_key: 'notif_kudo', message_params: {} };
    expect(() => notificationText(n, tPt, 'pt')).not.toThrow();
  });
});

describe('formatarDataDoEvento', () => {
  it('devolve o valor original se a data não for válida', () => {
    // Antes rebentava com "Invalid Date" no meio da notificação.
    expect(formatarDataDoEvento('nao-e-uma-data', 'pt')).toBe('nao-e-uma-data');
  });

  it('não traz o ano — numa notificação de evento é ruído', () => {
    expect(formatarDataDoEvento('2026-09-14T17:30:00Z', 'pt')).not.toContain('2026');
  });
});
