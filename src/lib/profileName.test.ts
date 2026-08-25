import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const raiz = path.resolve(__dirname, '../..');
const ler = (p: string) => readFileSync(path.join(raiz, p), 'utf8');

/**
 * O `full_name` é derivado do nome e do apelido, e **nunca pedido**.
 *
 * Três ecrãs escrevem um perfil: o registo por email, o onboarding de quem
 * entra pela primeira vez com Google ou Apple, e a edição de perfil. Dois deles
 * já derivavam o nome completo; o onboarding pedia-o num campo próprio, logo a
 * seguir a pedir o nome e o apelido — a mesma informação duas vezes.
 *
 * O que se perde quando um ecrã foge à regra não é só o incómodo de escrever
 * duas vezes: fica um perfil onde o `full_name` pode não ter nada a ver com o
 * `first_name` e o `last_name`, e é o `full_name` que aparece no feed, na
 * pesquisa e nos clubes.
 */
const ECRAS = [
  'src/app/(auth)/register.tsx',
  'src/app/(auth)/onboarding.tsx',
  'src/app/profile/edit.tsx',
];

/**
 * ⚠️ Este ficheiro **não pode viver dentro de `src/app/`**.
 *
 * O expo-router faz `require.context` sobre essa pasta e trata tudo o que lá
 * está como rota — incluindo ficheiros de teste. Um teste que importe `node:fs`
 * passa no Jest e **parte a build**, com `Unable to resolve module node:fs`,
 * porque `node:fs` não existe no telemóvel. Aconteceu a 24 ago: os 418 testes
 * verdes e o `xcodebuild` a falhar na fase do Metro.
 *
 * Por isso os testes estruturais deste projeto vivem em `src/lib`,
 * `src/services` e `src/utils`, nunca em `src/app`. O teste abaixo garante-o.
 */
describe('testes fora do alcance do router', () => {
  it('nenhum ficheiro de teste vive dentro de src/app', () => {
    const dentro = execSync('find src/app -name "*.test.*" || true', {
      cwd: raiz,
      encoding: 'utf8',
    }).trim();
    expect(dentro).toBe('');
  });
});

describe('nome do perfil', () => {
  it.each(ECRAS)('%s não pede o nome completo num campo próprio', (ecra) => {
    const src = ler(ecra);
    // Um TextInput ligado a um estado de nome completo é o padrão a evitar.
    expect(src).not.toMatch(/value=\{fullName\}/);
    expect(src).not.toMatch(/useState.*\n?.*setFullName/);
    expect(src).not.toMatch(/\[fullName, setFullName\]/);
  });

  it('os ecrãs que criam perfil derivam o full_name de nome + apelido', () => {
    for (const ecra of ['src/app/(auth)/register.tsx', 'src/app/(auth)/onboarding.tsx']) {
      const src = ler(ecra);
      expect(src).toMatch(/full_name:/);
      // Ou monta a expressão na própria propriedade, ou numa variável logo
      // acima — as duas formas existem hoje e as duas são legítimas.
      const derivado = /\[firstName\.trim\(\),\s*lastName\.trim\(\)\]\.join\(' '\)/.test(src);
      expect(derivado).toBe(true);
    }
  });

  it('o onboarding exige nome e apelido, agora que o completo saiu', () => {
    // Sem isto ficava um perfil com `full_name` vazio — e é esse o nome que
    // aparece em todo o lado.
    const src = ler('src/app/(auth)/onboarding.tsx');
    const validacao = src.slice(src.indexOf('const handleFinish'), src.indexOf('setLoading(true)'));
    expect(validacao).toMatch(/!firstName\.trim\(\)/);
    expect(validacao).toMatch(/!lastName\.trim\(\)/);
    expect(validacao).not.toMatch(/fullName/);
  });
});
