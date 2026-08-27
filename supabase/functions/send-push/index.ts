import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * O push tem de ser traduzido AQUI.
 *
 * A lista dentro da app traduz-se no cliente, com o i18next. O push nao: o
 * texto e desenhado pelo sistema operativo no ecra bloqueado, a partir do que
 * esta funcao enviou, e o sistema nao traduz nada. Por isso o dicionario vive
 * em dois sitios — `src/lib/i18n/` para a lista, este ficheiro para o push — e
 * um teste confirma que nao divergem.
 *
 * O idioma vem de `profiles.language`, que ja e lido na mesma consulta que vai
 * buscar o token e as preferencias. Nao custa uma consulta a mais.
 */
type Idioma = "pt" | "en";

const TITLES: Record<string, Record<Idioma, string>> = {
  kudo: { pt: "Novo Boost!", en: "New Boost!" },
  comment: { pt: "Novo Comentário", en: "New Comment" },
  follow: { pt: "Novo Seguidor!", en: "New Follower!" },
  streak: { pt: "Sequência de Treinos!", en: "Training Streak!" },
  badge: { pt: "Novo Crachá!", en: "New Badge!" },
  club_request: { pt: "Pedido de adesão", en: "Join request" },
  club_accepted: { pt: "Bem-vindo ao clube!", en: "Welcome to the club!" },
  message: { pt: "Nova mensagem", en: "New message" },
  event: { pt: "Novo evento", en: "New event" },
};

/** As mesmas frases que estao em `src/lib/i18n/`, com os mesmos marcadores. */
const CORPOS: Record<string, Record<Idioma, string>> = {
  notif_follow: {
    pt: "{{actor}} começou a seguir-te!",
    en: "{{actor}} started following you!",
  },
  notif_kudo: {
    pt: "{{actor}} deu-te um boost!",
    en: "{{actor}} gave you a boost!",
  },
  notif_comment: {
    pt: "{{actor}} comentou na tua atividade.",
    en: "{{actor}} commented on your activity.",
  },
  notif_badge: {
    pt: "Desbloqueaste o crachá: {{badge}}!",
    en: "You unlocked the badge: {{badge}}!",
  },
  notif_streak: {
    pt: "{{days}} dias de sequência! Continua assim!",
    en: "{{days}}-day streak! Keep it up!",
  },
  notif_club_request: {
    pt: "{{actor}} pediu para entrar em {{club}}.",
    en: "{{actor}} asked to join {{club}}.",
  },
  notif_club_accepted: {
    pt: "Já fazes parte de {{club}}.",
    en: "You're now part of {{club}}.",
  },
  notif_message: {
    pt: "{{actor}}: {{preview}}",
    en: "{{actor}}: {{preview}}",
  },
  notif_event: {
    pt: "{{club}}: {{title}} · {{date}}",
    en: "{{club}}: {{title}} · {{date}}",
  },
};

/**
 * Nome dos crachas, nos dois idiomas.
 *
 * Desde a migracao 053 a base de dados guarda a CHAVE (`badge_early_bird`), e o
 * gatilho manda-a no parametro `badge`. Interpolar sem traduzir punha
 * `badge_early_bird` dentro do push — o oposto do que a 053 foi corrigir.
 *
 * Vive aqui em duplicado com `src/lib/i18n/` pela mesma razao que os corpos das
 * notificacoes: o push e desenhado no servidor e nao ha i18next. Um teste
 * confirma que os dois nao divergem.
 */
const CRACHAS: Record<string, Record<Idioma, string>> = {
  badge_first_activity: { pt: "Primeira Atividade", en: "First Activity" },
  badge_streak_3: { pt: "3 Dias Seguidos", en: "3 Day Streak" },
  badge_streak_7: { pt: "7 Dias Seguidos", en: "7 Day Streak" },
  badge_streak_30: { pt: "30 Dias Seguidos", en: "30 Day Streak" },
  badge_distance_5k: { pt: "5K", en: "5K" },
  badge_distance_10k: { pt: "10K", en: "10K" },
  badge_distance_21k: { pt: "Meia Maratona", en: "Half Marathon" },
  badge_climb_100m: { pt: "Escalador", en: "Climber" },
  badge_social_5_kudos: { pt: "Popular", en: "Popular" },
  badge_early_bird: { pt: "Madrugador", en: "Early Bird" },
  badge_night_owl: { pt: "Coruja Noturna", en: "Night Owl" },
  badge_weekend_warrior: { pt: "Guerreiro de Fim de Semana", en: "Weekend Warrior" },
  badge_multi_sport: { pt: "Polivalente", en: "Versatile" },
};

