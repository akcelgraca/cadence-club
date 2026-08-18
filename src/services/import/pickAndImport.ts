import { importTrackFile } from './importFile';
import type { ImportOutcome } from './types';

/**
 * Abre o seletor de ficheiros e importa o que o utilizador escolher.
 *
 * Os módulos nativos são carregados com `require()` dentro de `try`, como no
 * módulo de saúde: assim o projeto compila e corre sem eles, e quem chama
 * recebe um erro tratado em vez de um crash no arranque.
 */

function carregar(loader: () => any): any | null {
  try {
    const mod = loader();
    return mod?.default ?? mod ?? null;
  } catch {
    return null;
  }
}

/**
 * Tipos MIME a oferecer no seletor.
 *
 * O iOS ignora tipos que não conheça e o Android é irregular com extensões
 * pouco comuns, por isso inclui-se `application/octet-stream` — sem isso, um
 * .gpx aparece a cinzento em muitos gestores de ficheiros do Android.
 */
const TIPOS = [
  'application/gpx+xml',
  'application/vnd.garmin.tcx+xml',
  'application/xml',
  'text/xml',
  'application/octet-stream',
];

export async function pickAndImportTrackFile(): Promise<ImportOutcome | null> {
  const DocumentPicker = carregar(() => require('expo-document-picker'));
  const FileSystem = carregar(() => require('expo-file-system'));

  if (!DocumentPicker || !FileSystem) {
    return { imported: 0, skipped: 0, error: 'seletor de ficheiros indisponível' };
  }

  const resultado = await DocumentPicker.getDocumentAsync({
    type: TIPOS,
    copyToCacheDirectory: true,
    multiple: false,
  });

  // O utilizador fechou o seletor. Null distingue isto de "importou zero",
  // para a interface não mostrar um resultado que ninguém pediu.
  if (resultado?.canceled) return null;

  const ficheiro = resultado?.assets?.[0];
  if (!ficheiro?.uri) return null;

  const conteudo = await FileSystem.readAsStringAsync(ficheiro.uri);
  return importTrackFile(ficheiro.name ?? 'ficheiro', conteudo);
}
