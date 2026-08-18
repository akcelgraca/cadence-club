-- 041 — training_plans.label passa a guardar a chave de tradução
--
-- A coluna guardava o texto português da sessão ("Corrida leve", "Bike longa").
-- Isso tornava o plano intraduzível: o texto era escrito na base de dados no
-- momento em que o plano era gerado, e ficava em português para sempre —
-- mesmo para quem usa a app em inglês.
--
-- Passa a guardar a chave (plan_run_light, plan_bike_long, ...), que a app
-- resolve no momento de mostrar. Esta migração converte as linhas existentes.
--
-- Nota: linhas que não correspondam a nenhum texto conhecido ficam como estão.
-- A app usa o i18next, que devolve a própria chave quando não a encontra, por
-- isso um label não convertido continua a aparecer como está — em português,
-- como antes. Não há regressão para quem escapar ao mapeamento.

UPDATE training_plans
SET label = CASE label
  -- Descanso
  WHEN 'Descanso'            THEN 'training_rest_day'

  -- Caminhada
  WHEN 'Caminhada'           THEN 'activity_walk'
  WHEN 'Caminhada leve'      THEN 'plan_walk_light'
  WHEN 'Caminhada rápida'    THEN 'plan_walk_brisk'
  WHEN 'Caminhada longa'     THEN 'plan_walk_long'

  -- Corrida
  WHEN 'Corrida'             THEN 'activity_run'
  WHEN 'Corrida leve'        THEN 'plan_run_light'
  WHEN 'Corrida moderada'    THEN 'plan_run_moderate'
  WHEN 'Corrida longa'       THEN 'plan_run_long'
  WHEN 'Corrida ritmo'       THEN 'plan_run_tempo'
  WHEN 'Corrida social'      THEN 'plan_run_social'
  WHEN 'Corrida em Trilho'   THEN 'activity_trail_run'
  WHEN 'Intervalos'          THEN 'plan_intervals'
  WHEN 'Fácil'               THEN 'plan_easy'
  WHEN 'Ritmo'               THEN 'plan_tempo'
  WHEN 'Longo'               THEN 'plan_long'
  WHEN 'Trilho'              THEN 'plan_trail'

  -- Bicicleta
  WHEN 'Bicicleta'           THEN 'activity_cycle'
  WHEN 'Bicicleta elétrica'  THEN 'activity_ebike'
  WHEN 'Bicicleta de montanha' THEN 'activity_mtb'
  WHEN 'Bike leve'           THEN 'plan_bike_light'
  WHEN 'Bike moderada'       THEN 'plan_bike_moderate'
  WHEN 'Bike ritmo'          THEN 'plan_bike_tempo'
  WHEN 'Bike longa'          THEN 'plan_bike_long'
  WHEN 'Bike recuperação'    THEN 'plan_bike_recovery'
  WHEN 'Passeio bike'        THEN 'plan_bike_ride'
  WHEN 'BTT'                 THEN 'plan_mtb'

  -- Força
  WHEN 'Treino com peso'     THEN 'activity_weight_training'
  WHEN 'Treino'              THEN 'activity_workout'
  WHEN 'Treino grupo'        THEN 'plan_group_training'
  WHEN 'Peso corpo inteiro'  THEN 'plan_weights_full'
  WHEN 'Peso superior'       THEN 'plan_weights_upper'
  WHEN 'Peso inferior'       THEN 'plan_weights_lower'
  WHEN 'HIIT'                THEN 'activity_hiit'
  WHEN 'Crossfit'            THEN 'activity_crossfit'
  WHEN 'Fisioterapia'        THEN 'activity_physiotherapy'

  -- Água
  WHEN 'Natação'             THEN 'activity_swimming'
  WHEN 'Natação técnica'     THEN 'plan_swim_technique'
  WHEN 'Caiaque'             THEN 'activity_kayak'
  WHEN 'Remo'                THEN 'activity_rowing'
  WHEN 'Remo em pé'          THEN 'activity_stand_up_paddle'
  WHEN 'Surf'                THEN 'activity_surf'
  WHEN 'Canoagem'            THEN 'activity_canoeing'
  WHEN 'Vela'                THEN 'activity_sailing'

  -- Raquete
  WHEN 'Ténis'               THEN 'activity_tennis'
  WHEN 'Ténis de Mesa'       THEN 'activity_table_tennis'
  WHEN 'Padel'               THEN 'activity_padel'
  WHEN 'Squash'              THEN 'activity_squash'
  WHEN 'Badminton'           THEN 'activity_badminton'

  -- Coletivos e outros
  WHEN 'Futebol'             THEN 'activity_football'
  WHEN 'Basquetebol'         THEN 'activity_basketball'
  WHEN 'Voleibol'            THEN 'activity_volleyball'
  WHEN 'Futsal'              THEN 'activity_futsal'
  WHEN 'Ioga'                THEN 'activity_yoga'
  WHEN 'Ioga suave'          THEN 'plan_yoga_gentle'
  WHEN 'Pilates'             THEN 'activity_pilates'
  WHEN 'Dança'               THEN 'activity_dance'
  WHEN 'Skate'               THEN 'activity_skateboard'
  WHEN 'Passeio'             THEN 'activity_stroll'
  WHEN 'Cadeira de rodas'    THEN 'activity_wheelchair'
  WHEN 'Patinagem no gelo'   THEN 'activity_ice_skating'
  WHEN 'Snowboard'           THEN 'activity_snowboard'
  WHEN 'Esqui Alpino'        THEN 'activity_alpine_skiing'

  ELSE label
END
WHERE label IS NOT NULL;

COMMENT ON COLUMN training_plans.label IS
  'Chave de tradução da sessão (ex.: plan_run_light). Resolvida na app — nunca guardar texto visível aqui.';
