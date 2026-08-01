import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * True enquanto o teclado está visível.
 *
 * Usado nas barras de escrita dos chats: com o teclado fechado a barra precisa
 * do padding da safe area (indicador de home), com o teclado aberto esse espaço
 * já vem incluído na altura do teclado — somar os dois afasta a barra do
 * teclado e empurra-a para fora do alcance.
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => setVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return visible;
}