/** Dia, mes e hora. A data chega em ISO — ver o comentario da migracao 051. */
function formatarData(iso: string, idioma: Idioma): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(idioma === "en" ? "en-GB" : "pt-PT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/**
 * O corpo do push, no idioma de quem o recebe.
 *
 * Recorre a `message` — o texto portugues que o gatilho tambem grava — em dois
 * casos: linhas anteriores a migracao 051, que nao tem chave, e uma chave que
 * este dicionario nao conheca. O segundo caso acontece se alguem acrescentar um
 * tipo em SQL e se esquecer daqui; um push em portugues e mau, um push a dizer
 * `notif_qualquer_coisa` e pior.
 */
function corpoDoPush(n: NotificationRecord, idioma: Idioma): string {
  const modelo = n.message_key ? CORPOS[n.message_key]?.[idioma] : undefined;
  if (!modelo) return n.message;

  const params: Record<string, unknown> = { ...(n.message_params ?? {}) };
  // Uma chave que este dicionario nao conheca fica como esta: um cracha novo
  // com o nome em bruto e mau, mas um push a dizer `undefined` e pior.
  if (typeof params.badge === "string" && CRACHAS[params.badge]) {
    params.badge = CRACHAS[params.badge][idioma];
  }
  if (typeof params.starts_at === "string") {
    params.date = formatarData(params.starts_at, idioma);
  }

  return modelo.replace(
    /\{\{(\w+)\}\}/g,
    (bruto, chave) => (params[chave] === undefined ? bruto : String(params[chave])),
  );
}

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
  /** Texto portugues. Recurso — ver `corpoDoPush`. */
  message: string;
  message_key: string | null;
  message_params: Record<string, unknown> | null;
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
  idioma: Idioma;
}

async function getDestinatario(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<Destinatario> {
  const { data, error } = await supabase
    .from("profiles")
    .select("expo_push_token, notification_prefs, language")
    .eq("id", userId)
    .single();

  if (error || !data) return { token: null, prefs: {}, idioma: "pt" };
  return {
    token: (data.expo_push_token as string | null) ?? null,
    prefs: (data.notification_prefs as Record<string, boolean> | null) ?? {},
    // Portugues por omissao: e o mercado da app, e e o que a coluna tem por
    // defeito para quem nunca abriu a versao nova.
    idioma: data.language === "en" ? "en" : "pt",
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

async function sendExpoPush(
  token: string,
  notification: NotificationRecord,
  idioma: Idioma,
): Promise<boolean> {
  const title = TITLES[notification.type]?.[idioma] ??
    (idioma === "en" ? "New notification" : "Nova Notificacao");

  const body: Record<string, unknown> = {
    to: token,
    title,
    body: corpoDoPush(notification, idioma),
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
  // Sem segredo configurado recusa-se tudo, em vez de deixar passar.
  //
  // O `if (expectedToken && ...)` que aqui estava tornava a verificacao
  // opcional: bastava a variavel nao existir para o endpoint ficar aberto. E um
  // endpoint aberto que le `user_id` e `message` do corpo do pedido e um
  // problema a serio — quem soubesse o URL mandava a notificacao que quisesse
  // a quem quisesse. O URL de uma edge function e derivavel do projeto, e este
  // repositorio e publico.
  //
  // E o mesmo criterio que o `revenuecat-webhook` ja usava.
  const expectedToken = Deno.env.get("WEBHOOK_SECRET");
  if (!expectedToken) {
    console.error("[send-push] WEBHOOK_SECRET nao configurado — pedido recusado");
    return new Response("Webhook secret not configured", { status: 500 });
  }
  if (req.headers.get("x-webhook-secret") !== expectedToken) {
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

  const { token, prefs, idioma } = await getDestinatario(supabase, notification.user_id);

  if (!token || !isValidExpoToken(token)) {
    return new Response("No valid push token", { status: 200 });
  }

  if (!querReceber(prefs, notification.type)) {
    return new Response("Muted by preference", { status: 200 });
  }

  const success = await sendExpoPush(token, notification, idioma);

  if (!success) {
    await clearPushToken(supabase, notification.user_id);
  }

  return new Response(success ? "OK" : "Token cleared", { status: 200 });
});
