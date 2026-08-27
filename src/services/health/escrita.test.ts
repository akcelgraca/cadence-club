import { readFileSync } from 'node:fs';
import path from 'node:path';
import { tipoParaPlataforma } from './mapping';

const raiz = path.resolve(__dirname, '../../..');
const ler = (p: string) => readFileSync(path.join(raiz, p), 'utf8');

/**
 * Devolver treinos à Saúde.
 *
 * A app leu durante meses sem escrever, e quem grava aqui e usa o relógio para
 * o resto ficava com o histórico partido em dois. O risco de ligar a escrita é
 * o oposto: o que sai volta a entrar na leitura seguinte, e como essa corre a
 * cada sincronização, não seria uma cópia — seria um ciclo.
 */
describe('tipoParaPlataforma', () => {
  it('traduz para os números que cada plataforma espera', () => {
    expect(tipoParaPlataforma('run', 'healthkit')).toBe(37);
    expect(tipoParaPlataforma('run', 'healthconnect')).toBe(56);
    expect(tipoParaPlataforma('cycle', 'healthkit')).toBe(13);
    expect(tipoParaPlataforma('cycle', 'healthconnect')).toBe(8);
  });

  it('as variantes de interior e exterior escolhem exterior', () => {
    // A app grava por GPS. O 57 do Health Connect é RUNNING_TREADMILL.
    expect(tipoParaPlataforma('run', 'healthconnect')).toBe(56);
    expect(tipoParaPlataforma('trail_run', 'healthconnect')).toBe(56);
  });

  it('uma modalidade sem equivalente devolve null, e null significa não escrever', () => {
    // Forçar um tipo genérico poluía o histórico de saúde de alguém com
    // treinos mal classificados — e esse histórico não é nosso para estragar.
    expect(tipoParaPlataforma('crossfit', 'healthkit')).toBeNull();
    expect(tipoParaPlataforma('physiotherapy', 'healthkit')).toBeNull();
  });

  it('o que se escreve volta a ser lido como a mesma modalidade', () => {
    // Ida e volta pelo mapa de leitura: se `run` sai como 56 e o 56 voltasse
    // como outra coisa, uma corrida devolvida à Saúde regressava como caminhada.
    const { mapWorkoutType } = require('./mapping');
    for (const tipo of ['run', 'cycle', 'walk', 'swimming', 'yoga', 'rowing', 'tennis'] as const) {
      for (const destino of ['healthkit', 'healthconnect'] as const) {
        const numero = tipoParaPlataforma(tipo, destino);
        if (numero === null) continue;
        expect(mapWorkoutType(numero, destino)).toBe(tipo);
      }
    }
  });
});

describe('as defesas contra o ciclo', () => {
  const sync = ler('src/services/health/sync.ts');

  it('só se devolve o que foi gravado na app', () => {
    // Devolver à Saúde um treino que veio da Saúde escrevia uma cópia do que
    // já lá está, e a deduplicação teria de a apanhar por sobreposição — que é
    // a mais fraca das duas defesas.
    expect(sync).toMatch(/activity\.source !== 'app'/);
  });

  it('não se pede permissão no fim de uma corrida', () => {
    // Um diálogo do sistema em cima de quem acabou de correr leva quase sempre
    // "não", e essa recusa fica. Pede-se nas Definições, com contexto.
    const fn = sync.slice(sync.indexOf('export async function writeBackWorkout'));
    expect(fn).toMatch(/canWrite\(\)/);
    expect(fn).not.toMatch(/requestWritePermission/);
  });

  it('escrever nunca custa a atividade', () => {
    // É chamado depois de estar guardada, sem await e com catch.
    const ecra = ler('src/components/record/FinishedView.tsx');
    expect(ecra).toMatch(/void writeBackWorkout\([^)]*\)\.catch/);
    const fn = sync.slice(sync.indexOf('export async function writeBackWorkout'));
    expect(fn).toMatch(/catch \{\s*return false;/);
  });
});

describe('as permissões de escrita são pedidas à parte', () => {
  const adaptadores = ler('src/services/health/adapters.ts');

  it('a leitura continua a não pedir escrita', () => {
    // A app leu durante meses sem escrever; pedir escrita a quem só quer ler
    // seria pedir mais do que precisamos.
    expect(adaptadores).toMatch(/toShare: \[\]/);
  });

  it('há um pedido próprio para escrever, nas duas plataformas', () => {
    expect(adaptadores).toMatch(/toShare: \['HKWorkoutTypeIdentifier'\]/);
    expect(adaptadores).toMatch(/HEALTH_CONNECT_WRITE/);
    expect(adaptadores).toMatch(/accessType: 'write' as const, recordType: 'ExerciseSession'/);
  });

  it('no Android a distância vai num registo separado, como na leitura', () => {
    const fn = adaptadores.slice(adaptadores.indexOf('async writeWorkout(w: WorkoutToWrite) {', adaptadores.indexOf('healthConnectAdapter')));
    expect(fn).toMatch(/recordType: 'ExerciseSession'/);
    expect(fn).toMatch(/recordType: 'Distance'/);
    // Só quando existe: um registo de 0 m polui o histórico de quem faz ioga.
    expect(fn).toMatch(/if \(w\.distance > 0\)/);
  });
});
