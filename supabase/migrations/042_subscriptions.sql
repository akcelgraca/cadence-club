-- 042_subscriptions.sql
-- Direito de acesso premium.
--
-- Esta migração cria só a canalização: a tabela, a função que responde
-- "esta pessoa é premium?" e o registo de eventos das lojas. NÃO fecha
-- nada — nenhuma funcionalidade passa a ser paga por causa deste ficheiro.
-- O gating é uma migração à parte, aplicada no dia do lançamento.
--
-- Quem escreve aqui: só o webhook do RevenueCat, através de uma edge
-- function com a service role. O cliente lê o seu próprio estado e mais
-- nada — se o telemóvel pudesse escrever, o premium era de borla para
-- quem soubesse usar o anon key.
--
-- Uma pessoa pode ter mais do que uma linha ao longo do tempo (mudou de
-- loja, cancelou e voltou), por isso a chave é (user_id, store, product_id)
-- e a pergunta "é premium agora?" é sempre respondida pela função.

-- ── Estado da subscrição ─────────────────────────────────────────────────────

CREATE TYPE public.subscription_store AS ENUM ('app_store', 'play_store', 'stripe', 'promo');

CREATE TYPE public.subscription_status AS ENUM (
  'trialing',   -- período de experiência a decorrer
  'active',     -- a pagar
  'grace',      -- pagamento falhou, a loja ainda está a tentar cobrar
  'paused',     -- só o Google Play tem isto
  'expired',    -- acabou
  'refunded'    -- devolvido — o acesso cai de imediato
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  store               public.subscription_store  NOT NULL,
  status              public.subscription_status NOT NULL,
  -- Identificador do produto na loja (ex.: cadence_premium_annual).
  product_id          text NOT NULL,
  -- Direito concedido. Hoje só existe 'premium', mas separar isto da
  -- subscrição evita ter de migrar tudo quando houver um segundo nível.
  entitlement         text NOT NULL DEFAULT 'premium',

  -- Fim do período já pago. É isto que decide o acesso: enquanto estiver no
  -- futuro, a pessoa é premium — mesmo que já tenha cancelado a renovação.
  current_period_end  timestamptz,
  will_renew          boolean NOT NULL DEFAULT true,
  first_purchased_at  timestamptz,

  -- Referências para conseguir cruzar com o painel do RevenueCat/loja quando
  -- alguém escrever a perguntar porque perdeu o acesso.
  revenuecat_user_id  text,
  store_transaction_id text,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, store, product_id)
);

CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON public.subscriptions(user_id);
-- Suporta a pergunta "quem é premium agora?" sem varrer a tabela toda.
CREATE INDEX IF NOT EXISTS subscriptions_active_idx
  ON public.subscriptions(user_id, entitlement, current_period_end)
  WHERE status IN ('trialing', 'active', 'grace');

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Cada um vê o seu estado — para a app poder mostrar "renova a 3 de março".
CREATE POLICY "subscriptions_select_own" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- De propósito, não há políticas de INSERT/UPDATE/DELETE: com RLS ligada e
-- sem política, o cliente não escreve. A service role ignora a RLS, que é
-- como o webhook escreve.

-- ── A pergunta ───────────────────────────────────────────────────────────────

/**
 * Esta pessoa tem o direito de acesso neste momento?
 *
 * SECURITY DEFINER porque o gating tem de funcionar dentro de políticas de
 * RLS de outras tabelas, onde quem chama não pode ler subscriptions.
 *
 * 'grace' conta como premium: o pagamento falhou mas a loja ainda está a
 * tentar cobrar, e cortar o acesso a meio disso é castigar alguém por um
 * cartão que expirou. 'refunded' não conta, nem que a data ainda esteja no
 * futuro.
 */
CREATE OR REPLACE FUNCTION public.has_entitlement(
  p_user_id     uuid,
  p_entitlement text DEFAULT 'premium'
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.user_id     = p_user_id
      AND s.entitlement = p_entitlement
      AND s.status IN ('trialing', 'active', 'grace')
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  );
$$;

/** Atalho para quem está autenticado. */
CREATE OR REPLACE FUNCTION public.is_premium()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_entitlement(auth.uid(), 'premium');
$$;

GRANT EXECUTE ON FUNCTION public.has_entitlement(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_premium() TO authenticated;

-- ── O que a app lê ───────────────────────────────────────────────────────────

/**
 * Estado de subscrição para mostrar no ecrã de conta.
 * Devolve sempre uma linha, mesmo para quem nunca pagou.
 */
CREATE OR REPLACE FUNCTION public.get_my_subscription()
RETURNS TABLE (
  is_premium         boolean,
  status             public.subscription_status,
  store              public.subscription_store,
  product_id         text,
  current_period_end timestamptz,
  will_renew         boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_premium(),
    s.status,
    s.store,
    s.product_id,
    s.current_period_end,
    COALESCE(s.will_renew, false)
  FROM (SELECT auth.uid() AS uid) me
  LEFT JOIN public.subscriptions s
    ON s.user_id = me.uid
   AND s.entitlement = 'premium'
   AND s.status IN ('trialing', 'active', 'grace')
   AND (s.current_period_end IS NULL OR s.current_period_end > now())
  ORDER BY s.current_period_end DESC NULLS LAST
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_subscription() TO authenticated;

-- ── Registo dos eventos recebidos ────────────────────────────────────────────

/**
 * Tudo o que o webhook recebe fica aqui em bruto.
 *
 * Vais precisar disto no dia em que alguém disser "paguei e não tenho
 * acesso": sem o evento original não há forma de saber se o problema foi da
 * loja, do RevenueCat ou nosso. Também serve de proteção contra repetições —
 * as lojas reenviam o mesmo evento quando não recebem 200.
 */
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     text UNIQUE,          -- id do RevenueCat; evita processar duas vezes
  user_id      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type   text NOT NULL,
  payload      jsonb NOT NULL,
  received_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscription_events_user_idx
  ON public.subscription_events(user_id, received_at DESC);

ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
-- Sem políticas: só a service role toca nisto. Nem o próprio utilizador
-- precisa de ver os eventos em bruto.

-- ── updated_at ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.touch_subscriptions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subscriptions_touch_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_touch_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_subscriptions_updated_at();

COMMENT ON TABLE public.subscriptions IS
  'Direito de acesso premium. Escrita exclusiva do webhook (service role) — ver migração 042.';
COMMENT ON FUNCTION public.has_entitlement(uuid, text) IS
  'Fonte de verdade do gating. Usar dentro de políticas de RLS e RPCs, nunca confiar só no cliente.';
