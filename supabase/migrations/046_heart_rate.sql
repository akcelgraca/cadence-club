-- Migration 046: frequência cardíaca
--
-- Sem batimento não há zonas de treino, esforço relativo, nem calorias
-- fiáveis — as de hoje são estimadas por MET, que só olha para a modalidade
-- e o ritmo. Duas pessoas com o mesmo ritmo gastam energias diferentes; o
-- batimento é o que distingue.
--
-- Guarda-se o resumo (média e máximo), não a série temporal. A série exigia
-- uma tabela nova com milhares de linhas por atividade, e o que alimenta as
-- zonas, o esforço e as calorias é o resumo. Um gráfico de batimento ao longo
-- do treino fica para quando houver quem o peça.

ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS avg_heart_rate smallint
    CHECK (avg_heart_rate IS NULL OR avg_heart_rate BETWEEN 30 AND 240),
  ADD COLUMN IF NOT EXISTS max_heart_rate smallint
    CHECK (max_heart_rate IS NULL OR max_heart_rate BETWEEN 30 AND 240);

COMMENT ON COLUMN public.activities.avg_heart_rate IS
  'Batimento médio (bpm). Null quando a origem não o deu — a maioria das atividades gravadas no telemóvel.';
COMMENT ON COLUMN public.activities.max_heart_rate IS
  'Batimento máximo (bpm) durante a atividade.';

-- ── Máximo pessoal ───────────────────────────────────────────────────────────

/**
 * O máximo real de cada pessoa, quando o souber.
 *
 * Sem isto estima-se pela idade, o que é uma aproximação grosseira: o desvio
 * padrão da estimativa anda nos 10-12 bpm, o que chega para pôr alguém na
 * zona errada. Quem tiver feito um teste de esforço pode dizer o valor certo.
 */
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS max_heart_rate smallint
    CHECK (max_heart_rate IS NULL OR max_heart_rate BETWEEN 120 AND 240);

COMMENT ON COLUMN public.profiles.max_heart_rate IS
  'Máximo medido, indicado pelo utilizador. Null = estimar pela idade.';
