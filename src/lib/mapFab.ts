/**
 * A que altura fica o botão de criar rota, no ecrã do mapa.
 *
 * Isto é uma função e não uma expressão à solta porque já se enganou uma vez, e
 * de maneira invisível: sem rotas, o botão descia para 30px do fundo — mesmo em
 * cima do cartão "Nenhuma rota por aqui", que ocupa esse espaço e é desenhado
 * **depois** no JSX. Em React Native, quem vem depois pinta por cima; o
 * `elevation` do botão salvava-o no Android, e no iOS não há elevation.
 *
 * O resultado era o botão de criar a primeira rota escondido atrás da mensagem
 * a dizer que não há rotas nenhumas — invisível precisamente para quem mais
 * precisava dele, e visível para quem já tinha rotas e menos falta lhe fazia.
 */

/** Altura do carrossel de rotas. */
export const CAROUSEL_HEIGHT = 156;

/**
 * O cartão de estado vazio: `bottom: 16` mais a altura dele.
 *
 * Uma folga generosa de propósito — o texto muda com o idioma e com o modo
 * (guardadas vs. por aqui), e uma linha a mais em alemão não pode voltar a
 * meter o botão por baixo.
 */
export const ESTADO_VAZIO_ALTURA = 108;

export function alturaDoBotaoDeCriar(opcoes: {
  aCriar: boolean;
  temRotas: boolean;
}): number {
  // A criar, o botão nem aparece; o valor não chega a ser usado.
  if (opcoes.aCriar) return 30;
  // Há sempre alguma coisa em baixo: o carrossel, ou o cartão de estado vazio.
  return opcoes.temRotas ? CAROUSEL_HEIGHT + 16 : ESTADO_VAZIO_ALTURA;
}
