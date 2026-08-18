-- ============================================================
-- 003_seed_badges.sql
-- Badge catalog
-- ============================================================

INSERT INTO public.badges (id, name, description, icon, category, tier, conditions) VALUES
-- Activity badges
('first_activity', 'Primeira Atividade', 'Completaste a tua primeira atividade!', '🎉', 'activity', 'bronze', '{"condition": "activities_count >= 1"}'),

-- Streak badges
('streak_3', '3 Dias Seguidos', 'Mantiveste-te ativo durante 3 dias consecutivos.', '🔥', 'activity', 'bronze', '{"condition": "current_streak >= 3"}'),
('streak_7', '7 Dias Seguidos', 'Uma semana inteira de consistencia!', '🔥', 'activity', 'silver', '{"condition": "current_streak >= 7"}'),
('streak_30', '30 Dias Seguidos', 'Um mes de dedicacao total!', '💪', 'activity', 'gold', '{"condition": "current_streak >= 30"}'),

-- Distance badges
('distance_5k', '5K', 'Completaste uma atividade de 5 km.', '🏃', 'distance', 'bronze', '{"condition": "activity.distance >= 5000"}'),
('distance_10k', '10K', 'Completaste uma atividade de 10 km.', '🏃', 'distance', 'silver', '{"condition": "activity.distance >= 10000"}'),
('distance_21k', 'Meia Maratona', 'Completaste uma meia maratona!', '🏅', 'distance', 'gold', '{"condition": "activity.distance >= 21098"}'),

-- Elevation badges
('climb_100m', 'Escalador', 'Subiste 100 metros de elevacao numa atividade.', '⛰️', 'activity', 'silver', '{"condition": "activity.elevation_gain >= 100"}'),

-- Social badges
('social_5_kudos', 'Popular', 'Recebeste 5 kudos numa atividade.', '⭐', 'social', 'bronze', '{"condition": "kudo_count >= 5"}'),

-- Special badges (time-based)
('early_bird', 'Madrugador', 'Completaste uma atividade antes das 7h.', '🌅', 'special', 'bronze', '{"condition": "hour < 7"}'),
('night_owl', 'Coruja Noturna', 'Completaste uma atividade depois das 22h.', '🦉', 'special', 'bronze', '{"condition": "hour >= 22"}'),
('weekend_warrior', 'Guerreiro de Fim de Semana', 'Completaste uma atividade ao fim de semana.', '🎯', 'special', 'bronze', '{"condition": "dow IN (0,6)"}'),

-- Multi-sport badge
('multi_sport', 'Polivalente', 'Praticaste 3 tipos diferentes de atividade.', '🔄', 'multi_sport', 'silver', '{"condition": "distinct_types >= 3"}')
ON CONFLICT (id) DO NOTHING;
