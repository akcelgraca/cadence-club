import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import pt from './pt';
import en from './en';

/**
 * Idioma inicial: o do telemóvel, com português como recurso.
 *
 * A preferência guardada em settings.language sobrepõe-se a isto assim que a
 * app arranca — ver useAppTranslation.
 */
const deviceLocale = getLocales()[0]?.languageCode ?? 'pt';

i18n.use(initReactI18next).init({
  resources: { pt: { translation: pt }, en: { translation: en } },
  lng: deviceLocale.startsWith('pt') ? 'pt' : 'en',
  fallbackLng: 'pt',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

export default i18n;
