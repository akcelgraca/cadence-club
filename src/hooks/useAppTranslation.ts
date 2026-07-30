import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../store/settingsStore';

export function useAppTranslation() {
  const language = useSettingsStore((s) => s.settings.language);
  const { t, i18n } = useTranslation();

  useEffect(() => {
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language, i18n]);

  return { t };
}
