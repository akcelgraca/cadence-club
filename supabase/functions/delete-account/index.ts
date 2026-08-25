import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Apagar a conta, a serio.
 *
 * A app nao consegue fazer isto sozinha: apagar um utilizador exige a service
 * role, e essa chave nunca pode estar no cliente — quem a tivesse apagava a
 * conta de qualquer pessoa. Dai existir esta funcao.
 *
 * ── A regra que aqui mais importa ──────────────────────────────────────────
 *
 * O id de quem vai ser apagado sai do **JWT verificado**, nunca do corpo do
 * pedido. Aceitar um `user_id` de fora, mesmo "so para simplificar", era
 * entregar um botao de apagar contas alheias a quem descobrisse o URL — e o URL
 * de uma edge function deriva-se do projeto, que e publico.
 *
 * ── Porque e que o Storage vem primeiro ────────────────────────────────────
 *
 * A cascata da base de dados trata das linhas: `profiles.id` referencia
 * `auth.users(id) ON DELETE CASCADE`, e 26 tabelas referenciam `profiles` da
 * mesma maneira. **Ficheiros nao sao linhas.** As fotos e os avatares ficariam
 * onde estao, e os dois buckets sao **publicos** — um URL que continuasse a
 * servir a foto de alguem que pediu para apagar a conta e uma falha de
 * privacidade, nao um detalhe de arrumacao.
 *
 * Por isso apagam-se os ficheiros antes do utilizador. Se algo falhar a meio,
 * o pior caso e a pessoa ficar sem fotos e com a conta de pe — e ela pediu
 * exatamente para apagar tudo. A ordem inversa deixava ficheiros orfaos e
 * publicos, sem sequer se saber de quem eram.
 */

const BUCKETS = ["avatars", "activity-photos"];

/** Os caminhos sao sempre `${userId}/ficheiro` — ver `uploadAvatar` e `uploadActivityPhoto`. */
async function apagarFicheiros(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<void> {
  for (const bucket of BUCKETS) {
    const { data: ficheiros, error } = await admin.storage.from(bucket).list(userId);
    if (error) {
      console.error(`[delete-account] nao consegui listar ${bucket}:`, error.message);
      continue; // um bucket inacessivel nao pode impedir o resto de ser apagado
    }
    if (!ficheiros?.length) continue;

    const caminhos = ficheiros.map((f) => `${userId}/${f.name}`);
    const { error: erroRemocao } = await admin.storage.from(bucket).remove(caminhos);
    if (erroRemocao) {
      console.error(`[delete-account] nao consegui apagar de ${bucket}:`, erroRemocao.message);
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "missing_authorization" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Quem esta a pedir? Cliente com a chave anonima e o JWT de quem chamou: se o
  // token nao prestar, o `getUser` devolve erro e nada acontece.
  const comoUtilizador = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: erroUtilizador } = await comoUtilizador.auth.getUser();
  if (erroUtilizador || !user) {
    return new Response(JSON.stringify({ error: "invalid_token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  await apagarFicheiros(admin, user.id);

  const { error: erroApagar } = await admin.auth.admin.deleteUser(user.id);
  if (erroApagar) {
    console.error("[delete-account] deleteUser falhou:", erroApagar.message);
    return new Response(JSON.stringify({ error: "delete_failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log(`[delete-account] conta apagada: ${user.id}`);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
