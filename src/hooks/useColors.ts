import { useMemo, useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';
import { useSettingsStore } from '../store/settingsStore';
import { colors, lightColors } from '../lib/theme';

export function useColors() {
  const theme = useSettingsStore((s) => s.settings.theme);

  const colorScheme = useSyncExternalStore(
    (callback) => {
      const subscription = Appearance.addChangeListener(callback);
      return () => subscription.remove();
    },
    () => Appearance.getColorScheme(),
  );

  return useMemo(() => {
    const systemScheme: 'light' | 'dark' =
      colorScheme === 'light' ? 'light' : 'dark';
    const resolved: 'light' | 'dark' =
      theme === 'system' ? systemScheme : theme;
    return resolved === 'light' ? lightColors : colors;
  }, [theme, colorScheme]);
}
