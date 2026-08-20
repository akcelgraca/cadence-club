import type { UnitSystem } from '../lib/types';
import i18n from '../lib/i18n';
import { MI_PER_KM } from './convertUnits';

/**
 * O que a voz diz ao fim de cada unidade completa, e em que unidade.
 *
 * Existia dentro do `useLocationTracker` e contava sempre quilómetros: quem
 * escolhesse o sistema imperial nas Definições via milhas no ecrã e ouvia
 * quilómetros ao ouvido, com um ritmo que também era por quilómetro. Os dois
 * números não batiam certo com nada do que estava à frente da pessoa.
 *
 * Função pura para poder ser testada: é a parte com contas e a única que se
 * engana em silêncio — um anúncio errado não deixa rasto nenhum.
 */
export interface Anuncio {
  /** A unidade completa que motivou o anúncio (3 = terceiro km, ou milha). */
  marco: number;
  texto: string;
}

export function anuncioDeDistancia(
  metrosTotais: number,
  segundosPorKm: number | null,
  unitSystem: UnitSystem,
  ultimoMarco: number,
): Anuncio | null {
  const imperial = unitSystem === 'imperial';

  const percorrido = imperial
    ? (metrosTotais / 1000) * MI_PER_KM
    : metrosTotais / 1000;

  const marco = Math.floor(percorrido);
  // Trocar de sistema a meio de um treino pode fazer o marco recuar (5 km são
  // 3 milhas). Nesse caso cala-se até voltar a passar à frente, que é melhor
  // do que repetir números que a pessoa já ouviu.
  if (marco < 1 || marco <= ultimoMarco) return null;

  const segundosPorUnidade =
    segundosPorKm && segundosPorKm > 0
      ? imperial ? segundosPorKm / MI_PER_KM : segundosPorKm
      : null;

  const ritmo = segundosPorUnidade
    ? `${Math.floor(segundosPorUnidade / 60)}'${Math.floor(segundosPorUnidade % 60)
        .toString()
        .padStart(2, '0')}`
    : '--';

  const chave = `voice_${imperial ? 'mi' : 'km'}_${marco > 1 ? 'plural' : 'singular'}`;
  return { marco, texto: i18n.t(chave as any, { n: marco, pace: ritmo }) };
}
