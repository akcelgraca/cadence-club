/**
 * Setup partilhado por todos os testes.
 *
 * Os testes cobrem lógica pura (utils) e serviços. Nenhum deles deve chegar à
 * rede, ao disco ou ao Supabase real — o que não está mockado aqui está
 * mockado no próprio ficheiro de teste.
 */

// AsyncStorage: mock oficial do pacote, com implementação em memória.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Nenhum teste deve fazer um pedido real. Cada teste que precise de fetch
// define o seu próprio comportamento com (globalThis.fetch as jest.Mock).
globalThis.fetch = jest.fn(() =>
  Promise.reject(new Error('fetch não mockado neste teste')),
) as unknown as typeof fetch;

beforeEach(() => {
  jest.clearAllMocks();
});
