import { anuncioDeDistancia } from './voiceAnnouncement';
import i18n from '../lib/i18n';

/**
 * A voz anunciava sempre quilómetros, mesmo com o sistema imperial escolhido —
 * e o ritmo também vinha por quilómetro. Quem corre em milhas via uma coisa no
 * ecrã e ouvia outra ao ouvido, sem que nenhum dos dois números batesse certo.
 *
 * É a parte com contas e a única que se engana em silêncio: um anúncio errado
 * não deixa rasto nenhum.
 */
describe('anuncioDeDistancia', () => {
  beforeEach(() => i18n.changeLanguage('pt'));
  afterEach(() => i18n.changeLanguage('pt'));

  it('conta quilómetros no sistema métrico', () => {
    expect(anuncioDeDistancia(999, 300, 'metric', 0)).toBeNull();
    expect(anuncioDeDistancia(1000, 300, 'metric', 0)?.marco).toBe(1);
    expect(anuncioDeDistancia(5400, 300, 'metric', 4)?.marco).toBe(5);
  });

  it('conta milhas no sistema imperial', () => {
    // 1 milha = 1609 m. Aos 1600 m ainda não chegou lá.
    expect(anuncioDeDistancia(1600, 300, 'imperial', 0)).toBeNull();
    expect(anuncioDeDistancia(1610, 300, 'imperial', 0)?.marco).toBe(1);
    // 5000 m = 3,1 milhas
    expect(anuncioDeDistancia(5000, 300, 'imperial', 2)?.marco).toBe(3);
  });

  it('converte o ritmo para a unidade certa', () => {
    // 5'00"/km são 8'02"/milha — não os mesmos 5'00 de antes.
    expect(anuncioDeDistancia(1000, 300, 'metric', 0)?.texto).toContain("5'00");
    expect(anuncioDeDistancia(1610, 300, 'imperial', 0)?.texto).toContain("8'02");
  });

  it('diz a unidade certa em cada sistema, e no idioma em vigor', () => {
    expect(anuncioDeDistancia(2000, 300, 'metric', 1)?.texto).toContain('quilómetros');
    expect(anuncioDeDistancia(3300, 300, 'imperial', 1)?.texto).toContain('milhas');

    i18n.changeLanguage('en');
    expect(anuncioDeDistancia(2000, 300, 'metric', 1)?.texto).toContain('kilometres');
    expect(anuncioDeDistancia(3300, 300, 'imperial', 1)?.texto).toContain('miles');
  });

  it('usa o singular no primeiro', () => {
    expect(anuncioDeDistancia(1000, 300, 'metric', 0)?.texto).toContain('quilómetro.');
    expect(anuncioDeDistancia(1610, 300, 'imperial', 0)?.texto).toContain('milha.');
  });

  it('não repete um marco já anunciado', () => {
    expect(anuncioDeDistancia(5400, 300, 'metric', 5)).toBeNull();
  });

  it('cala-se se o marco recuar ao trocar de sistema a meio', () => {
    // 5 km já anunciados; em milhas isso são 3, e repetir 3 seria dizer à
    // pessoa números que ela já ouviu.
    expect(anuncioDeDistancia(5000, 300, 'imperial', 5)).toBeNull();
  });

  it('aguenta ficar sem ritmo', () => {
    expect(anuncioDeDistancia(1000, null, 'metric', 0)?.texto).toContain('--');
    expect(anuncioDeDistancia(1000, 0, 'metric', 0)?.texto).toContain('--');
  });
});
