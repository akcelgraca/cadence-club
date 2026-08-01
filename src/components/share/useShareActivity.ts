import { RefObject, useCallback, useState } from "react";
import { Alert, Linking, Platform, View } from "react-native";

// All native packages are imported dynamically so they don't crash at module
// load time when running in Expo Go (they require a dev build rebuild).

// Captura o ShareActivityCard como PNG TRANSPARENTE e oferece 3 saídas:
//  - Instagram Stories (sticker transparente, à Strava)
//  - Partilha genérica (share sheet do sistema → WhatsApp, X, etc.)
//  - Guardar na galeria
//
// Para os Stories: cria uma app em developers.facebook.com e substitui FB_APP_ID.
// Em app.json (iOS): "LSApplicationQueriesSchemes": ["instagram-stories"]

const FB_APP_ID = "TODO_META_APP_ID"; // substituir pelo teu Meta App ID

export function useShareActivity(cardRef: RefObject<View | null>) {
  const [busy, setBusy] = useState(false);

  const capture = useCallback(async () => {
    const _mod = await import("react-native-view-shot") as any;
    const captureRef: (ref: any, opts: object) => Promise<string> =
      _mod.captureRef ?? _mod.default?.captureRef ?? _mod.default;
    return captureRef(cardRef, {
      format: "png",
      quality: 1,
      result: "tmpfile",
      width: 1080,
      height: undefined,
    });
  }, [cardRef]);

  const shareToInstagramStories = useCallback(async () => {
    setBusy(true);
    try {
      const uri = await capture();
      if (Platform.OS === "ios") {
        const url = `instagram-stories://share?source_application=${FB_APP_ID}`;
        const can = await Linking.canOpenURL(url);
        if (!can) {
          Alert.alert("Instagram não instalado");
          return;
        }
        const { setStringAsync } = await import("expo-clipboard");
        const { readAsStringAsync, EncodingType } = await import("expo-file-system");
        const b64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
        await setStringAsync(
          JSON.stringify([{ "com.instagram.sharedSticker.stickerImage": b64 }]),
        );
        await Linking.openURL(url);
      } else {
        const _il = await import("expo-intent-launcher");
        const IntentLauncher = (_il as any).default ?? _il;
        await IntentLauncher.startActivityAsync("com.instagram.share.ADD_TO_STORY", {
          type: "image/png",
          extra: { source_application: FB_APP_ID, interactive_asset_uri: uri },
          flags: 1,
        });
      }
    } catch {
      Alert.alert("Não foi possível abrir o Instagram");
    } finally {
      setBusy(false);
    }
  }, [capture]);

  const shareGeneric = useCallback(async () => {
    setBusy(true);
    try {
      const uri = await capture();
      const _mod = await import("expo-sharing") as any;
      const isAvailableAsync: (() => Promise<boolean>) | undefined =
        _mod.isAvailableAsync ?? _mod.default?.isAvailableAsync;
      const shareAsync: ((uri: string, opts: object) => Promise<void>) | undefined =
        _mod.shareAsync ?? _mod.default?.shareAsync;
      if (isAvailableAsync && shareAsync && await isAvailableAsync()) {
        await shareAsync(uri, { mimeType: "image/png", dialogTitle: "Partilhar atividade" });
      }
    } catch (e: any) {
      Alert.alert("Erro", e?.message ?? "Não foi possível partilhar a imagem.");
    } finally {
      setBusy(false);
    }
  }, [capture]);

  const saveToGallery = useCallback(async () => {
    setBusy(true);
    try {
      // expo-media-library requires a native dev build.
      // If the native module is missing (Expo Go or outdated build),
      // the import itself throws — we catch it here.
      let _mod: any;
      try {
        _mod = await import("expo-media-library");
      } catch {
        Alert.alert(
          "Build necessária",
          "Para guardar na galeria executa: npx expo run:ios",
        );
        return false;
      }

      const requestPermissionsAsync: (() => Promise<{ status: string }>) | undefined =
        _mod.requestPermissionsAsync ?? _mod.default?.requestPermissionsAsync;
      const saveToLibraryAsync: ((uri: string) => Promise<void>) | undefined =
        _mod.saveToLibraryAsync ?? _mod.default?.saveToLibraryAsync;

      if (!requestPermissionsAsync || !saveToLibraryAsync) {
        Alert.alert(
          "Build necessária",
          "Para guardar na galeria executa: npx expo run:ios",
        );
        return false;
      }

      const { status } = await requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Sem permissão", "Permite o acesso à galeria nas definições do dispositivo.");
        return false;
      }
      const uri = await capture();
      await saveToLibraryAsync(uri);
      return true;
    } catch (e: any) {
      Alert.alert("Erro", e?.message ?? "Não foi possível guardar a imagem.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [capture]);

  return { busy, shareToInstagramStories, shareGeneric, saveToGallery };
}
