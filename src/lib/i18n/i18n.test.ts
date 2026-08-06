import i18n from './index';
import pt from './pt';
import en from './en';

describe('idioma da app', () => {
  it('recorre ao português quando falta uma tradução', () => {
    // O i18next normaliza fallbackLng para lista.
    expect(i18n.options.fallbackLng).toEqual(['pt']);
  });

  it('arranca num idioma que existe', () => {
    expect(['pt', 'en']).toContain(i18n.language);
  });

  it('devolve o texto certo em cada idioma', async () => {
    await i18n.changeLanguage('pt');
    expect(i18n.t('edit_profile_title')).toBe(pt.edit_profile_title);

    await i18n.changeLanguage('en');
    expect(i18n.t('edit_profile_title')).toBe(en.edit_profile_title);

    await i18n.changeLanguage('pt');
  });

  it('interpola valores', () => {
    expect(i18n.t('saved_remove_confirm', { title: 'Corrida matinal' }))
      .toContain('Corrida matinal');
  });
});

describe('dicionários', () => {
  const chavesPt = Object.keys(pt);
  const chavesEn = Object.keys(en);

  it('têm exatamente as mesmas chaves', () => {
    // Apanha quem acrescenta a um dicionário e se esquece do outro.
    expect(chavesPt.filter((k) => !(k in en))).toEqual([]);
    expect(chavesEn.filter((k) => !(k in pt))).toEqual([]);
  });

  it('não têm traduções vazias', () => {
    expect(chavesPt.filter((k) => !(pt as Record<string, string>)[k].trim())).toEqual([]);
    expect(chavesEn.filter((k) => !(en as Record<string, string>)[k].trim())).toEqual([]);
  });

  it('usam os mesmos marcadores de interpolação nos dois idiomas', () => {
    // "Eliminar {{name}}?" traduzido para "Delete {{nome}}?" saía sem o valor.
    const marcadores = (s: string) => (s.match(/\{\{(\w+)\}\}/g) ?? []).sort();
    const divergentes = chavesPt.filter((k) => {
      const a = marcadores((pt as Record<string, string>)[k]);
      const b = marcadores((en as Record<string, string>)[k]);
      return a.join() !== b.join();
    });
    expect(divergentes).toEqual([]);
  });
});
