import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const raiz = path.resolve(__dirname, '../..');

/**
 * Nenhum ecrã pode chamar `router.back()` cru.
 *
 * O caso que motivou isto: com o paywall aberto, um reload do Metro reconstrói
 * a pilha a partir do URL e o `/premium` fica a ser o único ecrã. O botão de
 * fechar chamava `router.back()`, ninguém tratava o GO_BACK, e não havia forma
 * de sair. Em desenvolvimento vê-se um aviso; em produção o botão apenas não
 * faz nada — que é bem pior, porque ninguém percebe porquê.
 *
 * Não é um caso de laboratório: qualquer ecrã aberto por notificação ou deep
 * link começa a vida sem nada por baixo.
 *
 * O `CustomHeader` é a exceção legítima e usa `navigation.goBack()`: a seta só
 * é desenhada quando o React Navigation diz que há para onde voltar (`back`).
 */
describe('navegação para trás', () => {
  it('nenhum ecrã chama router.back() em vez de goBackOr()', () => {
    const ficheiros = execSync('find src/app -name "*.tsx" -o -name "*.ts"', {
      cwd: raiz,
      encoding: 'utf8',
    })
      .trim()
      .split('\n');

    const infratores = ficheiros.filter((f) =>
      /\brouter\.back\s*\(/.test(readFileSync(path.join(raiz, f), 'utf8')),
    );

    expect(infratores).toEqual([]);
  });

  it('o goBackOr só substitui o ecrã quando não há para onde voltar', () => {
    // A ordem importa: substituir sempre partia a pilha de quem lá chegou a
    // navegar, e voltar sempre é o bug que se está a corrigir.
    const src = readFileSync(path.join(raiz, 'src/lib/navigation.ts'), 'utf8');
    expect(src).toMatch(/if \(router\.canGoBack\(\)\)[\s\S]*router\.back\(\)/);
    expect(src).toMatch(/router\.replace\(fallback\)/);
  });
});
