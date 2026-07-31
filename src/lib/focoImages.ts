// Static image map for goal and training focus icons.
// Images live in assets/images/foco_objetive/ — single variant (white/tintable).

const FOCO_IMAGES: Record<string, any> = {
  // ACTIVITY_GOALS
  lose_weight:         require('../../assets/images/foco_objetive/perda-de-peso.png'),
  gain_muscle:         require('../../assets/images/foco_objetive/forca.png'),
  improve_endurance:   require('../../assets/images/foco_objetive/resistencia.png'),
  train_for_race:      require('../../assets/images/foco_objetive/preparacao-prova.png'),
  improve_flexibility: require('../../assets/images/foco_objetive/flexibilidade.png'),
  improve_technique:   require('../../assets/images/foco_objetive/tecnica.png'),
  explore_outdoors:    require('../../assets/images/foco_objetive/ar-livre.png'),
  have_fun:            require('../../assets/images/foco_objetive/diversao.png'),

  // TRAINING_FOCUSES
  endurance:      require('../../assets/images/foco_objetive/resistencia.png'),
  speed:          require('../../assets/images/foco_objetive/velocidade.png'),
  weight_loss:    require('../../assets/images/foco_objetive/perda-de-peso.png'),
  general_health: require('../../assets/images/foco_objetive/saude-geral.png'),
  race_prep:      require('../../assets/images/foco_objetive/preparacao-prova.png'),
  strength:       require('../../assets/images/foco_objetive/forca.png'),
  flexibility:    require('../../assets/images/foco_objetive/flexibilidade.png'),
  technique:      require('../../assets/images/foco_objetive/tecnica.png'),
  outdoors:       require('../../assets/images/foco_objetive/ar-livre.png'),
  fun:            require('../../assets/images/foco_objetive/diversao.png'),
};

export function getFocoImage(key: string): any {
  return FOCO_IMAGES[key] ?? null;
}
