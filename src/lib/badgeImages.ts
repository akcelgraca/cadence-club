// Static image map for badge icons.
// Keys match the `icon` field stored in the badges table.

const BADGE_IMAGES: Record<string, any> = {
  'badge-primeira-atividade': require('../../assets/images/badges/badge-primeira-atividade.png'),
  'badge-5k':                 require('../../assets/images/badges/badge-5k.png'),
  'badge-10k':                require('../../assets/images/badges/badge-10k.png'),
  'badge-meia-maratona':      require('../../assets/images/badges/badge-meia-maratona.png'),
  'badge-streak-3':           require('../../assets/images/badges/badge-streak-3.png'),
  'badge-streak-7':           require('../../assets/images/badges/badge-streak-7.png'),
  'badge-streak-30':          require('../../assets/images/badges/badge-streak-30.png'),
  'badge-madrugador':         require('../../assets/images/badges/badge-madrugador.png'),
  'badge-coruja-noturna':     require('../../assets/images/badges/badge-coruja-noturna.png'),
  'badge-guerreiro-fds':      require('../../assets/images/badges/badge-guerreiro-fds.png'),
  'badge-escalador':          require('../../assets/images/badges/badge-escalador.png'),
  'badge-polivalente':        require('../../assets/images/badges/badge-polivalente.png'),
  'badge-popular':            require('../../assets/images/badges/badge-popular.png'),
};

export function getBadgeImage(icon: string): any {
  return BADGE_IMAGES[icon] ?? null;
}
