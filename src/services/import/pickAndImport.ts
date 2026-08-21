import { detectFormat, importTrackFile } from './importFile';
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
  // O FIT não tem tipo MIME registado. Os gestores de ficheiros classificam-no
  // quase sempre como `octet-stream`, que já estava na lista pelo mesmo motivo.
  'application/vnd.ant.fit',
  'application/xml',
  'text/xml',
  'application/octet-stream',
];

export async function pickAndImportTrackFile(): Promise<ImportOutcome | null> {
  const DocumentPicker = carregar(() => require('expo-document-picker'));
  const FS = carregar(() => require('expo-file-system'));

  if (!DocumentPicker || !FS?.File) {
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

  const nome: string = ficheiro.name ?? 'ficheiro';
  const ficheiroFS = new FS.File(ficheiro.uri);

  // `readAsStringAsync` foi removido no SDK 57 — não é só um aviso, lança em
  // tempo de execução. A API nova é a classe File.
  //
  // O FIT é binário e tem de ser lido como bytes: passá-lo por `text()`
  // corrompe-o em silêncio, porque os seus bytes não são UTF-8 válido, e o
  // resultado seria "ficheiro malformado" sem pista nenhuma da causa.
  const conteudo: string | Uint8Array =
    detectFormat(nome) === 'fit'
      ? new Uint8Array(await ficheiroFS.arrayBuffer())
      : await ficheiroFS.text();

  return importTrackFile(nome, conteudo);
}
