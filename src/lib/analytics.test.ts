import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const raiz = path.resolve(__dirname, '../..');

/**
 * Campos que nunca podem ir para os analytics.
 *
 * Isto é uma app de corrida: o traçado de GPS é a morada de quem treina, e o
 * título de uma atividade é texto livre onde cabe o que a pessoa quiser. Um
 * `capture` descuidado com um destes campos manda isso para fora de casa, e
 * não há como o trazer de volta.
 */
const PROIBIDOS = [
  'lat', 'lng', 'latitude', 'longitude', 'coords', 'coordinates',
  'route', 'points', 'address', 'morada',
  'email', 'password', 'token',
  'title', 'titulo', 'description', 'bio',
  'full_name', 'username', 'name',
];

describe('analytics', () => {
  const src = readFileSync(path.join(raiz, 'src/lib/analytics.ts'), 'utf8');

  it('não declara nenhuma propriedade com dados pessoais ou de localização', () => {
    // O EventMap é o contrato: se um campo destes lá aparecer, foi acrescentado
    // à pressa e vai começar a sair no próximo build.
    const eventMap = src.slice(src.indexOf('type EventMap'), src.indexOf('export function track'));

    const encontrados = PROIBIDOS.filter((campo) =>
      new RegExp(`^\\s*(/\\*\\*.*)?\\s*${campo}\\s*[?:]`, 'm').test(eventMap),
    );

    expect(encontrados).toEqual([]);
  });

  it('identifica pelo id, nunca pelo email', () => {
    const identify = src.slice(src.indexOf('export function identifyUser'));
    expect(identify).toContain('posthog.identify(userId)');
    expect(identify).not.toMatch(/identify\([^)]*email/i);
  });

  it('nenhum ecrã chama o posthog diretamente', () => {
    // Tudo passa por track()/identifyUser(), senão o contrato acima não vale
    // nada — bastava um capture solto num ecrã para o contornar.
    const ficheiros = execSync(
      'find src -name "*.ts" -o -name "*.tsx" | grep -v "analytics" | grep -v "\\.test\\."',
      { cwd: raiz, encoding: 'utf8' },
    ).trim().split('\n');

    const infratores = ficheiros.filter((f) => {
      const conteudo = readFileSync(path.join(raiz, f), 'utf8');
      return /\bposthog\.(capture|identify)\s*\(/.test(conteudo);
    });

    expect(infratores).toEqual([]);
  });
});
