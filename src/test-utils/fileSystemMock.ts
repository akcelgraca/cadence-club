/**
 * Sistema de ficheiros em memória a fazer de expo-file-system.
 *
 * Cobre só o que a fila de sincronização usa: criar a pasta permanente, copiar
 * um ficheiro da cache para lá, verificar existência e apagar. Como o real,
 * copiar uma origem inexistente atira — é assim que se testa o caso da foto
 * que a cache já deitou fora.
 */

/** URIs que "existem" agora. Semeia com `seedFile`, inspeciona com `listFiles`. */
const existentes = new Set<string>();

export class Directory {
  uri: string;

  constructor(parent: Directory | string, name?: string) {
    const base = typeof parent === 'string' ? parent : parent.uri;
    this.uri = name ? `${base.replace(/\/$/, '')}/${name}` : base;
  }

  get exists(): boolean {
    return existentes.has(this.uri);
  }

  create(_options?: { intermediates?: boolean }): void {
    existentes.add(this.uri);
  }

  delete(): void {
    existentes.delete(this.uri);
  }
}

export class File {
  uri: string;

  constructor(parent: Directory | string, name?: string) {
    const base = typeof parent === 'string' ? parent : parent.uri;
    this.uri = name ? `${base.replace(/\/$/, '')}/${name}` : base;
  }

  get exists(): boolean {
    return existentes.has(this.uri);
  }

  copy(target: File | Directory): void {
    if (!existentes.has(this.uri)) {
      throw new Error(`ficheiro inexistente: ${this.uri}`);
    }
    existentes.add(target.uri);
  }

  delete(): void {
    if (!existentes.has(this.uri)) {
      throw new Error(`ficheiro inexistente: ${this.uri}`);
    }
    existentes.delete(this.uri);
  }
}

export const Paths = {
  document: new Directory('file:///documents'),
  cache: new Directory('file:///cache'),
};

// --- Controlo a partir dos testes ---

export function seedFile(uri: string): string {
  existentes.add(uri);
  return uri;
}

export function fileExists(uri: string): boolean {
  return existentes.has(uri);
}

export function listFiles(): string[] {
  return [...existentes].sort();
}

export function resetFileSystem(): void {
  existentes.clear();
}
