import { useColorScheme } from 'react-native';
import { resolveTheme, type Colors } from '../lib/theme';
import { useSettingsStore } from '../store/settingsStore';

/**
 * A paleta em vigor.
 *
 * Lê duas coisas: a preferência guardada (`claro` / `escuro` / `sistema`, já
 * existente no ecrã de definições) e, quando é `sistema`, o que o iOS ou o
 * Android dizem naquele momento — o `useColorScheme` re-renderiza sozinho
 * quando o telemóvel muda ao anoitecer.
 *
 * Para o `useColorScheme` dizer alguma coisa, o `app.json` tem de ter
 * `userInterfaceStyle: "automatic"`. Estava em `"light"`, o que forçava o
 * sistema a responder sempre "claro" — a preferência 'sistema' nunca teria
 * escurecido, e o motivo não seria óbvio a olhar para este ficheiro.
 */
export function useColors(): Colors {
  const sistema = useColorScheme();
  const preferencia = useSettingsStore((s) => s.settings.theme);
  return resolveTheme(preferencia, sistema);
}
