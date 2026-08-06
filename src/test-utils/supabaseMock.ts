/**
 * Duplo do cliente Supabase para testes de serviços.
 *
 * O cliente real é um construtor de queries encadeável que só dispara quando
 * se faz `await`. Aqui cada método encadeável devolve o próprio construtor e
 * fica registado num `jest.fn()`, o que permite tanto controlar a resposta
 * como afirmar que o filtro certo foi aplicado (`query.eq` foi chamado com…).
 */

export interface SupabaseResult<T = any> {
  data?: T | null;
  error?: any;
}

/** Métodos do construtor de queries usados pelos serviços da app. */
const CHAINABLE = [
  'select', 'insert', 'update', 'upsert', 'delete',
  'eq', 'neq', 'in', 'not', 'is', 'gt', 'gte', 'lt', 'lte',
  'or', 'like', 'ilike', 'contains', 'overlaps',
  'order', 'range', 'limit', 'single', 'maybeSingle',
] as const;

export type MockQuery = {
  [K in (typeof CHAINABLE)[number]]: jest.Mock;
} & PromiseLike<SupabaseResult>;

/**
 * Constrói uma query que resolve sempre para `result`.
 * `{ data: null, error: null }` é o predefinido, como no cliente real.
 */
export function makeQuery<T = any>(result: SupabaseResult<T> = {}): MockQuery {
  const resolved: SupabaseResult<T> = { data: null, error: null, ...result };
  const query = {} as any;

  for (const method of CHAINABLE) {
    query[method] = jest.fn(() => query);
  }

  query.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(resolved).then(onFulfilled, onRejected);

  return query as MockQuery;
}

export interface SupabaseMock {
  from: jest.Mock;
  rpc: jest.Mock;
  auth: { getUser: jest.Mock };
  storage: { from: jest.Mock };
  /** Faz `from(<tabela>)` devolver esta query. */
  setTable: (table: string, result: SupabaseResult) => MockQuery;
  /** Faz `rpc(<nome>)` resolver para este resultado. */
  setRpc: (fn: string, result: SupabaseResult) => void;
  /** Query devolvida na última chamada a `from(<tabela>)`. */
  queryFor: (table: string) => MockQuery;
  /** Simula um utilizador autenticado (ou ninguém, com `null`). */
  setUser: (userId: string | null) => void;
}

export function createSupabaseMock(): SupabaseMock {
  const tables = new Map<string, MockQuery>();
  const rpcs = new Map<string, SupabaseResult>();

  const storageBucket = {
    upload: jest.fn(async () => ({ data: { path: 'p' }, error: null })),
    getPublicUrl: jest.fn((path: string) => ({
      data: { publicUrl: `https://cdn.test/${path}` },
    })),
    remove: jest.fn(async () => ({ data: null, error: null })),
  };

  const mock: SupabaseMock = {
    from: jest.fn((table: string) => {
      if (!tables.has(table)) tables.set(table, makeQuery());
      return tables.get(table)!;
    }),

    rpc: jest.fn((fn: string) => makeQuery(rpcs.get(fn) ?? {})),

    auth: {
      getUser: jest.fn(async () => ({
        data: { user: { id: 'user-1' } },
        error: null,
      })),
    },

    storage: { from: jest.fn(() => storageBucket) },

    setTable: (table, result) => {
      const query = makeQuery(result);
      tables.set(table, query);
      return query;
    },

    setRpc: (fn, result) => {
      rpcs.set(fn, result);
    },

    queryFor: (table) => {
      const query = tables.get(table);
      if (!query) throw new Error(`from('${table}') não foi chamado`);
      return query;
    },

    setUser: (userId) => {
      mock.auth.getUser.mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: null,
      });
    },
  };

  return mock;
}
