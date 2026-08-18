import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Webhook do RevenueCat.
 *
 * É a ÚNICA coisa que escreve em `subscriptions`. A app nunca escreve o seu
 * próprio estado de subscrição — se escrevesse, bastava um cliente modificado
 * para se dar premium a si próprio. O cliente compra, o RevenueCat valida o
 * recibo com a Apple ou a Google, e avisa aqui.
 *
 * Configurar em: RevenueCat → Project → Integrations → Webhooks
 *   URL:          https://<projeto>.supabase.co/functions/v1/revenuecat-webhook
 *   Authorization: o mesmo valor que puseres em REVENUECAT_WEBHOOK_SECRET
 *
 * Variáveis de ambiente:
 *   REVENUECAT_WEBHOOK_SECRET   segredo partilhado, à escolha
 *   SUPABASE_URL                automática
 *   SUPABASE_SERVICE_ROLE_KEY   automática
 */

/** Loja de origem, tal como o RevenueCat a identifica. */
const LOJAS: Record<string, string> = {
  APP_STORE: "app_store",
  MAC_APP_STORE: "app_store",
  PLAY_STORE: "play_store",
  STRIPE: "stripe",
  PROMOTIONAL: "promo",
};

/**
 * Tipo de evento → estado da subscrição.
 *
 * O que NÃO está aqui é ignorado de propósito: TEST, TRANSFER e
 * SUBSCRIBER_ALIAS não mudam direitos de acesso.
 */
const ESTADOS: Record<string, string> = {
  INITIAL_PURCHASE: "active",
  RENEWAL: "active",
  UNCANCELLATION: "active",
  NON_RENEWING_PURCHASE: "active",
  PRODUCT_CHANGE: "active",
  SUBSCRIPTION_EXTENDED: "active",
  // Cancelar não tira o acesso: o utilizador pagou até ao fim do período. O
  // que muda é que não renova — e é `current_period_end` que manda.
  CANCELLATION: "canceled",
  EXPIRATION: "expired",
  BILLING_ISSUE: "grace",
  SUBSCRIPTION_PAUSED: "paused",
};

interface RevenueCatEvent {
  id?: string;
  type: string;
  app_user_id: string;
  original_app_user_id?: string;
  product_id?: string;
  entitlement_ids?: string[] | null;
  store?: string;
  expiration_at_ms?: number | null;
  purchased_at_ms?: number | null;
  period_type?: string;
  environment?: string;
}

/**
 * O app_user_id é definido pela app como sendo o id do utilizador no Supabase
 * (ver services/purchases). Quando não é um uuid, é um id anónimo do
 * RevenueCat — de alguém que comprou sem sessão iniciada — e não há conta a
 * que ligar o direito.
 */
function uuidValido(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function resposta(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return resposta(405, { error: "method not allowed" });

  const segredo = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
  // Sem segredo configurado recusa-se tudo. Aceitar seria deixar qualquer um
  // conceder premium a qualquer conta.
  if (!segredo) return resposta(500, { error: "webhook secret not configured" });
  if (req.headers.get("Authorization") !== segredo) {
    return resposta(401, { error: "unauthorized" });
  }

  let corpo: { event?: RevenueCatEvent };
  try {
    corpo = await req.json();
  } catch {
    return resposta(400, { error: "invalid json" });
  }

  const evento = corpo?.event;
  if (!evento?.type || !evento?.app_user_id) {
    return resposta(400, { error: "missing event fields" });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Guardar SEMPRE o evento em bruto, mesmo os que não mudam nada. Quando um
  // utilizador se queixar de que pagou e não tem acesso, é isto que responde.
  //
  // `event_id` é UNIQUE: se o RevenueCat repetir a entrega (e repete, sempre
  // que respondemos com erro), a segunda inserção falha e é ignorada. É a
  // defesa contra processar a mesma compra duas vezes.
  const { error: erroEvento } = await supabase
    .from("subscription_events")
    .insert({
      event_id: evento.id ?? null,
      user_id: uuidValido(evento.app_user_id) ? evento.app_user_id : null,
      event_type: evento.type,
      payload: evento,
    });

  if (erroEvento?.code === "23505") {
    return resposta(200, { ok: true, duplicate: evento.id });
  }

  const estado = ESTADOS[evento.type];
  // Evento reconhecido mas sem efeito em direitos: fica registado e acabou.
  if (!estado) return resposta(200, { ok: true, ignored: evento.type });

  if (!uuidValido(evento.app_user_id)) {
    return resposta(200, { ok: true, ignored: "anonymous app_user_id" });
  }

  // A restrição única da tabela é (user_id, store, product_id) — é essa que o
  // upsert tem de usar. `product_id` é NOT NULL, daí o valor de recurso: um
  // evento sem produto é raro, mas perder a compra por causa disso seria pior.
  const { error } = await supabase
    .from("subscriptions")
    .upsert(
      {
        user_id: evento.app_user_id,
        entitlement: evento.entitlement_ids?.[0] ?? "premium",
        status: estado,
        store: LOJAS[evento.store ?? ""] ?? "app_store",
        product_id: evento.product_id ?? "unknown",
        current_period_end: evento.expiration_at_ms
          ? new Date(evento.expiration_at_ms).toISOString()
          : null,
        // Cancelar não tira o acesso — tira a renovação. Quem decide o acesso
        // é `current_period_end`, e o has_entitlement() já o respeita.
        will_renew: estado === "active",
        first_purchased_at: evento.purchased_at_ms
          ? new Date(evento.purchased_at_ms).toISOString()
          : null,
        revenuecat_user_id: evento.original_app_user_id ?? evento.app_user_id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,store,product_id" },
    );

  if (error) {
    // Devolver 500 faz o RevenueCat repetir, que é o que se quer: mais vale
    // processar duas vezes (o upsert é idempotente) do que perder uma compra.
    return resposta(500, { error: error.message });
  }

  return resposta(200, { ok: true, type: evento.type, status: estado });
});
