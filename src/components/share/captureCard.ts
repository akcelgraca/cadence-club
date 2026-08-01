import type { RefObject } from 'react';
import type { View } from 'react-native';

/**
 * Captura uma view como PNG transparente e devolve o caminho do ficheiro.
 *
 * react-native-view-shot é importado dinamicamente porque é um módulo nativo:
 * no Expo Go rebentaria logo no carregamento do módulo.
 */
export async function captureTransparentPng(
  ref: RefObject<View | null>,
  width = 1080,
): Promise<string | null> {
  try {
    const mod = (await import('react-native-view-shot')) as any;
    const captureRef: (ref: any, opts: object) => Promise<string> =
      mod.captureRef ?? mod.default?.captureRef ?? mod.default;

    return await captureRef(ref, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
      width,
    });
  } catch {
    // Sem o módulo nativo (Expo Go) a app continua a funcionar sem o cartão
    return null;
  }
}
