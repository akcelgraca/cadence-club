import { readFileSync } from 'node:fs';
import path from 'node:path';

const raiz = path.resolve(__dirname, '../..');
const ler = (p: string) => readFileSync(path.join(raiz, p), 'utf8');

/**
 * O quadro de tempos dos troços.
 *
 * A função é `SECURITY DEFINER`, e é isso que torna estes testes necessários:
 * **dentro dela as RLS não se aplicam**. A política `segment_efforts_select` da
 * 039 diz que os tempos de outra pessoa só se veem se a atividade for pública,
 * mas essa política não protege o que corre com privilégios. Esquecer o filtro
 * aqui expunha tempos de treinos privados a toda a gente, sem erro nenhum e sem
 * ninguém dar por isso.
 */
describe('quadro de tempos — a migração 052', () => {
  const sql = ler('supabase/migrations/052_segment_leaderboard.sql');

  it('só conta atividades públicas', () => {
    expect(sql).toMatch(/JOIN public\.activities a ON a\.id = e\.activity_id/);
    expect(sql).toMatch(/a\.is_public = true/);
  });

  it('corre com privilégios e com o search_path fixo', () => {
    // Sem `SET search_path`, uma tabela `activities` noutro esquema podia ser
    // resolvida primeiro — e a função corre como dono.
    expect(sql).toMatch(/SECURITY DEFINER/);
    expect(sql).toMatch(/SET search_path = public/);
  });

  it('um tempo por pessoa, o melhor', () => {
    // Sem isto, quem repete o troço todas as semanas enchia o quadro sozinho.
    expect(sql).toMatch(/DISTINCT ON \(e\.user_id\)/);
    expect(sql).toMatch(/ORDER BY e\.user_id, e\.duration ASC/);
  });

  it('tempos iguais partilham o lugar', () => {
    // `row_number()` dava a um deles um lugar que não ganhou.
    expect(sql).toMatch(/rank\(\) OVER \(ORDER BY m\.duration ASC\)/);
    expect(sql).not.toMatch(/row_number\(\) OVER/);
  });

  it('quem chama vem sempre, mesmo fora dos primeiros', () => {
    // "O 47.º de 300" é informação; uma lista onde não te encontras não é.
    expect(sql).toMatch(/o\.pos <= p_limit OR o\.user_id = auth\.uid\(\)/);
  });

  it('não é executável por quem não tem sessão', () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.get_segment_leaderboard[^;]*FROM PUBLIC, anon/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.get_segment_leaderboard[^;]*TO authenticated/);
  });
});

describe('quadro de tempos — o ecrã', () => {
  const ecra = ler('src/app/segment/[id].tsx');

  it('diz a quem tem tempos privados porque não aparece', () => {
    // Sem isto ficava a olhar para uma lista sem ele e sem explicação — e a
    // conclusão natural seria que a app não lhe registou as passagens.
    expect(ecra).toMatch(/segment_leaderboard_private/);
    expect(ecra).toMatch(/!leaderboard\.some\(\(l\) => l\.is_me\)/);
  });

  it('marca a própria linha', () => {
    expect(ecra).toMatch(/linha\.is_me/);
  });

  it('o comentário do topo já não diz que não há classificação', () => {
    // Dizia "deliberadamente sem classificação". Um comentário que mente sobre
    // o ficheiro é pior do que nenhum.
    const topo = ecra.slice(0, ecra.indexOf('export default'));
    expect(topo).not.toMatch(/Deliberadamente sem classificação/);
    expect(topo).toMatch(/quadro de tempos/i);
  });
});
