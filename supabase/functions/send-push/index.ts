import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const TITLES: Record<string, string> = {
  kudo: "Novo Boost!",
  comment: "Novo Comentario",
  follow: "Novo Seguidor!",
  streak: "Sequencia de Treinos!",
  badge: "Novo Cracha!",
  club_request: "Pedido de adesao",
  club_accepted: "Bem-vindo ao clube!",
  message: "Nova mensagem",
  event: "Novo evento",
};

/**
 * Tipo de notificacao -> interruptor nas Definicoes.
 *
 * As duas do clube partilham o mesmo: quem nao quer saber de pedidos tambem
 * nao quer saber de aceites, e dois interruptores para a mesma coisa e mais
 * ecra para o mesmo resultado.
 */
const PREF_POR_TIPO: Record<string, string> = {
  kudo: "boosts",
  comment: "comments",
  follow: "follows",
  streak: "streaks",
  badge: "badges",
  club_request: "clubs",
  club_accepted: "clubs",
  message: "messages",
  event: "events",
};

interface NotificationRecord {
  id: string;
  user_id: string;
  type: string;
  actor_id: string | null;
  reference_id: string | null;
  message: string;
}

interface WebhookPayload {
  type: "INSERT";
  table: string;
  record: NotificationRecord;
}

function isValidExpoToken(token: string): boolean {
  return typeof token === "string" && token.startsWith("ExponentPushToken[");
}

interface Destinatario {
  token: string | null;
  prefs: Record<string, boolean>;
}

async function getDestinatario(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<Destinatario> {
  const { data, error } = await supabase
    .from("profiles")
    .select("expo_push_token, notification_prefs")
    .eq("id", userId)
    .single();

  if (error || !data) return { token: null, prefs: {} };
  return {
    token: (data.expo_push_token as string | null) ?? null,
    prefs: (data.notification_prefs as Record<string, boolean> | null) ?? {},
  };
}

/**
 * A ausencia de chave vale "ligado".
 *
 * So um `false` explicito silencia. Quem nunca abriu as Definicoes tem o
 * objeto vazio, e um tipo novo nao pode nascer desligado para essas pessoas.
 * O filtro e so do push: a linha na lista de notificacoes e criada na mesma,
 * porque o interruptor promete silencio, nao esquecimento.
 */
function querReceber(prefs: Record<string, boolean>, tipo: string): boolean {
  const chave = PREF_POR_TIPO[tipo];
  if (!chave) return true;
  return prefs[chave] !== false;
}

async function clearPushToken(supabase: ReturnType<typeof createClient>, userId: string): Promise<void> {
  await supabase
    .from("profiles")
    .update({ expo_push_token: null })
    .eq("id", userId);
}

async function sendExpoPush(token: string, notification: NotificationRecord): Promise<boolean> {
  const title = TITLES[notification.type] ?? "Nova Notificacao";

  const body: Record<string, unknown> = {
    to: token,
    title,
    body: notification.message,
    data: {
      type: notification.type,
      notificationId: notification.id,
      // `referenceId` e o campo geral; o que significa depende do tipo (uma
      // atividade, um clube, uma conversa) e quem o le e que decide.
      ...(notification.reference_id && { referenceId: notification.reference_id }),
      // `activityId` fica para tras por compatibilidade: as builds ja
      // instaladas so sabem ler este campo, e para elas so ha tipos de
      // atividade. Remover quando deixar de haver builds antigas por ai.
      ...(notification.reference_id &&
        (notification.type === "kudo" || notification.type === "comment") && {
          activityId: notification.reference_id,
        }),
      ...(notification.actor_id && { actorId: notification.actor_id }),
    },
  };

  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error(`[send-push] Expo API returned ${res.status}: ${await res.text()}`);
    return false;
  }

  const result = await res.json();
  const ticket = result?.data;

  // Check for individual ticket errors
  if (ticket?.status === "error") {
    const errorCode = ticket?.details?.error;
    console.error(`[send-push] Expo push error: ${errorCode}`);

    if (errorCode === "DeviceNotRegistered" || errorCode === "InvalidCredentials") {
      return false; // Signal that token should be cleared
    }
  }

  return true;
}

Deno.serve(async (req: Request) => {
  // Only accept POST
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Auth via custom header (Supabase API gateway intercepts Authorization)
  const webhookSecret = req.headers.get("x-webhook-secret");
  const expectedToken = Deno.env.get("WEBHOOK_SECRET");
  if (expectedToken && webhookSecret !== expectedToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // Only process INSERT on notifications
  if (payload.type !== "INSERT" || payload.table !== "notifications" || !payload.record) {
    return new Response("Ignored", { status: 200 });
  }

  const notification = payload.record;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { token, prefs } = await getDestinatario(supabase, notification.user_id);

  if (!token || !isValidExpoToken(token)) {
    return new Response("No valid push token", { status: 200 });
  }

  if (!querReceber(prefs, notification.type)) {
    return new Response("Muted by preference", { status: 200 });
  }

  const success = await sendExpoPush(token, notification);

  if (!success) {
    await clearPushToken(supabase, notification.user_id);
  }

  return new Response(success ? "OK" : "Token cleared", { status: 200 });
});
