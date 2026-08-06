import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../store/settingsStore';

/**
 * Texto traduzido, com o idioma escolhido nas Definições a mandar sobre o do
 * telemóvel. O i18next é global, por isso basta um componente montado com este
 * hook para todo o `useTranslation` da app acompanhar a mudança.
 */
export function useAppTranslation() {
  const language = useSettingsStore((s) => s.settings.language);
  const { t, i18n } = useTranslation();

  useEffect(() => {
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language, i18n]);

  return { t, language: i18n.language };
}
