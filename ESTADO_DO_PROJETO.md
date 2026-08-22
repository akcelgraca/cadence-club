# Cadence Club — Estado do Projeto

**Data:** 22 de agosto de 2026
**Commit:** `57e5a6b` — `main`, sincronizado com `origin/main`, working tree limpo

> **Branches (21 ago):** o trabalho vivia em `feat/dark-mode`, 47 commits à
> frente da `main` — o cabeçalho deste documento dizia `main` e estava errado.
> A `main` foi avançada por *fast-forward* (nada se perdeu) e a `feat/dark-mode`
> apagada. **A partir daqui trabalha-se só na `main`.** Continua a existir a
> `backup-pre-rewrite`, de 14 ago, com 21 commits que a `main` nunca teve —
> é a cópia do estado anterior à reescrita, e fica.
**Objetivo do produto:** app de fitness social para rivalizar com o Strava, focada no mercado português e em atletas casuais.

> Sobre este documento: o que está marcado ✅ foi verificado a correr nesta máquina (testes, typecheck, build, inspeção do código). O que está marcado ⚠️ ou ❌ é pendência conhecida. A secção "Lacunas face ao Strava" é análise de produto, não facto verificado.

---

## 1. Resumo executivo

A app está **funcionalmente construída e tecnicamente saudável**. Não há trabalho de funcionalidades base por fazer — há trabalho de **validação em dispositivo**, **monetização** e **diferenciação competitiva**.

| Indicador | Estado |
|---|---|
| Testes | ✅ 403 testes, 31 suites, todos a passar |
| Typecheck (`tsc --noEmit`) | ✅ limpo |
| Ecrãs (expo-router) | 44 |
| Componentes | 67 |
| Serviços | 36 |
| Stores (Zustand) | 6 |
| Hooks | 17 |
| Linhas em `src/` | ~40 800 |
| Chaves i18n | 1188 PT + 1188 EN (equilibradas ✅) |
| Migrações Supabase | 50 ficheiros (`001` → `051`; não existe `025`) |
| Edge functions | 2 (`send-push`, `revenuecat-webhook`) |
| Build iOS em dispositivo | ✅ iPhone 15, 18 ago — ⏰ expira **25 ago 2026** |
| Build iOS em simulador | ✅ Debug, com Metro |

**O risco mudou de sítio.** A 17 de agosto, o maior risco era código nunca executado — a sincronização com a Saúde tinha sido escrita a partir da documentação e nunca corrida. Isso ficou validado a 18 de agosto, e o processo apanhou **três bugs reais** que nenhum teste automático teria encontrado:

- `hasPermissions()` devolvia `true` a quem nunca tinha sido perguntado nada (4.1.1)
- `readAsStringAsync` foi removido no SDK 57 e lançava em tempo de execução, partindo a importação de ficheiros **e** a partilha para Instagram Stories
- `cadence://` nunca chegou a ser registado no iOS, o que impedia os links de email de voltarem à app (secção 12)

**O risco de hoje é comercial, não técnico.** A canalização de monetização está construída e desligada (4.6), a importação de ficheiros está na fase 1 (4.5), e nada disto se pode testar a sério nem lançar sem **conta paga da Apple**. A app também não tem utilizadores, por isso não há dados de retenção para decidir preços.

✅ **Não há migrações por aplicar.** A `050` e a `051` foram aplicadas a 22 ago; a `049`, a `047` e a `048` a 20 ago; a `044`, a `045` e a `046` a 19 ago. A base de dados está alinhada com o código. Confirmar com `supabase/VERIFICAR_MIGRACOES.sql`, que passou a cobrir até à **051** — incluindo a verificação de que as nove funções de notificação foram mesmo substituídas, e não só as colunas criadas.

---

## 2. Stack

| Camada | Tecnologia |
|---|---|
| Framework | Expo SDK 57 / React Native 0.86 |
| Navegação | Expo Router (baseada em ficheiros) |
| Backend | Supabase (auth, Postgres, storage, edge functions) |
| Estado | Zustand |
| Queries | TanStack Query |
| Mapas | Mapbox (`@rnmapbox/maps`) |
| Gráficos | `react-native-gifted-charts` |
| Analytics | PostHog |
| Saúde | `@kingstinct/react-native-healthkit` + `react-native-health-connect` |
| i18n | i18next + react-i18next |
| Tipografia | Barlow, Barlow Condensed, DM Mono |
| Testes | jest-expo |

---

## 3. O que já está feito

### 3.1 Gravação e atividades
- Gravação GPS em tempo real com mapa, ritmo, distância, desnível e calorias
- Tracking em segundo plano (`expo-task-manager` + `expo-location`)
- Splits por quilómetro, cálculo de elevação, cálculo de calorias por modalidade
- Edição de atividade, fotos por atividade (até 6), partilha
- Registos pessoais (PRs)
- ✅ Coberto por testes: `splits`, `geo`, `calculateCalories`, `elevation`, `convertUnits`, `formatPace`, `formatDistance`, `activities`

### 3.2 Social
- Feed de atividades com *boosts* e comentários
- Seguir / seguidores, listas de seguidores, perfis públicos
- **Clubes** — criação, descoberta, adesão com pedido de entrada, chat de clube, eventos de clube, perfil de clube
- Mensagens diretas (conversas 1-para-1)
- Notificações in-app + push (edge function `send-push`) — **os nove tipos**, ver 3.2.1
- Pesquisa (utilizadores, rotas, clubes)
- Desafios (`challenges`)

#### 3.2.1 Notificações — os três tipos que faltavam (20 ago) ✅

Cobria seguir, boost, comentário, medalha e sequência. Faltavam os três que a
análise original apontava, e são todos de coisas que dependem de outra pessoa
responder:

| Tipo | Quem recebe | Vai para |
|---|---|---|
| `club_request` | administradores e dono do clube | `/club/[id]` |
| `club_accepted` | quem pediu | `/club/[id]` |
| `message` | os outros participantes da conversa | `/messages/[id]` |
| `event` | membros do clube, menos quem o criou | `/club/[id]` |

**Três decisões que valem a pena registar, porque são de produto e não de
código:**

- **O chat de clube não notifica.** Numa conversa de clube com movimento, uma
  notificação por mensagem é o caminho mais curto para a pessoa desligar as
  notificações todas — e perde-se também as que importam. Só mensagens diretas.
- **Recusar um pedido não gera notificação.** Só o aceite. Quem quiser saber vê
  no clube; ninguém precisa de levar com uma recusa à mesa de jantar.
- **A pré-visualização da mensagem vai truncada aos 80 caracteres.** O sistema
  já corta, e a linha da lista dentro da app não se lê com uma mensagem inteira.

**O `CHECK` do tipo era a armadilha.** A tabela `notifications` nasceu com cinco
tipos fixos. Sem alargar a restrição, o `INSERT` do gatilho rebentava **dentro
da transação de quem enviou** — ou seja, a mensagem não chegava a ser gravada.
Uma notificação em falta é chata; uma mensagem perdida é outra coisa.

**Bónus: os interruptores das Definições passaram a desligar alguma coisa.**
Estavam lá desde sempre, guardados no AsyncStorage do telemóvel, e ninguém os
lia — nem os gatilhos, nem a edge function. Desligar "Boosts" não desligava
nada. Agora vivem também em `profiles.notification_prefs` e a `send-push`
respeita-os. Silenciam o push, não a lista: a notificação continua a aparecer na
app, porque o interruptor promete silêncio e não esquecimento. Chave ausente
vale ligado — um tipo novo não pode nascer desligado em quem nunca abriu as
Definições.

✅ Sete testes de guarda (`notifications.test.ts`) ligam os cinco sítios que um
tipo novo tem de tocar: o `CHECK` em SQL, o ícone, a rota, o título na edge
function e o interruptor. Nenhum deles é apanhado pelo compilador — quatro
vivem em ficheiros que o TypeScript não lê. O teste do SQL ignora comentários,
porque a primeira versão passava a olhar para uma linha comentada.

**⚠️ Hoje nenhum dispositivo consegue receber estes pushes.** Descoberto a 20
ago, ao preparar o teste:

- **iOS** — o `aps-environment` foi removido para assinar com Personal Team.
  Sem conta Apple paga não há push remoto no iPhone. Já estava registado na
  secção 9.4, mas vale a pena repeti-lo aqui: **compilar para o iPhone não
  ajuda nada a testar isto**.
- **Android** — nunca houve FCM. Não há `google-services.json`, nem
  `android.googleServicesFile` no `app.json`, nem chave de serviço carregada no
  Expo. Sem isso o `getExpoPushTokenAsync()` não devolve token no Android, e o
  `exp.host` não tem por onde entregar. O caminho mais barato para testar push
  a sério é este: **criar um projeto Firebase e ligar o FCM** — não custa nada
  e não depende da Apple.

**O que já dá para testar sem nada disso:** a **lista dentro da app**. Os
gatilhos criam as linhas em `notifications` assim que a migração está aplicada,
portanto pedir para entrar num clube, aceitar um pedido, mandar uma mensagem ou
criar um evento já faz aparecer a notificação no ecrã de Notificações — falta
só o toque no telemóvel. É metade da funcionalidade, e é a metade que se
verifica hoje.

**Por fazer, e nenhuma destas é código:**
1. ✅ **Migração 047 aplicada** (20 ago). O `VERIFICAR_MIGRACOES.sql` passou a
   cobri-la: o `CHECK` com os quatro tipos novos, a coluna
   `notification_prefs`, e os quatro gatilhos, um a um — faltar um deles é não
   haver notificação nenhuma desse lado, e em silêncio
2. **Redeployar a `send-push`** (`supabase functions deploy send-push`) — sem
   isto os tipos novos chegam com o título genérico e os interruptores não
   filtram
3. **Build novo** para o cliente apanhar as rotas e os interruptores

**✅ Resolvido a 22 ago — migração 051.** As mensagens dos nove tipos eram
construídas em SQL, em português, e quem tinha a app em inglês recebia
português na mesma. Passam a guardar **chave + parâmetros**, como a 041 fez nos
planos de treino.

**O que torna isto diferente da 041:** um plano de treino só se vê dentro da
app, portanto bastava traduzir no cliente. Uma notificação aparece em dois
sítios, e o segundo é o ecrã bloqueado, desenhado pelo **sistema operativo** a
partir do que a edge function enviou. O sistema não traduz nada. Por isso são
precisas duas traduções e o servidor tem de saber o idioma de cada pessoa — daí
a coluna `profiles.language`, que a `send-push` lê na mesma consulta que já
fazia para ir buscar o token. Zero consultas a mais.

| Onde | O quê |
|---|---|
| `051_notification_i18n.sql` | `profiles.language`, `notifications.message_key` + `message_params`, e as **nove** funções reescritas |
| `src/lib/notificationText.ts` | resolve o texto na lista, com dois recursos |
| `send-push/index.ts` | títulos e corpos nos dois idiomas, e formatação da data |
| `src/lib/i18n/pt.ts` e `en.ts` | as nove chaves `notif_*` |

**A coluna `message` continua a ser escrita**, com o português de sempre. Não é
esquecimento: há builds instaladas que só sabem ler `message`, e as linhas
criadas antes da 051 não têm chave. Passa a ser o recurso — a app nova prefere
`message_key`, a antiga continua a funcionar, e ninguém regride. Mesmo critério
da 041.

**Protegido por 11 testes** em `src/lib/notifications.test.ts` e 7 em
`notificationText.test.ts`. O dicionário vive em **três** sítios que ninguém
obriga a concordar (`pt.ts`, `en.ts` e a tabela `CORPOS` da edge function), e
divergirem falha em silêncio de três maneiras diferentes. Os testes cobrem as
chaves, os dois idiomas em cada entrada, e os marcadores `{{}}`. **Verificado
por mutação:** apagar uma chave do `en.ts`, apagar uma entrada da edge
function, trocar `{{club}}` por `{{clube}}` e deixar uma entrada só com
português — os quatro foram apanhados.

✅ **Aplicada a 22 ago**, e verificada dos dois lados:
- As colunas existem — sondadas pelo PostgREST com a chave anónima (uma coluna
  inventada devolve `42703`, portanto a sonda distingue)
- **As nove funções foram substituídas** — a verificação 32 do
  `VERIFICAR_MIGRACOES.sql` devolveu 9. É a que interessa: as colunas podiam
  existir com as funções antigas a ignorá-las, e nesse caso nada dava erro e as
  colunas ficavam vazias para sempre
- A `send-push` foi redeployada e responde 401 sem o segredo (uma função
  inexistente dá 404)

⚠️ **Falta o build novo, e até lá o push continua em português.** A app
instalada ainda não escreve `profiles.language`, portanto toda a gente fica no
`'pt'` por omissão. Não é defeito — é a ordem natural das coisas.

⚠️ **A versão da edge function não foi confirmada.** O 401 prova que está lá e
protegida, não prova que é o código novo. Só um push a sério o mostra, e
provocá-lo daqui exigia sessão iniciada, que a confirmação de email impede.
Fica para o teste no Android físico.

⚠️ **O nome dos crachás não traduz.** Vem da tabela `badges`, em português, e
vai como parâmetro: um inglês recebe *"You unlocked the badge: Madrugador!"*. A
frase traduz, o nome não. Traduzir os crachás é o mesmo trabalho que a 041 fez
nos planos e fica para depois.

**Fan-out:** um evento num clube de N membros cria N linhas e, por consequência,
N invocações da edge function. Com os clubes que existem hoje é irrelevante;
num clube de milhares deixa de ser.

### 3.3 Rotas e mapas
- Descoberta e criação de rotas no mapa, filtradas por modalidade
- Rotas guardadas, direções via Mapbox Directions
- Geocoding
- Estilos de mapa (incluindo satélite e ar livre), vista 3D com relevo

### 3.4 Segments (troços)
- Deteção e correspondência de troços, histórico de passagens, criação de troço a partir de uma atividade
- ✅ Coberto por testes (`segments.test.ts`)

### 3.5 Perfil e gamificação
- Perfil completo, edição, questionário de onboarding
- Distintivos (badges), sequências (streaks), gráficos mensais, equipamento/material
- ✅ Coberto por testes (`gamification.test.ts`, `profileStats`)

### 3.6 Plano de treino
- Plano semanal gerado automaticamente a partir do objetivo e preferências do utilizador
- `training_plans.label` guarda a **chave** i18n, nunca o texto (migração 041 converteu as linhas antigas)
- ✅ Coberto por testes (`trainingPlan.test.ts`)

### 3.7 Privacidade
- **Zonas de privacidade** — corta o traçado GPS à volta de moradas sensíveis (casa, trabalho)
- ✅ Coberto por testes (`privacyZones.test.ts`)
- Decisão de produto: **nunca vai ser pago** — é segurança, não funcionalidade premium

### 3.8 Offline
- Fila de sincronização pendente para atividades gravadas sem rede
- ✅ Coberto por testes (`pendingSync.test.ts`)

### 3.9 Internacionalização
- **Bilingue PT/EN, completa.** Segue o idioma do telemóvel, mudável nas Definições
- 1188 chaves em cada idioma
- ✅ Três testes protegem isto: dicionários com as mesmas chaves, mesmos marcadores `{{}}` nos dois idiomas, e todas as chamadas `t()` a apontar para chaves existentes (uma chave em falta não estoira — aparece em bruto ao utilizador)
- Padrão: constantes com texto visível guardam `i18n_key`, nunca o texto

#### 3.2.7 `POST /auth/v1/signup` a devolver 500 (20 ago) — ✅ RESOLVIDO a 21 ago

O erro que aparecia no ecrã das preferências de treino **não era desse ecrã**: o
passo do questionário no onboarding só faz `setStep('profile')`, sem um único
pedido à rede. Os logs do Supabase mostraram a origem:

```
POST | 500 | /auth/v1/signup | okhttp/4.10.0
```

**Não é do código da app.** O `signUp` é `supabase.auth.signUp({ email,
password })` e mais nada — não há como devolver 500 do lado do cliente. Também
não é de nada que se tenha mudado a 19 ou 20 de agosto: não existe gatilho em
`auth.users` neste projeto (o perfil é criado pela app, no `createProfile`), e a
coluna `notification_prefs` da 047 tem `DEFAULT`, portanto não interfere.

**Hipótese principal, por confirmar nos *Auth logs*:** o serviço de email
embutido do Supabase tem um limite baixo de envios por hora nos projetos
gratuitos — a documentação fala em **2 por hora e por projeto** — e com a
confirmação de email ligada o GoTrue devolve **500** quando o limite é
excedido. Foram criadas várias contas de teste hoje, entre o iPhone e o
emulador.

**Como confirmar:** *Logs → Auth*. A mensagem do GoTrue distingue os casos —
`Error sending confirmation email` (limite/SMTP) de `Database error saving new
user` (gatilho ou restrição).

#### Resolvido com SMTP próprio (21 ago) ✅

O embutido não serve para lançar de qualquer forma — a Supabase diz
explicitamente que é só para desenvolvimento. A 21 de agosto ficou preparado
tudo o que se consegue preparar daqui; o que falta é conta, domínio e painel,
que são passos manuais. **Guia completo: `supabase/SMTP.md`.**

| | |
|---|---|
| `npm run smtp:check` | liga-se ao servidor, negoceia TLS, autentica-se e envia uma mensagem real. Existe porque o painel do Supabase **aceita credenciais erradas sem as testar** — guarda-as, diz *Settings saved*, e só se descobre no registo seguinte. **✅ Passa contra o Resend com o domínio real (21 ago)** |
| `supabase/email-templates/` | Confirm signup, Reset Password e Change Email, PT/EN, com a marca da app |
| `lang` no `user_metadata` | o `signUp` passa o idioma da app e as Definições atualizam-no; é assim que um template só consegue ser bilingue |
| bloco SMTP no `.env.example` | **sem** `EXPO_PUBLIC_` — com esse prefixo a palavra-passe ia dentro do bundle |

**A prova, contra o projeto a sério (21 ago).** Cinco `POST /auth/v1/signup`
seguidos, direitos ao GoTrue com a chave anónima — sem app pelo meio, para
separar o que era incógnita do que não era. **Os cinco em HTTP 200**, todos com
`confirmation_sent_at` preenchido, os últimos três em 20 segundos, que é
precisamente o ritmo que fazia o embutido rebentar.

Isto fechou as duas dúvidas que ficaram por confirmar de manhã:

- ✅ **O campo *Site URL* aceita `cadence://`** — não é preciso passar
  `emailRedirectTo` no código
- ✅ **O motor de templates aceita a condição do idioma.** Testado nos dois
  casos que interessam: com `lang: "en"` e **sem `lang` nenhum**, que era o
  arriscado — comparar nil com uma string rebenta o template, e um template que
  rebenta é um email que não sai, ou seja o 500 outra vez. O
  `printf "%v"` aguenta. O plano B do §7 do guia não é preciso

🧹 Ficaram cinco utilizadores `akcelmedico+smtp-*@gmail.com` em
*Authentication → Users*, para apagar.

⚠️ **Testar no emulador Android, não no iPhone.** O link do email precisa do
`cadence://`, que só passou a estar registado no `app.json` a 20 de agosto e
**exige rebuild** (secção 12). A build que está no iPhone ainda não o sabe abrir.

#### O fornecedor e o domínio (21 ago) ✅

| | |
|---|---|
| Fornecedor | **Resend**, região Irlanda (`eu-west-1`) |
| Domínio | **`cadenceclub.pt`** (Amen), verificado |
| Remetente | `no-reply@cadenceclub.pt` |
| DNS | DKIM, SPF+MX em `send`, DMARC — os quatro confirmados propagados |
| `npm run smtp:check` | ✅ autentica e entrega |
| Entregabilidade | ✅ Caixa de entrada do Gmail, `spf=pass` e `dkim=pass` |

O `cadenceclub.site` também é nosso; **não se envia de lá** — o `.site` é dos
TLDs baratos que os filtros de spam olham de lado, e um domínio novo já parte
sem histórico de envio. Fica para redireccionamento ou staging.

⚠️ **A raiz do `cadenceclub.pt` já tinha correio da Amen** (`MX
mail-pt.securemail.pro`, `TXT v=spf1 include:spf.webapps.net ~all`). Não
conflitua com o Resend — o SPF dele vive em `send.cadenceclub.pt` e o DKIM
alinha pela raiz — mas **não mexer em nenhum dos dois**. Em troca há caixa de
correio no domínio, que resolve o endereço de suporte que a App Store exige.

**Painel feito a 21 ago:** SMTP, rate limit a 100/hora, os três templates e a
configuração de URLs (`cadence://` + `cadence://*`). **Falta só** validar o
link do email a abrir a app — teste de dispositivo, no emulador Android; no
iOS precisa do rebuild da secção 12.

**Desbloqueio imediato enquanto o painel não está feito:** *Authentication →
Providers → Email* e desligar **Confirm email**. Não subir só o rate limit sem
SMTP próprio — o embutido não tem entregabilidade nenhuma.

#### 3.2.6 Os builds do EAS saíam sem credenciais (20 ago) ✅

Dois problemas reportados no Android, **uma só causa**: o login com Google
abria o browser e não voltava, e guardar as preferências de treino falhava com
`UnknownHostException: unable to resolve`.

O bundle do APK continha `YOUR_PROJECT.supabase.co`, `your-anon-key` e
`your-mapbox-token` — os valores por omissão do `constants.ts`. O `.env` é
gitignorado, portanto não chega ao EAS, e o `eas.json` só levava as duas
variáveis do PostHog acrescentadas a 19 ago. **As outras cinco nunca lá
estiveram.**

**Porque é que o Google falhava sem dar erro:** o
`supabase.auth.signInWithOAuth` constrói o URL do lado do cliente, sem chamada à
rede. O browser abria em `https://YOUR_PROJECT.supabase.co/auth/v1/authorize`,
essa página nunca resolvia, e não havia redirecionamento de volta. Nada a ver com
o esquema `cadence://`, que está registado no manifesto Android.

**Correção:** todas as `EXPO_PUBLIC_*` passaram para **variáveis de ambiente do
EAS** (`preview` e `production`), e não para o `eas.json` — o repositório é
público. Os blocos `env` saíram do `eas.json`, e cada perfil passou a declarar
`"environment"`. **Sem esse campo as variáveis do EAS não se aplicam**, portanto
dava para fazer tudo o resto certo e continuar a falhar.

✅ `npm run env:check` — compara os nomes que o código lê (em todo o `src`, não
só no `constants.ts`: os IDs do Google são lidos noutro sítio, e a primeira
versão do script não os via) contra o `.env` e contra os dois ambientes do EAS,
e confirma que cada perfil aponta para um ambiente. As chaves do RevenueCat
estão marcadas como vazias de propósito, para o script não nos treinar a
ignorá-lo.

O `constants.ts` passou também a avisar em `__DEV__` quando está a usar valores
de exemplo — `UnknownHostException` não diz a ninguém que faltou uma variável.

**Build corrigido:** `ae062eab-691d-4250-96c0-d593973ae15f`. Verificado por
inspeção do bundle **antes** de o dar como bom: `oygedlkjvshcforoklbr` presente,
`YOUR_PROJECT.supabase.co` e os restantes valores de exemplo a zero. Instalado
no emulador, arranca sem erros de resolução no logcat.

**Nota:** as builds de iPhone nunca tiveram este problema — são locais, pelo
`xcodebuild`, que lê o `.env` do disco. Só os builds do EAS saíam vazios.

#### 3.2.5 Emulador Android — o que já existe nesta máquina (20 ago)

Não é preciso instalar nada. O SDK está em `~/Library/Android/sdk` (sem Android
Studio) e já tem emulador e imagens.

**AVD existente: `Pixel_4`** — API 29 (Android 10), `google_apis_playstore`,
`arm64-v8a`. Nativo no Apple Silicon, portanto rápido.

**O detalhe que decide se serve para testar push:** a imagem tem de trazer os
Google Play services. Confirmado neste AVD (`com.google.android.gms` e
`com.android.vending` instalados). Uma imagem **AOSP** — sem `google_apis` nem
`playstore` no nome — **não recebe FCM**, e o sintoma seria o
`getExpoPushTokenAsync()` a devolver null sem explicação.

```bash
~/Library/Android/sdk/emulator/emulator -list-avds
~/Library/Android/sdk/emulator/emulator -avd Pixel_4 &
~/Library/Android/sdk/platform-tools/adb install -r caminho/para.apk
```

APK de 20 ago instalado e a app confirmada a arrancar (ecrã de login, em inglês,
que é o idioma do emulador — serve também de prova do i18n).

**⚠️ Limitação que apanha o login com Google:** o Chrome que vem nesta imagem é
a versão **101 (2022)** e rebenta ao arrancar num emulador só arm64:

```
java.lang.RuntimeException: Unable to start activity CustomTabActivity:
  Starting in 64-bit mode requires the 64-bit native library.
```

Como o login com Google passa por um *custom tab*, **não há como o testar neste
emulador** — e o erro que aparece na app é consequência disso, não um defeito da
app. O logcat confirma que o pedido já sai com o URL certo
(`oygedlkjvshcforoklbr.supabase.co`), portanto a correção das variáveis de
ambiente funcionou; é o browser que morre a seguir.

Testar o Google num **Android físico**. Tudo o resto — push, modo escuro, i18n,
entrada por email — testa-se bem no emulador.

**Limitação deste AVD:** Android 10 não traz Health Connect (só é nativo a
partir do Android 14). Para testar a sincronização de saúde é preciso instalar a
app Health Connect pela Play Store, ou criar um AVD de API 34 — a imagem
`android-34/google_apis` já está descarregada, falta só o AVD.

#### 3.2.4 Build Android — falhou, corrigido, e passou (20 ago) ✅

Primeiro build Android desde 1 de agosto. **Falhou no Gradle**, com o erro
inútil do EAS: `EAS_BUILD_UNKNOWN_GRADLE_ERROR`.

Build: `746617dc-3d52-4fbb-8252-36d73c741e74`, perfil `preview`.

**Já descartado — não vale a pena repetir:**

- **Token de download do Mapbox.** Era a primeira suspeita, porque existe um
  `MAPBOX_DOWNLOAD_TOKEN` no ambiente `preview` do EAS e o nome está errado (o
  Gradle procura `MAPBOX_DOWNLOADS_TOKEN`, com S). Mas o próprio
  `@rnmapbox/maps` diz no `android/install.md`: *"mapbox lifted auth requirement
  from downloads so MAPBOX_DOWNLOADS_TOKEN is no longer needed"*. O nome errado
  é ruído, não a causa.
- **A cadeia de plugins de configuração.** `npx expo config --type prebuild`
  corre sem erro, e um `expo prebuild --platform android` numa cópia do projeto
  gera o `android/` completo.
- **O `googleServicesFile` acrescentado hoje.** O prebuild copia o
  `google-services.json` para `android/app/`, mete o
  `classpath 'com.google.gms:google-services:4.4.4'` e aplica o plugin. Está
  tudo onde devia.

**Encontrado pelo `expo-doctor` — nenhum explicava o erro de Gradle, e ✅ todos
resolvidos a 22 ago (ver 3.13):**
- ~~falta o peer `expo-font`~~ — já estava no `package.json`, a nota era falsa
- ~~`expo@57.0.8` apanhado pela regressão de memória do Hermes V1~~
- ~~19 pacotes fora das versões do SDK 57~~

**Não dá para reproduzir localmente:** o Mac só tem JDK 11, e o RN 0.86 precisa
do 17.

**A causa, encontrada no log:**

```
uses-sdk:minSdkVersion 24 cannot be smaller than version 26 declared in
library [androidx.health.connect:connect-client:1.1.0]
```

O `react-native-health-connect` arrasta o `connect-client:1.1.0`, que exige
**minSdk 26**. O projeto estava em 24, o valor por omissão do Expo. Falhou no
`processReleaseMainManifest`, ao fim de 25 minutos de compilação — nada a ver
com FCM, Mapbox ou o que quer que se tenha feito hoje. Estava à espera desde que
o Health Connect entrou.

**Correção:** `expo-build-properties` com `android.minSdkVersion: 26`.
Confirmado num prebuild de teste que sai `android.minSdkVersion=26` no
`gradle.properties` — vale a pena confirmar antes de gastar outro build de 25
minutos.

**O que se perde:** Android 7.0 e 7.1 (API 24–25). Sem consequência prática — o
Health Connect exige 26 de qualquer forma, portanto esses telemóveis nunca
poderiam usar a sincronização de saúde. O Android 8.0 é de 2017.

**De caminho:** instalado o `expo-font` que faltava (peer do
`@expo/vector-icons`); sem ele há risco de crash em runtime fora do Expo Go, e
seria neste mesmo build.

**✅ Build seguinte passou.** `c286e71a-651c-4819-a8f7-6b50b3244502`, perfil
`preview`. APK:
https://expo.dev/artifacts/eas/f2OVWUQLqHN6pjtmzGZSM_rDRAxaTdzdZ5FhFbMwy7Y.apk

É o **primeiro build Android desde 1 de agosto**, e o primeiro de sempre com
push a funcionar. Traz tudo o que se fez a 19 e 20 de agosto: modo escuro,
notificações de clubes/mensagens/eventos, frequência cardíaca (incluindo a
leitura do Health Connect), calorias por modalidade, as 21 correções de i18n, as
unidades da voz, e os ecrãs que já não ficam sem saída.

**Como se chega aos logs do EAS a partir do código** — porque não é óbvio e
custou a descobrir: o `eas build:view --json` traz um campo `logFiles` com um
URL assinado (válido 15 minutos). O conteúdo vem em **Brotli**, não em gzip: o
`curl --compressed` desta máquina não o aceita e o Python não traz descompressor
de Brotli, mas o `node` traz — `zlib.brotliDecompressSync`. As linhas são JSON,
uma por linha, com a mensagem em `msg`.

#### 3.2.3 Push — os cinco elos, e como saber qual partiu (20 ago)

Uma notificação atravessa cinco passos. Falha em qualquer um deles e o sintoma é
o mesmo — o telemóvel não toca — por isso vale a pena saber distingui-los.

| # | Elo | Como confirmar |
|---|---|---|
| 1 | A app regista e guarda o token | `SELECT id, expo_push_token FROM profiles WHERE id = auth.uid();` — tem de começar por `ExponentPushToken[` |
| 2 | A ação cria a linha | `SELECT type, message, created_at FROM notifications ORDER BY created_at DESC LIMIT 5;` |
| 3 | O webhook chama a função | Logs da edge function no painel do Supabase. **Sem invocação nenhuma, é aqui.** |
| 4 | A função aceita e envia | Os mesmos logs: `Muted by preference`, `No valid push token`, ou erro do Expo |
| 5 | Expo → FCM → telemóvel | Se 1–4 estão bem e não chega nada, é credencial de plataforma |

**Ficheiro de diagnóstico:** `supabase/VERIFICAR_PUSH.sql`. Colar no SQL Editor.
Responde pelos elos 1, 2 e 3 sem depender de encontrar nada no painel — os
"Database Webhooks" do Supabase são, por baixo, um gatilho que chama
`supabase_functions.http_request`, portanto vê-se em `pg_trigger`. Os elos 4 e 5
só se veem nos logs da edge function.

**No painel, a opção mudou de sítio:** deixou de estar em *Database → Webhooks*.
Nas versões recentes está em **Integrations → Database Webhooks** (ou pela
pesquisa do painel, `Ctrl/Cmd + K` → "webhook").

**⚠️ O elo 3 estava mesmo em falta — confirmado a 20 ago.** O
`VERIFICAR_PUSH.sql` devolveu `EM FALTA` no gatilho da `notifications`. A edge
function estava publicada desde sempre e **nunca foi invocada uma única vez**:
publicar uma edge function não cria nada na base de dados. Era esta a razão de
nunca ter chegado um push.

**Migração `049_push_webhook.sql`** cria o gatilho. Faz-se por SQL em vez de
pelo painel por duas razões: fica em migração como tudo o resto, e o segredo vem
do **Vault** em vez de ficar colado à definição do gatilho.

Antes de aplicar, guardar o segredo uma vez (e **não** commitar):

```sql
SELECT vault.create_secret('o-mesmo-valor-do-WEBHOOK_SECRET', 'send_push_webhook_secret');
```

**Duas decisões dentro do gatilho que valem a pena registar:**

- **Sem segredo, avisa e deixa passar — nunca rebenta.** O gatilho corre dentro
  da transação de quem mandou a mensagem; um `RAISE` faria a mensagem não chegar
  a ser gravada. Trocar uma notificação em falta por uma mensagem perdida é um
  mau negócio. O aviso fica nos logs do Postgres.
  ⚠️ **A 049 dizia isto e não o garantia:** tratava o segredo em falta, mas
  qualquer outra exceção — o `net.http_post` não resolver no schema esperado, o
  `pg_net` não estar instalado, uma falha a ler o Vault — continuava a propagar-se
  e a derrubar a transação. A **migração 050** envolve o corpo todo num
  `EXCEPTION WHEN OTHERS`.
- **`net.http_post` é assíncrono.** Põe o pedido numa fila e devolve logo, para
  que ninguém fique à espera da resposta do Expo para ver a sua mensagem
  enviada.

**Corrigido no mesmo dia, e é de segurança:** a verificação do segredo era
opcional — `if (expectedToken && ...)`. Bastava a variável `WEBHOOK_SECRET` não
existir para o endpoint ficar **aberto**, e ele lê `user_id` e `message` do
corpo do pedido. Quem soubesse o URL mandava a notificação que quisesse a quem
quisesse; o URL de uma edge function é derivável do projeto, e este repositório
é público. Passou a recusar com 500 quando o segredo não está configurado, que é
o critério que o `revenuecat-webhook` já usava.

**Consequência prática:** é preciso definir `WEBHOOK_SECRET` nas variáveis da
edge function **e** pôr o mesmo valor no cabeçalho do webhook. Se já havia push
a funcionar sem segredo, para até isso estar feito — de propósito.

#### 3.2.2 FCM — push no Android (20 ago) 🚧

Metade feita: a que é código. A outra metade precisa de contas, e essa é tua.

**Feito:**
- `app.json` → `android.googleServicesFile: "./google-services.json"`
- `.gitignore` → a **chave da conta de serviço** fica de fora
  (`*-firebase-adminsdk-*.json`, `service-account*.json`); o
  `google-services.json` **não** é ignorado, porque só tem identificadores
  públicos e o EAS precisa dele no build — é o que a documentação do Expo diz
- `npm run push:check` — confirma o que dá para confirmar daqui

**Feito a 20 ago:** projeto Firebase `cadence-club-7e32c` criado, app Android
registada com `com.akcelgraca.cadence`, e o `google-services.json` na raiz.
O `npm run push:check` confirma que o pacote bate certo nos dois ficheiros.

O `google-services.json` **está commitado**, apesar de o repositório ser
público. É o que a documentação do Expo indica — o ficheiro só tem
identificadores públicos, e a chave Android que traz é restringida pelo nome do
pacote e pela assinatura — e é o que permite ao EAS lê-lo no build sem mais
configuração. A alternativa (variável de ambiente do tipo ficheiro no EAS, com
o `app.json` convertido em `app.config.js`) foi ponderada e posta de lado por
acrescentar peças sem resolver um risco real.

**Feito a 20 ago, 15:4x:** chave da conta de serviço gerada e carregada no EAS.

```
Push Notifications (FCM V1): Google Service Account Key For FCM V1
Project ID    cadence-club-7e32c
Client Email  firebase-adminsdk-fbsvc@cadence-club-7e32c.iam.gserviceaccount.com
```

**A dúvida do perfil ficou respondida pela própria CLI**, que não a documentação:
a mensagem é *"Google Service Account Key assigned to **com.akcelgraca.cadence**
for FCM V1"* — ou seja, a chave é atribuída ao **identificador da aplicação**, e
não ao perfil de build. Serve os quatro perfis. Não é preciso repetir para o
`preview`.

⚠️ **A chave privada ficou dentro da pasta do projeto**
(`cadence-club-7e32c-firebase-adminsdk-fbsvc-….json`), que é um repositório
**público**. Confirmado que o git a ignora, que nunca foi rastreada e que não
aparece em nenhum commit — o padrão `*-firebase-adminsdk-*.json` apanha-a. Mesmo
assim, o sítio certo para ela é fora do projeto: já cumpriu a função, e o EAS
guarda-a do lado dele.

**Por fazer:**
5. `eas build --platform android --profile preview`

**O erro que o `push:check` existe para apanhar** não dá erro nenhum: se o
pacote no `app.json` não for o mesmo que está registado no
`google-services.json`, o Firebase não reconhece a app, o
`getExpoPushTokenAsync()` devolve `null`, e a app corre sem se queixar. Só se
descobre a olhar para um telemóvel que nunca recebe nada. Verificado com um
ficheiro de pacote trocado — o script apanha e diz quais são os dois valores.

⚠️ **Atenção ao `expo prebuild`:** o `app.json` já aponta para o
`google-services.json`. Enquanto o ficheiro não existir, um `prebuild` falha a
dizer que não o encontra. Os builds de iPhone não passam por lá (vão direitos ao
`xcodebuild` sobre a pasta `ios/`), portanto não são afetados.

#### 3.9.2 i18n — histórico e desafios (20 ago)

**Histórico.** A lista de meses estava **meio migrada**: `'month_jan'` a
`'month_jun'` já eram chaves, `'Julho'` a `'Dezembro'` ainda eram texto — e
**nenhuma das doze passava pelo `t()`**. Ou seja, de janeiro a junho o cabeçalho
de secção mostrava literalmente `month_jan`, e de julho a dezembro mostrava
português em qualquer idioma. As duas metades estavam erradas de maneiras
diferentes. Também `'atividade'/'atividades'` e o `em` da linha do ano.

A secção passou a guardar `monthI18nKey` e `year` em vez de um título montado,
com o `t()` no momento de desenhar — o que permite trocar de idioma sem
reconstruir as secções.

**Desafios.** O nome e a descrição vinham da base de dados em português, e o
ecrã mostrava-os em bruto. Seguiu-se o caminho da migração `041` (planos de
treino): a `048` converte as colunas em chaves de tradução, e a app resolve ao
desenhar. Linhas que escapem ao mapeamento continuam como estão, porque o
i18next devolve a própria chave quando não a encontra.

**⚠️ E um bug que a tradução ia expor:** o ecrã decidia se um desafio era
coletivo com `challenge.name.toLowerCase().includes('comunidade')`. Além de
frágil, morria assim que o nome passasse a ser uma chave — e morria **em
silêncio**, com o desafio da comunidade a mostrar progresso individual. Passou
a coluna `is_collective`, que obrigou a recriar a
`get_challenges_with_progress()` (o `CREATE OR REPLACE` não muda o tipo de
retorno — dá `42P13`).

✅ **Migração `048` aplicada** (20 ago). O `VERIFICAR_MIGRACOES.sql` cobre-a, incluindo a verificação de que a RPC devolve mesmo o `is_collective` — se não devolver, o ecrã recebe `undefined` e o desafio coletivo mostra progresso individual, sem erro nenhum.

O teste dos meses foi alargado: só cobria os abreviados, e foi por isso que
deixou passar `'Julho', 'Agosto'` no histórico. Agora cobre também os nomes por
extenso, verificado com uma regressão de propósito.

#### 3.9.1 i18n — o que a migração deixou para trás (20 ago)

O teste de guarda que existia procurava texto humano em propriedades com uma
heurística de duas condições: **acento**, ou **espaço e maiúscula**. As abas do
Social e do Perfil não têm nenhuma das duas — `'Clubes'`, `'Mensagens'`,
`'Resumo'`, `'Conquistas'` — e por isso ficaram em português na app inglesa
durante todo este tempo, com o teste a passar.

A heurística passou a ser **acento, ou começar por maiúscula**. Chaves e
identificadores nestas propriedades são minúsculos ou camelCase, portanto a
maiúscula chega para os separar. Ao apertar, apareceram **21 strings em 12
ficheiros**, e não as duas que tinham sido reportadas.

Corrigido: as abas do Social, do Perfil e do perfil de outra pessoa (a constante
guarda `i18n_key`, como manda o padrão do projeto), o título do separador
Social, o `'Casa'` das zonas de privacidade, o `'Cidade'` do registo, o
`'Relevo'` dos controlos de mapa, o `'Fim'` de dois mapas, e o `'Fechar'`,
`'Stories'`, `'Partilhar'` e `'TEMPO'` da partilha.

**Duas famílias que nenhum teste de i18n via**, porque não passam por `t()` e
para um teste de chaves são só arrays de strings:

- **Quatro listas de meses escritas à mão**, todas em português, uma delas com
  *"Marco"* sem cedilha. Passaram a vir do `Intl` através de `monthNames()`,
  calculado a cada chamada porque o idioma muda dentro da app sem reiniciar.
- **`'pt-PT'` fixo em oito sítios** — datas, horas e o separador de milhares.
  Passou a `localeTag()`, que segue o idioma.

E de caminho, dois que estavam à vista de todos e ninguém via: o
`formatRelativeTime` devolvia *"há 2h"* e *"há 3 dias"* em qualquer idioma — e
aparece em doze ecrãs — e o **feedback de voz durante o treino** falava
português com a app em inglês, com a voz do sistema também fixada em `pt-PT`.

✅ Dois testes de guarda novos: nenhum ficheiro de ecrã escreve nomes de mês à
mão, nem fixa `'pt-PT'`. Verificados a partir uma regressão de propósito.

✅ **Corrigido no mesmo dia:** o feedback de voz dizia sempre "quilómetros",
mesmo com o sistema imperial escolhido. Eram **dois** números errados, não um:
a distância era anunciada em quilómetros, e o **ritmo também vinha por
quilómetro** — quem corre em milhas via uma coisa no ecrã e ouvia outra ao
ouvido, sem que nenhum dos dois batesse certo. 5'00"/km são 8'02"/milha.

A conta saiu do `useLocationTracker` para `utils/voiceAnnouncement.ts`, função
pura com oito testes: é a parte com contas e a única que se engana em silêncio
— um anúncio errado não deixa rasto nenhum. Trata também o caso de trocar de
sistema a meio do treino: aos 5 km já anunciados, em milhas isso são 3, e
repetir números que a pessoa já ouviu seria pior do que calar-se até passar à
frente.

### 3.10 Autenticação
- Email/password, Google Sign-In, Apple Sign-In

### 3.11 Analytics
- Wrapper PostHog com 17 eventos instrumentados: `app_opened`, `activity_recorded`, `premium_feature_used`, `activity_shared`, `signed_up`, `onboarding_completed`, `paywall_viewed`, `premium_purchased`
- ✅ Coberto por testes (`analytics.test.ts`)

**⚠️ Estado: instrumentado, mas ainda não a recolher.** Falta a chave — e só a
chave. Tudo o resto ficou preparado a 19 ago para que pôr a chave seja o único
passo. O **PostHog Self-driving foi configurado a 19 ago** (ver `posthog-self-driving-report.md`): GitHub ligado, 6 fontes de sinal ativas, tropa de 5 scouts a correr. Assim que a chave entrar, o `health-checks` scout apanha logo o que falta.

- `EXPO_PUBLIC_POSTHOG_KEY` no `.env` está em `phc_COLAR_AQUI`. **É aqui que se
  cola a project API key.** Enquanto não mudar, não sai um único evento.
- A validação deixou de ser "é diferente do valor de exemplo" e passou a exigir
  o formato `phc_…`. Motivo: a *personal* API key (`phx_`) é o engano comum de
  quem a copia do sítio errado das definições, e o SDK aceitava-a sem se
  queixar — app a correr, painel vazio, e ninguém dava por isso.
- O cliente PostHog nasce com `disabled: true` quando não há chave. Antes só o
  `track()` estava travado, e o `PostHogProvider` — que faz autocapture de
  ecrãs e de ciclo de vida por sua conta — ficava a bater numa chave inválida
  com retries enquanto a app estivesse aberta.
- Em `__DEV__` o Metro passa a gritar no arranque quando não há chave, e o
  `flushAt` desce a 1 para o evento aparecer no painel em segundos.
- `eas.json`: os perfis `preview` e `production` ganharam a mesma variável. O
  `.env` é gitignorado, logo não sobe para o EAS — sem isto, os builds de loja
  saíam sem chave. A project API key não é segredo (viaja no bundle), por isso
  pode ficar versionada no `eas.json`.
- **Host: `https://eu.i.posthog.com`.** O projeto deve ser criado na EU Cloud —
  app portuguesa, RGPD. A chave só é aceite na região onde foi criada; trocar
  de cloud dá 401.

**`npm run analytics:check`** — lê o `.env`, confirma a chave contra o servidor
e envia um evento `analytics_smoke_test`. Detalhe que justifica o script: o
endpoint de captura responde 200 a *qualquer* chave e deita o evento fora
depois, em silêncio; a validação a sério tem de passar pelo `/flags`, que é o
que devolve 401. Verificado a 19 ago com uma chave falsa — apanha-a.

### 3.11b Correção — ecrãs sem saída (`GO_BACK was not handled`) (19 ago)

**O sintoma:** com o paywall aberto, um reload do Metro reconstrói a pilha a
partir do URL e o `/premium` fica a ser o **único** ecrã. O botão de fechar
chamava `router.back()`, ninguém tratava o GO_BACK, e não havia como sair. Em
desenvolvimento aparece o aviso; em produção o botão apenas não faz nada.

**Nota de diagnóstico, para a próxima vez:** o stack da LogBox não serve para
encontrar o culpado. O `router.back()` não navega — só põe `{type:'GO_BACK'}`
na `routingQueue` (`global-state/router.js:94`), e quem a esvazia é um
`useEffect` interno do expo-router (`imperative-api.js:12`). O stack é sempre
esse efeito, igual para qualquer chamada, venha de um `onPress` ou de uma
renderização. Para encontrar quem chamou, embrulha-se o `router.back` e
regista-se `new Error().stack` no momento da chamada. Foi assim que se chegou ao
`premium.tsx`, depois de uma primeira leitura errada que apontava ao picker.

**A correção, aplicada à classe e não ao caso:** `src/lib/navigation.ts` com
`goBackOr(fallback)` — volta para trás quando dá, substitui pelo pai natural do
ecrã quando não dá. Aplicado aos 33 `router.back()` de 23 ecrãs, cada um com o
seu destino de recurso (o paywall → `/(tabs)/profile`, o chat de clube →
`/club/${id}`, e assim por diante). Qualquer ecrã aberto por notificação ou deep
link nasce sem nada por baixo, por isso não era um problema só do paywall.

- ✅ Teste de guarda (`navigation.test.ts`): nenhum ficheiro em `src/app` pode
  voltar a chamar `router.back()` cru.
- O `CustomHeader` fica de fora e continua com `navigation.goBack()`: a seta só
  é desenhada quando o React Navigation diz que há para onde voltar.

**Bónus, no mesmo ficheiro:** o `settings/picker.tsx` chamava `router.back()` no
corpo da renderização, e com o `return null` **antes** dos `useState`/`useRef`.
Como a seleção única limpa o `_config` antes de sair, bastava uma re-renderização
a meio da transição para a mesma instância renderizar sem hooks nenhuns —
«rendered fewer hooks than expected», que é crash. A config passa a ser
fotografada num `useRef`, e a saída passou para um efeito.

### 3.11c Modo escuro (19 ago) ✅

**O que impedia não era o `useColors()`.** Ele devolvia `lightColors` e trocá-lo
é uma linha. O que impedia eram **93 ficheiros e ~1600 usos** de um `colors`
estático — uma cópia do `lightColors` — a maioria (1183) dentro de
`StyleSheet.create`, que é avaliado **uma vez**, quando o módulo carrega. Nenhum
deles reagiria a uma mudança de tema.

O que foi feito:

- **`darkColors`** em `lib/theme.ts`. Não é o claro invertido: o fundo é
  `#101211` (preto puro faz o conteúdo flutuar e mostra o *smearing* do scroll
  em OLED) e o verde da marca sobe de `#7BA823` para `#9ED42F`, com o
  `primaryForeground` a inverter para escuro. Contrastes verificados: o texto
  dá 16,2:1 e o verde 10,7:1 contra o fundo — AA em tudo o que é texto.
- **`resolveTheme(preferência, sistema)`** — função pura, testada. A preferência
  explícita ganha; em `'system'` segue o telemóvel; enquanto o sistema não
  responde (`null`, `'unspecified'`) fica claro, para não escurecer por um
  instante no arranque.
- **`useColors()`** lê o `settings.theme` (o seletor já existia no ecrã de
  Definições, guardava, e ninguém o lia) e o `useColorScheme()`.
- **93 ficheiros migrados** para `makeStyles(c)` + `useMemo`, por codemod, com o
  `tsc` como rede — apanhou os quatro casos que não eram mecânicos (o
  `recordStyles` partilhado por 8 vistas, o `ICON_MAP` de módulo do
  `RouteMarker`, o `ErrorBoundary` que é classe e não pode ter hooks, e um
  import falhado).
- **O `colors` estático foi apagado.** Era o caminho mais curto e prendia quem o
  usasse ao tema claro.
- ✅ Testes de guarda (`theme.test.ts`): as duas paletas têm as mesmas chaves,
  não são a mesma paleta duas vezes, e nenhum ficheiro importa uma paleta fixa.

Duas correções que vieram no mesmo pacote:

- `app.json` tinha `userInterfaceStyle: "light"`, o que faz o `useColorScheme()`
  responder sempre "claro". Passou a `"automatic"` — sem isto a preferência
  'sistema' nunca escureceria, e o motivo não estaria à vista no código.
- `loadSettings()` só era chamado ao abrir o ecrã de Definições. A app arrancava
  sempre em claro e só mudava depois de lá passar. Passou para o `_layout`.

**Encontrado e corrigido na primeira passagem visual:** com o tema escuro
escolhido na app e o telemóvel em claro, apareciam réstias brancas nos cantos
arredondados de cima do ecrã de escolher rota. É um `Modal` com
`presentationStyle="pageSheet"`, e a máscara arredondada da folha deixa à vista
o fundo que o iOS desenha por baixo — que continuava claro, porque o sistema não
sabia da escolha feita dentro da app. `Appearance.setColorScheme()` no
`_layout` passa a preferência ao nível nativo, o que arruma também o teclado, os
alertas e as barras de scroll.

**Falta o resto da passagem visual.** O `tsc` garante que compila e os testes que a
paleta está coerente; nenhum dos dois vê um cinzento que ficou ilegível. Vale a
pena percorrer os ecrãs em escuro — sobretudo mapa, gravação e feed, que são os
que mais misturam cor de marca com fotografia.

**Encontrado de caminho, e por decidir:** no tema **claro**, o verde da marca dá
**2,69:1** contra o fundo, e o branco sobre o verde dá **2,81:1** — ambos abaixo
do mínimo AA (4,5:1 para texto, 3:1 para elementos). O modo escuro não tem esse
problema porque o verde subiu. Corrigir no claro é mexer na cor da marca, e isso
não é decisão técnica.

### 3.13 Alinhamento com o SDK 57 (22 ago) ✅

`expo-doctor` a **21/21**, vindo de 19 pacotes fora das versões do SDK e da
regressão de memória do Hermes V1. Manutenção pura — zero alterações de código
da app.

O alvo já não era o `57.0.9` que estava aqui escrito a 20 de agosto: entretanto
passou a **`57.0.15`**.

| | antes | depois |
|---|---|---|
| `expo` | 57.0.7 | **57.0.15** |
| `expo-router` | 57.0.7 | 57.0.15 |
| `expo-notifications` | 57.0.7 | 57.0.13 |
| `expo-location` / `expo-task-manager` | 57.0.5 | 57.0.12 |
| `expo-image-picker` | 57.0.6 | 57.0.12 |
| `expo-dev-client` / `expo-sharing` | 57.0.9 / 57.0.8 | 57.0.14 |
| `expo-auth-session` | 57.0.4 | 57.0.8 |
| `expo-linking` | 57.0.3 | 57.0.7 |
| `react-native` | 0.86.0 | 0.86.2 |
| `react-native-reanimated` | 4.5.0 | 4.5.1 |
| `react-native-worklets` | 0.10.0 | 0.10.1 |
| `jest-expo` | 57.0.3 | 57.0.4 |
| **`react`** | 19.2.8 | **19.2.3 — desceu** |
| `react-dom` | (transitivo) | 19.2.3, agora direto |

**O `react` desceu de propósito.** O Expo fixa o React ao SDK; ter uma versão
mais alta não é estar à frente, é estar fora do combinado — os módulos nativos
foram compilados contra a 19.2.3.

**Duas armadilhas, para quando isto se repetir no SDK 58:**

1. **O `expo install --fix` estoira à primeira.** Atualiza o próprio `expo`, o
   CLI é substituído a meio da execução e deixa de se encontrar a si mesmo
   (`applyPlugins.js`, erro de resolução de módulo). Não é o projeto — **é
   correr outra vez**, agora com o CLI novo.
2. **O `react-dom` fica para trás e bloqueia o npm.** Era transitivo, preso no
   19.2.8, e passou a exigir um `react` que já não existia — `ERESOLVE`. Como o
   projeto também tem alvo web (`npm run web`), a solução certa não é forçar com
   `--legacy-peer-deps`, é `npx expo install react-dom`, que o promove a
   dependência direta com a versão do SDK.

**Verificado, e não só com testes:** `expo-doctor` 21/21, `tsc --noEmit` limpo,
392 testes a passar, e um `expo export --platform android` a gerar 8,6 MB de
bytecode Hermes. Esta última é a que conta — o Jest não usa o Metro, portanto
uma resolução de módulos partida passaria despercebida aos testes.

⚠️ **Por confirmar em dispositivo.** Um bundle que gera não é uma app que
arranca. Como o `react-native` mudou de patch e há módulos nativos pelo meio,
o próximo build de EAS é que fecha esta secção.

---

### 3.12 Infraestrutura de subscrição
- Migração `042_subscriptions.sql` cria a canalização (tabelas + `has_entitlement()` no servidor)
- `usePremium()` com a lista de funcionalidades premium num sítio só
- ✅ Coberto por testes (`subscription.test.ts`)
- ⚠️ **Não cobra nada** — a canalização está construída e desligada, ver secção 4.6

---

## 4. O que falta fazer

### 4.1 Sincronização com a Saúde — ✅ validada no simulador (18 ago 2026)

**Deixou de ser código nunca executado.** Corrido no simulador iOS com o `devSeed`:

> **3 importados, 2 descartados. Segunda sincronização: zero.**

E, a seguir, desinstalada e reinstalada de raiz — com novo login e nova autorização do HealthKit:

> **Sincronização após reinstalação: zero importados.**

Isto valida o **caminho de leitura inteiro** — assinatura da query, nomes dos campos, os enums numéricos de modalidade, o desembrulhar dos `Quantity`, as datas, a deduplicação por `external_id` e a escrita na base de dados. Fecha os casos **1, 3, 5, 6 e 7** do README do módulo, mais o filtro de treinos curtos.

O caso 7 é o de maior consequência para o utilizador: prova que a marca de "já importei isto" vive no **servidor** (`health_sync_state`), não no telemóvel. Quem trocar de telemóvel ou reinstalar não fica com o histórico duplicado.

**O que continua por verificar:**

| Caso | Estado |
|---|---|
| 2 — recusar a permissão | ⚠️ **não é detetável em iOS** — reescrito e mitigado, ver 4.1.1 |
| 4 — app e relógio a gravar o mesmo treino | ❌ **exige relógio real**; depende da sobreposição temporal, e os treinos do `devSeed` têm `sourceApp` da própria app |
| 8 — negar só os treinos em iOS | ⏳ mesma limitação do caso 2 |
| 9 — Android sem Health Connect | ⏳ exige Android |

#### 4.1.1 Bug encontrado e corrigido: `hasPermissions()` mentia (18 ago 2026)

Ao preparar o caso 2, a leitura do código revelou um defeito real:

```js
const amostra = await HealthKit.queryWorkoutSamples({ limit: 1 });
return Array.isArray(amostra);   // true SEMPRE
```

Sem permissão, o HealthKit devolve **lista vazia, sem erro** — e uma lista vazia continua a ser um array. A função devolvia `true` mesmo a quem **nunca tinha sido perguntado nada**. Era o defeito do stub antigo por outra via, no código que o substituiu.

**Corrigido** para `getRequestStatusForAuthorization(...) === unnecessary`, que distingue "ainda falta perguntar" de "já foi perguntado".

**O que continua impossível, e porquê.** A Apple esconde de propósito o estado das permissões de **leitura**, para não se poder inferir que alguém escondeu um tipo de dados. `getRequestStatusForAuthorization` devolve `unnecessary` assim que o diálogo aparece, tenha o utilizador aceitado ou recusado; `authorizationStatusFor` só vale para escrita. Quem concede e depois revoga é indistinguível de quem não tem treinos.

**Mitigação na interface:** quando uma sincronização não importa **nem** descarta nada, não se leu um único treino — aí aparece a dica `health_sync_check_permissions`. Se algo foi descartado, houve leitura e a permissão está boa, e a dica não aparece.

O módulo `src/services/health/` tem os nomes de campos e assinaturas verificados contra as tipagens reais, e a lógica de deduplicação e mapeamento tem 22 testes.

O `src/services/health/README.md` tem 9 casos por testar em dispositivo. Os críticos:
1. Primeira ligação → concede permissão → importa os últimos 30 dias
2. **Recusar a permissão** → `isConnected` tem de ficar `false`
3. **Sincronizar duas vezes seguidas** → a segunda tem de importar **zero**
4. **Gravar na app com o relógio a gravar também** → só deve aparecer **uma** atividade (o id externo não apanha este caso; depende da sobreposição temporal)
5. Treino sem distância (ioga, musculação) → entra com `distance: 0`, sem dividir por zero
6. Android sem Health Connect instalado → `isAvailable()` deve dar `false`

Pendências dentro do próprio módulo:
- ✅ **Frequência cardíaca** — feita a 19 ago (migração **046**). Lida do HealthKit (`getStatistic`), do Health Connect (registo `HeartRate` separado, repartido pelos treinos por intervalo) e de ficheiros GPX/TCX
- **Distância no Health Connect** — vive num registo separado do `ExerciseSession`; hoje fica a zero
- **Escrever treinos de volta na Saúde** — a app ainda não devolve o que grava

**Como testar isto sem pagar a conta da Apple** (corrigido a 17 ago 2026):

O **simulador de iOS não exige provisioning profile** — o code signing não é imposto. Logo a capability de HealthKit funciona lá **com Apple ID grátis**. O bloqueio da conta paga aplica-se ao **iPhone físico**, não ao simulador.

Duas ressalvas que mudam o procedimento:

1. **A app Saúde não deixa acrescentar treinos à mão.** Inserir métricas manuais (passos, FC, distância) funciona, mas o módulo importa **treinos** (`HKWorkout`), e esses não se criam pela app Saúde. Também não há comando `simctl` para injetar dados de saúde, e o simulador de watchOS tem um armazém de HealthKit separado que não sincroniza com o do iPhone simulado.
2. **A solução já está escrita:** `src/services/health/devSeed.ts` faz a app escrever cinco treinos no HealthKit — corrida, bicicleta, ioga sem distância, tiro com arco (modalidade não mapeada) e uma corrida de 30 s (curta demais). A composição cobre de propósito os casos do README. Está ligado às Definições via `health.seedAndSync()`.

⚠️ **`devSeed` só corre em `__DEV__`** — exige build **Debug** no simulador, não Release.

Para testar em iOS:
```bash
# 1. Repor o entitlement de HealthKit (foi removido para o build no iPhone físico)
#    ios/CadenceClub/CadenceClub.entitlements  →  repor as duas chaves
#    ou simplesmente:  npx expo prebuild
# 2. Build Debug no simulador
npx expo run:ios
# 3. Na app: Definições → Rastreamento e dispositivos → semear e sincronizar
```

**O que o simulador prova:** o caminho de leitura inteiro — assinatura da query, nomes dos campos, os enums numéricos de modalidade, o desembrulhar dos `Quantity`, as datas, a deduplicação e a escrita na base de dados.

**O que não prova:** os dados que um relógio a sério produz. Um treino escrito por nós tem `sourceApp` desta app e não do relógio, não traz a metadata de elevação do Watch, e não exercita o `recordedByUs` no sentido correto. Para isso é mesmo preciso dispositivo com relógio — e aí sim, conta paga.

Em **Android não há bloqueio nenhum** — o Health Connect testa-se com o APK do EAS num telemóvel real.

### 4.5 Importação de ficheiros — completa (20 ago 2026) ✅

**Fase 2 feita:** FIT e o arquivo `.zip` do Strava. A fase 1 (GPX e TCX, um
ficheiro de cada vez) é de 18 ago.

**FIT.** É o que o Strava exporta para tudo o que foi gravado num dispositivo —
e, num arquivo, a maioria dos ficheiros. Lido com o SDK oficial da Garmin, que
trabalha sobre `Uint8Array` e não puxa nada do Node.

⚠️ **A armadilha:** ler um FIT com `text()` corrompe-o em silêncio, porque os
seus bytes não são UTF-8 válido, e o sintoma é "ficheiro malformado" sem pista
da causa. É por isso que o `importTrackFile` passou a aceitar `string |
Uint8Array` e que existem os motivos de falha `needs_bytes` / `needs_text`. Há
um teste com o mesmo ficheiro lido das duas formas.

Coordenadas vêm em **semicírculos**, não em graus — o teste ancora a conversão
em Lisboa, para um erro de fator qualquer cair no oceano. Registos sem posição
são ignorados: um relógio grava batimento entre fixes de GPS.

**Arquivo do Strava.** Cada atividade vem **comprimida duas vezes**:
`activities/1234.fit.gz`, gzip dentro do zip. Um leitor de zip normal devolve
bytes ainda gzipados e o parser recebe lixo.

Duas restrições reais, e como foram resolvidas:

- **Memória.** Expandir 2000 atividades de uma vez rebenta num telemóvel. O
  `unzipSync` do fflate aceita um filtro, e é usado **em lotes de 25** — o que
  está expandido a cada momento são 25 ficheiros, e o resto continua comprimido.
- **Rede.** Uma consulta de janela por ficheiro seriam 2000 consultas em série.
  Passou a ser **uma só**: as janelas são lidas uma vez e crescem em memória à
  medida que as atividades entram — o que também faz a deduplicação funcionar
  *dentro* do próprio arquivo, onde os duplicados são comuns.

Um ficheiro estragado no meio de 2000 não para a importação, e as falhas são
contadas **por motivo** — num arquivo do Strava é normal haver dezenas sem
traçado (treinos de ginásio à mão), e isso é informação, não erro.

Dá para interromper: o que já entrou fica.

✅ 12 testes novos (`importArchive.test.ts`), com o zip construído no próprio
teste — incluindo o duplo gzip, a pasta `__MACOSX` e a deduplicação dentro do
arquivo. Mais 6 do FIT. **392 no total.**

**Por testar num dispositivo:** um arquivo do Strava a sério. Os testes usam
zips de três ficheiros; o comportamento com centenas, e o consumo de memória a
segurar o zip inteiro, só se vê com um arquivo real.

### 4.5.1 Fase 1 — o que já existia (18 ago 2026)

`src/services/import/` lê **GPX e TCX**, um ficheiro de cada vez.
**Definições → Rastreamento e dispositivos → Importar ficheiro.**

**O que reaproveita.** Um ficheiro é convertido em `ExternalWorkout` e entregue ao `planImport` do módulo de saúde — que já sabe deduplicar (id externo + sobreposição temporal), mapear modalidades e descartar treinos curtos. Essa parte tem 22 testes e foi validada em simulador; não foi reescrita.

**O que acrescenta.** O traçado. A sincronização com a Saúde nunca traz pontos de GPS (ficam no relógio), por isso as atividades vindas de lá não têm mapa, splits nem deteção de troços. Um GPX traz os pontos todos → `route_summary` **e** `activity_points` ficam preenchidos, e a atividade fica tão completa como uma gravada na app. Também passa a estar sujeita às zonas de privacidade, que é o comportamento certo.

| Peça | Ficheiro |
|---|---|
| Leitores | `parseGpx.ts`, `parseTcx.ts` (via `fast-xml-parser` — JS puro, não há DOM em RN) |
| Derivações | `track.ts` — distância, desnível com limiar de 3 m, resumo do percurso |
| Orquestração | `importFile.ts` — deteção de formato, hash do conteúdo, dedup, escrita |
| Seletor | `pickAndImport.ts` (`expo-document-picker`, carregado com `require()` dentro de `try`) |
| Base de dados | `supabase/migrations/044_import_sources.sql` |

**Decisões que valem a pena reter:**
- **`external_id` é o hash SHA-256 do conteúdo**, prefixado com `file:`. Pelo nome não dava — o Strava numera as exportações e o mesmo treino sai com nomes diferentes. Assim, reimportar o mesmo ficheiro é apanhado pela defesa que já existia.
- **Distância declarada ganha à calculada.** O TCX traz `DistanceMeters` por volta; quem gravou tinha roda ou passada, não só coordenadas.
- **Sem modalidade declarada assume-se corrida.** Descartar por falta de etiqueta custaria a atividade toda.
- **Sem tempos é rota, não treino** — rejeitado com motivo próprio (`no_timestamps`), em vez de entrar com duração zero.
- **Importado entra privado.** Importar não é publicar.
- **Um ponto corrompido não custa o ficheiro todo** — salta-se o ponto.

⚠️ **`expo-document-picker` é módulo nativo: exige rebuild** antes de a linha funcionar.

**Testes:** 29 novos (`track.test.ts`, `parsers.test.ts`), com os pontos ao longo de um meridiano para dar distâncias exactas.

**Falta para cumprir o objetivo do roadmap:**
- **FIT** — a exportação em massa do Strava traz sobretudo `.fit` para atividades gravadas com relógio; só as gravadas na app deles saem em `.gpx`. Sem FIT, um utilizador de Garmin importa pouco
- **Lote a partir do `.zip`** — ninguém com 500 atividades as importa uma a uma. Precisa de `fflate` (o zip traz `.gz` lá dentro), progresso e retoma

*(A API do Strava não é caminho: os termos proíbem uso por apps concorrentes e já cortaram acesso a quem o fez. O `.zip` de exportação é a via limpa, porque são os dados do próprio utilizador.)*

### 4.6 Monetização — canalização construída e **desligada** (18 ago 2026) 🔌

Tudo escrito, nada ativo. Liga-se com **um `UPDATE`**, sem publicar app nova:

```sql
UPDATE public.app_flags SET enabled = true, updated_at = now()
WHERE key = 'premium_gating';
```

| Peça | Onde | Estado |
|---|---|---|
| Limites impostos no servidor | `migrations/045_premium_gating.sql` | ⚠️ por aplicar |
| Webhook do RevenueCat | `functions/revenuecat-webhook/` | por publicar |
| SDK de compras | `src/services/purchases/` | inerte sem chaves |
| Paywall | `src/app/premium.tsx` | pronto |
| `can()` a ler o estado real | `src/hooks/usePremium.ts` | ✅ ligado à flag |

**Porquê RevenueCat.** Grátis até 2500 USD/mês de receita, 1% acima. Trata da validação de recibos contra a Apple e a Google, renovações, períodos de graça e reembolsos — a parte que mais costuma correr mal e que é toda servidor. Aceita o Stripe como fonte, o que junta app e site num só sistema de direitos.

**O que o servidor impõe, e o que não pode impor.** Vista 3D, estilos de mapa e exportação são renderização no cliente: nenhum servidor os consegue bloquear, e fingir que sim seria pior. A migração 045 impõe só o que é acesso a dados — tendências (limita a janela de meses), histórico de troços (limita o `LIMIT`) e fotos (trigger no `INSERT`). Um cliente modificado não passa por cima destes três.

**Quem escreve o quê.** A app **nunca** escreve em `subscriptions` — se escrevesse, bastava um cliente alterado para se dar premium. O webhook escreve com a service role; a app lê. O `event_id` é UNIQUE, por isso uma reentrega do RevenueCat é ignorada em vez de processada duas vezes.

**Falhar deixa a app aberta.** Não conseguir ler a flag devolve "gating desligado". O contrário transformava uma falha de rede num paywall para toda a gente — e os limites reais estão no servidor de qualquer forma. Há quatro testes só sobre isto.

#### Falta, e depende de contas pagas
1. **Conta Apple Developer** (99 USD/ano) e **Play Console** (25 USD, uma vez). Sem elas não há produtos, nem sandbox, nem forma de testar
2. Criar os produtos no App Store Connect / Play Console e ligá-los ao RevenueCat
3. `npx expo install react-native-purchases` + **rebuild** (é nativo)
4. `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `_ANDROID_KEY` no `.env`
5. Publicar a edge function e pôr `REVENUECAT_WEBHOOK_SECRET`
6. **Decidir o preço** — a fazer com dados, não a adivinhar: os eventos `paywall_viewed` e `premium_purchased` dão a conversão

⚠️ **Ordem que interessa:** aplicar a 045 **antes** de ligar a flag. Aplicar a migração não muda nada visível — é a flag que liga.

### 4.2 Monetização — a app não cobra nada ⚠️

Dos três motivos que puseram o paywall em espera em agosto, **dois já caíram**:

| Bloqueio original | Estado |
|---|---|
| `useHealthKit` era um stub que dizia "ligado" sem fazer nada | ✅ **Resolvido** — substituído pelo módulo `services/health/` real |
| PostHog montado mas sem uma única chamada a `capture()` | ✅ **Resolvido** — 15 eventos instrumentados. Falta a chave (ver 3.11): sem ela não há retenção, e sem retenção não se decide preço |
| O premium acordado é quase todo funcionalidade que já existe e já é grátis | ⚠️ **Continua** |

**Corrigido a 19 ago — o SDK de compras nunca era ligado à conta.** O
`services/purchases/configure()` existia e não era chamado de lado nenhum, e o
`identifyUser()` do PostHog só era chamado no arranque e no registo — nunca na
entrada por email, Google ou Apple. Não era cosmético: sem `configure()`, o
RevenueCat inventa um `appUserID` anónimo, e o webhook recusa — corretamente —
ligar essa compra a uma conta (`uuidValido()`). Traduzido: no dia em que as
compras ligassem, havia quem pagasse e não recebesse nada, com o registo da
compra a apontar para ninguém.

- `src/services/session.ts` — `onSessionStarted()` / `onSessionEnded()`, um par
  só, chamado nos **seis** caminhos que estabelecem sessão
- ✅ Teste de guarda (`session.test.ts`): qualquer `set({ session })` no
  `authStore` sem aviso aos serviços externos falha, com o número da linha. É o
  que protege o sétimo caminho de entrada, que ainda não existe

O que falta concretamente:
- ❌ **`react-native-purchases` por instalar.** É dependência nativa: obriga a
  rebuild e só se pode testar com conta paga da Apple. Deliberadamente adiado —
  o resto do código já degrada em silêncio sem ele (`isAvailable()` devolve
  false e o paywall diz `premium_not_configured` em vez de mostrar um botão que
  não faz nada)
- ❌ **Conta RevenueCat + chaves** `EXPO_PUBLIC_REVENUECAT_IOS_KEY` /
  `_ANDROID_KEY`, e o `REVENUECAT_WEBHOOK_SECRET` no Supabase
- ❌ **Produtos criados nas lojas.** Depende da conta Apple Developer paga
  (99 USD/ano), que continua por decidir — ver passo 7 da secção 8
- ⏸️ **Flag `premium_gating` a `false`**, de propósito. É o último interruptor,
  e liga-se com um UPDATE — sem migração nem versão nova da app
- ⚠️ **`signed_up` só dispara com `method: 'email'`.** O Google e a Apple não o
  registam, apesar de o tipo os prever. Distinguir registo de entrada nesses
  fluxos exige uma heurística (não há perfil = é novo), por isso ficou por
  decidir em vez de ficar por adivinhar

**Já feito, ao contrário do que esta secção dizia antes:** a migração de gating
existe (`045_premium_gating.sql`, com tendências, troços e fotos impostos no
servidor), e o `usePremium().can()` já respeita a flag em vez de devolver
sempre `true`.

**A regra que manda:** o Stripe **não pode** cobrar a subscrição dentro da app (App Store 3.1.1 + política do Google Play obrigam a IAP para conteúdo digital consumido na app). O Stripe fica para o site, eventos presenciais pagos e planos B2B. O RevenueCat aceita o Stripe como fonte, por isso os dois convivem num só sistema de direitos de acesso.

**Divisão acordada:**
- **Premium:** vista 3D e relevo, estilos de mapa satélite/ar livre, tendências além de 3 meses, histórico completo de troços, galeria acima de 2 fotos, exportação de dados
- **Nunca pago:** gravar atividades, zonas de privacidade (é segurança), fila offline, e **todo o social** (feed, seguir, comentar, clubes) — numa app social os utilizadores gratuitos são o valor que os pagantes compram

### 4.3 Base de dados — confirmar migrações aplicadas ⚠️
As migrações **não são aplicadas automaticamente** — são coladas à mão no SQL Editor do Supabase. O CLI está *linked* mas **sem access token** (`supabase login` não foi feito), por isso não dá para consultar a base de dados a partir do código.

**Ficheiro de diagnóstico:** `supabase/VERIFICAR_MIGRACOES.sql` — colar no SQL Editor. Devolve uma linha por objeto, com `APLICADA` ou `EM FALTA`.

### ✅ RESOLVIDO — 042 e 043 aplicadas e completas (18 ago 2026)

O `VERIFICAR_MIGRACOES.sql` devolveu **`APLICADA` em todos os objetos**. Confirmado individualmente:

| Migração | Objetos confirmados |
|---|---|
| `042_subscriptions` | enums `subscription_store` e `subscription_status`, tabelas `subscriptions` e `subscription_events`, índice `subscriptions_user_idx`, policy `subscriptions_select_own`, função `has_entitlement()` |
| `043_health_sync` | tabela `health_sync_state` com as 3 policies, índice `activities_user_start_idx`, coluna `activities.external_id` |

**Nenhuma migração por aplicar.** A base de dados está alinhada com o código.

Nota: as migrações **não são idempotentes** — re-correr um ficheiro inteiro rebenta sempre com `42710 (already exists)`, porque `CREATE TYPE` e `CREATE POLICY` não aceitam `IF NOT EXISTS`. Isso é ruído, não erro. Para diagnosticar, usar o `VERIFICAR_MIGRACOES.sql`, que testa cada objeto sem escrever nada.

Nota: as migrações **não são idempotentes**. `CREATE TYPE` e `CREATE POLICY` não aceitam `IF NOT EXISTS`, por isso re-correr um ficheiro inteiro rebenta sempre. Se isso incomodar no futuro, envolve-se cada um em `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`.

**Migração `025` — investigado a 17 ago 2026:** ✅ não é problema. Não há qualquer referência a `025` em nenhuma migração, e a `026` é auto-contida (começa por remover a constraint de `goal` que a `024` deixou). É apenas um salto na numeração, não uma migração perdida.

### 4.4 Pontas soltas pequenas
- ✅ **`src/services/healthSync.ts` apagado** (17 ago 2026). Era um stub antigo com `TODO`, sem um único importador, substituído por `services/health/`. Typecheck e os 263 testes continuam verdes depois de remover.
- ✅ **Meta App ID metido** (18 ago 2026) — `FB_APP_ID = "1895867934721207"` em `useShareActivity.ts`. Vale para iOS (URL scheme) e Android (intent). O `LSApplicationQueriesSchemes: ['instagram-stories']` já estava no `app.json` e no `Info.plist`. **Não precisa de App Review** — o `source_application` é um handoff, não uma chamada à Graph API, por isso a app Meta pode ficar em modo Development. ⏳ **Por testar:** exige o Instagram instalado num dispositivo real; no simulador o `canOpenURL` falha.
- ⚠️ **`readAsStringAsync` está deprecado** em `useShareActivity.ts:50-51` (mudança de API do `expo-file-system` no SDK 57). Ainda funciona, mas vai partir numa atualização futura. Não é urgente.
- ✅ **`src/services/healthSync.ts` apagado** — ver acima.

---

## 5. Build para iPhone — como se faz (17 ago 2026)

Ficou a funcionar, mas o caminho óbvio (`npx expo run:ios`) **não chega lá sozinho**. Registo do que foi preciso.

### 5.1 Contexto
- Apple ID **grátis** (Personal Team `D3JGVV6Q2M`, identidade `Apple Development: akcelmedico@gmail.com`)
- Conta grátis obriga a **build local** — o EAS precisa de conta paga para provisionar dispositivos
- iPhone 15 em iOS 27.0, Xcode 26.6

### 5.2 Os dois obstáculos
1. **`Device is busy (Preparing iPhone de akcel)`** — o Xcode estava a copiar os símbolos do iOS 27 para o `DeviceSupport`. Resolveu-se sozinho com o tempo. Não há atalho: esperar.
2. **`No profiles for 'com.akcelgraca.cadence' were found`** — o `expo run:ios` **não passa `-allowProvisioningUpdates`**, que é o que autoriza o Xcode a registar o bundle ID na Personal Team e gerar o perfil. Contornado chamando o `xcodebuild` diretamente.

### 5.3 Os comandos que funcionaram
```bash
# 1. Remover o entitlement de HealthKit (Personal Teams não o suportam)
#    ficheiro: ios/CadenceClub/CadenceClub.entitlements  →  <dict></dict>

# 2. Build assinado
cd ios && xcodebuild \
  -workspace CadenceClub.xcworkspace \
  -scheme CadenceClub \
  -configuration Release \
  -destination "id=00008120-001A60640244A01E" \
  -allowProvisioningUpdates \
  -derivedDataPath ~/Library/Developer/Xcode/DerivedData/CadenceClub-manual \
  build

# 3. Instalar no iPhone
xcrun devicectl device install app \
  --device 00008120-001A60640244A01E \
  ~/Library/Developer/Xcode/DerivedData/CadenceClub-manual/Build/Products/Release-iphoneos/CadenceClub.app
```

Agora que o perfil existe, `npx expo run:ios --device 00008120-001A60640244A01E` provavelmente já funciona direto.

**No iPhone, uma vez só:** Definições → Geral → VPN e Gestão de Dispositivos → `akcelmedico@gmail.com` → **Confiar**.

### 5.4 Limitações desta build
- **Expira em 7 dias** (limite do free provisioning) — depois disso não abre e é preciso repetir o build
- **HealthKit não funciona** — entitlement removido
- **Push remoto não funciona** (Personal Teams não suportam `aps-environment`). Notificações locais sim.
- ⚠️ **Se correres `npx expo prebuild`, o HealthKit volta** ao entitlements e o build parte outra vez. A remoção é local ao `ios/`; o plugin no `app.json` está intacto.

### 5.5 Nota sobre o Mac
O build de 14 ago tinha falhado por **disco cheio** (`No space left on device`), não por código. O disco esteve a 99% (3,6 GB livres de 228 GB). Vale a pena manter margem — um build de iOS come vários GB em `DerivedData`.

### 5.6 Android
Todos os builds anteriores foram **Android APK via EAS, perfil `preview`** — o último a 1 ago, do commit `67bf1a79`, já desatualizado. Para Android não há a limitação da Apple:
```bash
eas build --platform android --profile preview
```

---

## 6. Lacunas face ao Strava

> Análise de produto, não verificação técnica.

### 6.1 Onde o Cadence Club já está ao nível
Gravação GPS, feed social, clubes, segments, rotas, registos pessoais, distintivos, planos de treino, sincronização com relógios. A paridade de funcionalidades base **está lá**.

### 6.2 Onde falta
| Lacuna | Peso |
|---|---|
| **Importar do Strava/Garmin/Polar** — sem isto, mudar de app custa ao utilizador todo o histórico. É a barreira número um à adoção | 🔴 Alto |
| **Ficheiros GPX/FIT** — importar e exportar. Padrão da indústria; a sua ausência prende o utilizador e afasta os sérios | 🔴 Alto |
| **Ligação a relógios além da app de Saúde** — Garmin Connect, Wahoo, Coros. Hoje só via Apple Saúde / Health Connect | 🟠 Médio |
| **Tabelas de classificação de segments** (KOM/QOM) — os segments existem, mas a competição à volta deles é o que vicia no Strava | 🟠 Médio |
| **Análise de treino** — zonas de FC, potência, carga, forma. Precisa da coluna de FC (secção 4.1) | 🟠 Médio |
| **Web app** — o Strava vive tanto no browser como no telemóvel | 🟡 Baixo (por agora) |

### 6.3 Onde pode ganhar
- **Mercado português** — conteúdo, eventos e clubes locais, tudo em PT nativo. O Strava é genérico
- **Zonas de privacidade a sério e grátis** — o Strava já teve escândalos de privacidade; posicionar isto como princípio, não como funcionalidade
- **Eventos presenciais pagos** — via Stripe (serviços do mundo real estão fora da regra de IAP). Receita que o Strava não persegue no mercado PT
- **Social gratuito por decisão** — enquanto o Strava fecha o social atrás do pago, a estratégia oposta é uma cunha real

---

## 7. Dívida técnica e armadilhas conhecidas

Coisas já mordidas, para não se repetirem:

- **RLS com subqueries à própria tabela → recursão 42P17.** Referências não qualificadas (`id`, `conversation_id`) resolvem para a tabela interior. Usar funções `SECURITY DEFINER` + colunas qualificadas (padrão nas migrações 028/033/034)
- **Joins PostgREST com 2 FKs para a mesma tabela** precisam de hint explícito: `profiles!tabela_col_fkey`
- **`member_count` de clubes é mantido por trigger** — nunca incrementar manualmente no cliente
- **Dedup de treinos precisa de duas defesas:** `external_id` (mesma sincronização repetida) **e** sobreposição temporal (mesmo treino gravado na app e no relógio, com ids diferentes). Só a primeira não chega
- **Ao traduzir, cuidado com frases montadas por concatenação** — em inglês a ordem muda. Usar uma chave interpolada inteira (ver `segment_new_range`)
- **App só tem tema claro** — `useColors()` devolve sempre `lightColors`
- **Correr `tsc --noEmit` a partir de `apps/mobile`** — a partir da raiz apanha um `tsc` npm falso

---

## 8. Próximos passos, por ordem

### Imediato (limpeza, minutos) — ✅ CONCLUÍDO
1. ✅ `src/services/healthSync.ts` apagado
2. ✅ Migrações verificadas — **042 e 043 aplicadas e completas**; a **025** é só um salto na numeração
3. ✅ Meta App ID metido, e build com ele instalada no iPhone

### ✅ Analytics a recolher (20 ago)
A `EXPO_PUBLIC_POSTHOG_KEY` está preenchida, validada contra o `eu.i.posthog.com`
(`npm run analytics:check` devolve OK), presente no `eas.json` para os perfis
`preview` e `production`, **e dentro da build instalada no iPhone**. O relógio
dos 30 dias de retenção está a contar a partir de hoje.

### O que bloqueia mais coisas ao mesmo tempo
**A conta Apple Developer paga (99 USD/ano)** deixou de ser uma decisão isolada
e passou a ser o único item com semanas de espera. Bloqueia, em simultâneo:

- **push remoto no iOS** — sem `aps-environment` não há entrega, e é por isso
  que as notificações da migração 047 não se conseguem testar no telemóvel
- **HealthKit no iPhone físico** — logo, a frequência cardíaca vinda do Watch
- **produtos nas lojas** — logo, toda a monetização
- **builds que não expiram em 7 dias** — a atual expira a **25 ago**

Tudo o resto é código, e código faz-se a qualquer momento. Isto não.

**O FCM não é alternativa à conta Apple — é a outra metade.** Os documentos do
Expo são explícitos: *"For Android, you need to configure Firebase Cloud
Messaging (FCM)"* e *"A paid Apple Developer Account is required to generate
credentials"* (iOS). Uma por plataforma, e nenhuma substitui a outra:

| Plataforma | Credencial | Custo |
|---|---|---|
| iOS | conta Apple Developer paga + chave APNs | 99 USD/ano |
| Android | projeto Firebase + `google-services.json` + chave de serviço no Expo | grátis |

Como esta app se destina às duas lojas — e todos os builds anteriores foram
Android APK via EAS — **as duas vão ser precisas**. A conta Apple não dispensa
o FCM.

Onde o FCM é de facto alternativa é **só para testar agora**: serve para provar
que o encadeamento funciona (gatilho → linha em `notifications` → edge function
→ Expo → telemóvel) sem esperar pela Apple. Prova-o num Android, não no iPhone.
Ver 3.2.1.

### Curto prazo (validação)
4. **Testar a app instalada no iPhone** — tudo o que foi construído desde 1 de agosto (segments, zonas de privacidade, fila offline, fotos, analytics, partilha) está pela primeira vez num telemóvel
5. **Testar a sincronização de saúde no simulador iOS** — repor o entitlement, `npx expo run:ios` (Debug), e usar o `devSeed` pelas Definições. Cobre os casos 1, 2, 3, 5 e 6 do README do módulo, sem custar nada (ver secção 4.1)
6. **Build Android via EAS** e correr os mesmos casos no Health Connect, num telemóvel real
7. Decidir sobre a **conta Apple Developer paga** (99 USD/ano). Obrigatória apenas para: HealthKit **no iPhone físico**, push remoto, TestFlight, e builds que não expiram em 7 dias. **Não** é precisa para validar a lógica de saúde — o simulador chega

### Médio prazo (produto)
8. **Importação de ficheiros** — 🚧 **fase 1 feita (GPX + TCX, um ficheiro)**, ver 4.5. Falta FIT e importação em lote do `.zip` do Strava, que é o que cumpre mesmo a migração
9. ✅ **Frequência cardíaca** feita (19 ago). Falta a **distância no Health Connect**, que tem o mesmo problema: vive num registo à parte
10. Ligar a **monetização**: escolher IAP/RevenueCat, escrever a migração de gating, trocar o `can()` por `state.isPremium`

### Antes de qualquer lançamento
10b. ✅ **SMTP próprio — feito a 21 ago.** Resend + `cadenceclub.pt`, cinco registos seguidos em 200. Ver 3.2.7 e `supabase/SMTP.md`. Sobra uma ponta: confirmar no emulador Android que o link do email abre a app
11. **Criar o projeto PostHog (EU Cloud) e colar a chave no `.env` e no `eas.json`.** É o passo mais barato da lista e o que mais custa adiar: a retenção a 30 dias precisa de 30 dias de calendário, e o relógio só arranca no dia em que o primeiro evento chega. Confirmar com `npm run analytics:check`. Tudo o resto do lado do código já está feito (ver 3.11)
12. Recolher dados de retenção com o PostHog **antes** de decidir preços — a instrumentação já está lá, falta o tempo a correr

---

## 9. Plano de teste no iPhone físico

**Build instalada: 21 ago 2026, 16:07.** Traz a importação FIT e o arquivo do
Strava. Verificada por inspeção do bundle: `import_archive_label`, `parseFit`,
`gunzipSync` e `unzipSync` presentes.

⚠️ **Lição: instalar um pacote com código nativo obriga a `pod install`.** Este
build falhou primeiro com `'React/RCTImageSource.h' file not found` no
`react-native-svg` — sintoma de Pods dessincronizados, e nada a ver com o
`react-native-svg`. A causa foi o **`expo-font`**, instalado horas antes para o
build Android: acrescenta um pod, e o projeto nativo ficou a meio. O `fflate` e
o `@garmin/fitsdk` são JS puro e não contribuíram.

⚠️ **E o `pod install` precisa de locale UTF-8.** Sem ele rebenta em
`String#unicode_normalize`, com um aviso quase escondido no meio do *stack
trace*. O comando que funciona:

```bash
cd ios && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install
```

**Build anterior: 20 ago 2026, 14:41.** Acrescenta os meses do histórico e os
desafios traduzidos. **Precisa da migração 048 aplicada** — sem ela os nomes dos
desafios continuam a vir em português da base de dados, e o `is_collective`
chega `undefined`, o que faz o desafio da comunidade mostrar progresso
individual.

**Build anterior: 20 ago 2026, 14:03.** Acrescenta as unidades do feedback de
voz. Verificada por inspeção do bundle: `voice_mi_plural` e `voice_mi_singular`
presentes.

**Build anterior: 20 ago 2026, 13:34.** Acrescenta as 21 correções de i18n
(abas do Social e do Perfil, meses, locales, tempo relativo, voz). Verificada
por inspeção do bundle: `social_tab_clubs`, `profile_tab_summary`,
`share_card_time`, `time_hours`, `voice_km_plural` e `localeTag` presentes, e
`'Clubes'` e `` `há ${` `` já **não** aparecem em lado nenhum.

**Build anterior: 20 ago 2026, 12:59.** Acrescenta as notificações de clubes,
mensagens e eventos, e os interruptores das Definições que passaram a desligar
alguma coisa. Verificada por inspeção do bundle: `settings_notif_clubs`,
`settings_notif_messages`, `settings_notif_events`, `club_request`,
`club_accepted`, `referenceId` e `notification_prefs` presentes.

**Lição do build:** o `-destination "id=<udid>"` falhou com *"The developer disk
image could not be mounted on this device"*. O iPhone estava ligado por Wi-Fi
(`transportType: localNetwork`), e por aí a imagem de desenvolvimento não monta
de forma fiável. **`-destination "generic/platform=iOS"` resolve** — compila e
assina sem precisar do dispositivo presente, e o `devicectl install` trata do
resto pelo túnel. É o comando a usar por omissão; o do UDID só serve com cabo.

**Build anterior: 20 ago 2026, 02:03.** Inclui tudo o que foi feito a 19 e 20
de agosto: modo escuro, zonas de FC e FC máxima, calorias por modalidade, os
ecrãs que já não ficam sem saída, e a leitura de FC de ficheiros GPX/TCX.
Verificada por inspeção do bundle — `edit_profile_zones_title`, `hr_zone_label`,
`events_city_placeholder` e o verde escuro `9ED42F` estão lá; o `Info.plist`
instalado diz `UIUserInterfaceStyle = Automatic`. **O PostHog continua sem
chave**, portanto esta build não recolhe nada.

Nota do que correu mal: entre 18 e 20 de agosto acumulou-se muito trabalho que
nunca chegou ao telemóvel, porque ninguém correu o build. Sendo Release com JS
embutido, não há recarregamento nem OTA que o alcance — só o `xcodebuild` da
secção 5.3. Vale a pena reconstruir a seguir a cada bloco de trabalho, não ao
fim de dois dias.

**Build anterior: 18 ago 2026, ~16h.** Inclui a importação de ficheiros, a correção das permissões de saúde e a correção do `File.text()`. Verificado por inspeção do bundle (`import_file_label`, `1895867934721207` presentes).
- É Release com JS embutido → **não fala com o Metro**. Alterações de código só chegam cá com novo build; o simulador é que recarrega na hora
- **Sem HealthKit, sem push remoto e sem Sign in with Apple** — os quatro entitlements foram removidos para poder assinar com Personal Team. **Entrar só por email ou Google**
- É Release → **o `devSeed` não existe** (só corre em `__DEV__`)
- ⏰ **Expira a 25 ago 2026** (7 dias do free provisioning)

**Nada do que foi feito a 19 ago está nesta build** — é anterior a tudo, e sendo
Release com JS embutido não há recarregamento que a alcance. Também não há saída
por OTA: o `expo-updates` não está instalado, portanto o único caminho até ao
telemóvel é um build novo.

Antes desse build, duas coisas do lado nativo:

1. **`ios/CadenceClub/Info.plist` tinha `UIUserInterfaceStyle = Light`** — já
   corrigido para `Automatic`. A alteração do `app.json` só produz efeito no
   plist *gerado*, e a pasta `ios/` é local e gitignorada, por isso a correção
   não viaja no repositório: quem clonar tem de correr `expo prebuild`, que
   agora já gera o valor certo. Sem isto, o `useColorScheme()` responde sempre
   "claro" e a opção 'sistema' nunca escurece — por muito que o JS esteja bom.
2. **O `CadenceClub.entitlements` está na configuração de SIMULADOR** (as quatro
   capabilities presentes). Para iPhone físico com Apple ID grátis, esvaziar o
   `dict` primeiro, senão falha na assinatura. É o interruptor manual descrito
   na secção 5.

E mesmo depois do build: o **PostHog continua a não recolher nada** enquanto a
`EXPO_PUBLIC_POSTHOG_KEY` for `phc_COLAR_AQUI`, porque as `EXPO_PUBLIC_*` são
embutidas no momento do build.

### 9.1 Testável agora, sem rebuild
Tudo isto nunca correu num telemóvel — a última build Android é de 1 ago, do commit `67bf1a79`.

| Área | O que confirmar |
|---|---|
| **Gravação GPS** | Traçado no mapa, ritmo, distância, desnível, calorias. Bloquear o ecrã a meio e confirmar que continua a gravar (background) |
| **Zonas de privacidade** | Criar uma zona sobre casa → gravar uma atividade que comece lá → confirmar que o traçado aparece **cortado** |
| **Fila offline** | Modo avião → gravar uma atividade → voltar a ligar → confirmar que sincroniza sozinha e **não duplica** |
| **Segments** | Criar um troço a partir de uma atividade → repetir o percurso → confirmar que deteta a passagem |
| **Fotos** | Anexar fotos a uma atividade (até 6), confirmar upload e galeria |
| **Social** | Feed, boosts, comentários, seguir, clubes, chat de clube, eventos, mensagens diretas |
| **Rotas** | Descobrir, criar no mapa, guardar, direções |
| **Perfil** | PRs, distintivos, streaks, gráficos mensais, equipamento |
| **Plano de treino** | Confirmar que gera a semana a partir do objetivo |
| **i18n** | Mudar o idioma do telemóvel para EN e percorrer os ecrãs à procura de **chaves em bruto** (uma chave em falta não estoira — aparece como texto cru) |
| **Partilha** | Share genérico e guardar na galeria **funcionam**. Instagram Stories **não** — ver 9.2 |
| **Notificações locais** | Lembretes de treino |
| **Auth** | Email, Google, Apple Sign-In |

### 9.2 ✅ Rebuild feito (18 ago 2026, 02:18)
A build instalada já leva o Meta App ID, por isso **o Instagram Stories entra na lista de 9.1**. Exige o Instagram instalado no telemóvel.

Comando, para a próxima vez:
```bash
cd ios && xcodebuild -workspace CadenceClub.xcworkspace -scheme CadenceClub \
  -configuration Release -destination "id=00008120-001A60640244A01E" \
  -allowProvisioningUpdates \
  -derivedDataPath ~/Library/Developer/Xcode/DerivedData/CadenceClub-manual build \
&& xcrun devicectl device install app --device 00008120-001A60640244A01E \
  ~/Library/Developer/Xcode/DerivedData/CadenceClub-manual/Build/Products/Release-iphoneos/CadenceClub.app
```
O relógio dos 7 dias reinicia a cada instalação.

### 9.3 Não testável no iPhone físico sem conta paga
- **Sincronização com a Saúde** — precisa do entitlement de HealthKit. Fazer no **simulador** (secção 4.1)
- **Push remoto** — precisa de `aps-environment`. Notificações locais funcionam

---

## 10. Armadilha: processo zombie no simulador

**Custou uma noite a 18 ago 2026.** Sintoma:

```
Cannot find native module 'ExponentImagePicker'
Failed to get NitroModules: The native "NitroModules" ... could not be found
```

### A causa real
O simulador tinha **duas** instalações da app em containers diferentes:

```
DB4F36C8…  binário de 18 Ago 03:21   ← o build acabado de instalar
67F3A512…  binário de 28 Jul 03:52   ← órfão, três semanas mais velho
```

O processo que estava a correr era o **de julho**. O `expo run:ios` instalou o build novo noutro container, mas nunca matou o processo antigo — e o Metro continuou a servir-lhe JS actualizado. Resultado: código de hoje a correr contra um binário nativo de há três semanas, sem os módulos que entretanto foram acrescentados.

`xcrun simctl terminate` **não resolve**: procura a app *registada* (a nova, que não estava a correr) e responde `found nothing to terminate`. É preciso matar o PID à mão.

### Solução
```bash
# 1. Ver que binário o processo está mesmo a usar
ps aux | grep "CadenceClub.app/CadenceClub" | grep -v grep

# 2. Matar o processo pelo PID (simctl terminate não chega)
kill -9 <PID>

# 3. Apagar o container órfão
rm -rf ~/Library/Developer/CoreSimulator/Devices/<DEVICE>/data/Containers/Bundle/Application/<ORFAO>

# 4. Relançar
xcrun simctl launch booted com.akcelgraca.cadence
```

### Diagnóstico: o que engana e o que decide

**Tudo o que é configuração passa, e não prova nada:**
- pod no `Podfile.lock` ✅
- módulo registado no `ExpoModulesProvider.swift` ✅
- nomes coincidem (`Name("ExponentImagePicker")` no Swift = `requireNativeModule('ExponentImagePicker')` no JS) ✅
- produto nos 143 produtos do build ✅
- `-lExpoImagePicker` e `libExpoImagePicker.a` na linha do linker ✅
- símbolo `ImagePickerModule` presente no binário ✅

**Sondas que dão falsos negativos:**
- `strings`/`nm` no executável principal → **0 para tudo**. Em Debug o código da app vive em **`CadenceClub.debug.dylib`**, não no executável. Procurar aí
- Listar `Frameworks/` dentro da `.app` → só lá estão os módulos distribuídos como XCFramework pré-compilado (FileSystem, Font, Location, MediaLibrary, ModulesCore/JSI/Worklets, Mapbox, React, Turf, hermes). Os compilados da fonte são estáticos e **nunca** aparecem, estejam bem ou mal

**A sonda que decide:** `ps aux` — ver o caminho do executável do processo em execução e confirmar que é o container acabado de instalar. Foi a única que apanhou o problema.

⚠️ **Nota:** a primeira hipótese foi "DerivedData envenenado pelo `expo prebuild`". **Estava errada** — o rebuild limpo não resolveu nada. Ficou o benefício lateral de libertar disco, mas não era a causa.

### 10.1 Espaço em disco
Um build limpo de iOS come vários GB, e o disco desta máquina anda no limite (foi disco cheio que matou o build de 14 ago). Recuperado a 18 ago: `ModuleCache` (2,7 GB), cache do CocoaPods (1,3 GB), simulador iPhone 17 Pro não usado (4,4 GB), `DerivedData` do build do iPhone (3,9 GB) → de 4,5 GB para **13 GB livres**.

Não mexer no `iOS DeviceSupport` (6,3 GB): apagá-lo obriga o Xcode a re-preparar o iPhone, que é a espera de "Device is busy (Preparing)" da secção 5.

---

## 11. Registo de alterações

**22 ago 2026 (13.ª sessão)**
- 🧹 **Os IDs do Google eram peso morto** — `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` e `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` estavam no `.env`, no `.env.example`, no `README` e no ambiente `preview` do EAS, e **não eram lidos por ninguém**. O login com Google vai pelo `signInWithOAuth` do Supabase, cuja configuração vive no painel do Supabase, não na app. Apagados dos quatro sítios
- **`configureGoogleSignIn()` era uma função vazia** desde o commit inicial, chamada a cada arranque no `_layout.tsx`. Removida com a chamada e o import. O comentário do `check-env.mjs` afirmava que os IDs eram lidos lá dentro — nunca foram
- ⚠️ **O pacote `@react-native-google-signin/google-signin` continua instalado e no `app.json`, sem ninguém o importar.** É um módulo nativo: removê-lo muda o build, por isso fica para depois do APK validado
- 🌍 **Notificações traduzíveis — migração 051.** Os nove tipos guardavam a frase em português, construída em SQL; passam a guardar **chave + parâmetros**, como a 041 fez nos planos de treino. Ver 3.2.1
- **A parte que não era óbvia:** o push não se traduz no cliente. O texto é desenhado pelo sistema operativo a partir do que a edge function enviou, e o sistema não traduz nada — por isso a tradução tem de existir **duas vezes**, e o servidor precisa de saber o idioma de cada pessoa. Daí `profiles.language`, lida na consulta que a `send-push` já fazia
- A data do evento passa a ir em **ISO** nos parâmetros em vez de formatada. Hoje não muda nada visível (o inglês da app é en-GB, que também escreve DD/MM); o que muda é o formato deixar de estar congelado na base de dados
- 🐛 **Os títulos do push estavam sem acentos** desde sempre — "Novo Comentario", "Sequencia", "Cracha". Não era limitação nenhuma: o `message` acentuado do SQL já passava por ali e chegava bem ao telemóvel. Corrigidos
- +18 testes (403). O dicionário vive em três sítios que ninguém obriga a concordar, e divergirem falha em silêncio — os testes cobrem chaves, idiomas e marcadores, e **foram verificados por mutação**
- ⬆️ **Alinhamento com o SDK 57** — `expo-doctor` a **21/21**, vindo de 19 pacotes fora das versões e da regressão de memória do Hermes V1. O `expo` foi ao `57.0.15` (o `57.0.9` que estava escrito aqui já era passado), e o **`react` desceu** de 19.2.8 para 19.2.3, que é a que o SDK fixa. Zero alterações de código da app. Ver 3.13
- 🪤 Duas armadilhas que vão voltar no SDK 58, documentadas: o `expo install --fix` estoira à primeira porque substitui o CLI a meio (é correr outra vez), e o `react-dom` ficou preso numa versão que já não existia, resolvido com `npx expo install react-dom` em vez de forçar com `--legacy-peer-deps`
- Verificado com `expo export --platform android` além dos testes — o Jest não passa pelo Metro, portanto sozinho não provava que a app ainda empacota
- 392 testes, 30 suites, `tsc --noEmit` limpo

**21 ago 2026 (12.ª sessão)**
- 📧 **SMTP próprio — tudo o que se consegue fazer daqui.** O 500 no `/auth/v1/signup` (3.2.7) é o serviço de email embutido a bater no limite. Guia completo em **`supabase/SMTP.md`**: fornecedor, domínio, SPF/DKIM/DMARC, campos exatos do painel, rate limit, e uma tabela de sintoma → causa
- **`npm run smtp:check`** — cliente SMTP mínimo (sem dependências novas): liga, faz STARTTLS ou TLS direto conforme a porta, autentica-se e envia uma mensagem real. Existe porque **o painel do Supabase aceita credenciais erradas sem as testar**, que é a forma de repetir exatamente o erro que estamos a corrigir. Verificado contra um servidor real nos dois modos; as mensagens de erro apontam a causa (utilizador errado, domínio por verificar, porta bloqueada)
- **Três templates de email PT/EN** em `supabase/email-templates/` — o Supabase só tem um template por tipo de mensagem, por isso o bilinguismo passa pelo `user_metadata`: o `signUp` guarda lá o `lang` e o template escolhe o ramo. Mudar o idioma nas Definições atualiza-o, senão quem se registasse em português e passasse a app para inglês continuava a receber os emails em português
- **`.env.example` com o bloco SMTP sem `EXPO_PUBLIC_`** — com esse prefixo a palavra-passe do servidor de email ia dentro do bundle da app, legível por quem abrisse o `.apk`. O `smtp:check` recusa-se a correr se alguém lhe puser o prefixo
- ✅ **O 500 no registo acabou.** Cinco `POST /auth/v1/signup` seguidos contra o projeto a sério, os cinco em 200, os últimos três em 20 segundos — o ritmo que fazia o serviço embutido rebentar. Testado sem app pelo meio, direito ao GoTrue, para separar as incógnitas. Fechou também as duas dúvidas de manhã: o *Site URL* aceita `cadence://`, e o motor de templates aceita a condição do idioma **incluindo quando o `lang` não existe**, que era o caso arriscado
- ✅ **Resend + `cadenceclub.pt` a funcionar (fim do dia).** Domínio verificado na Irlanda, os quatro registos DNS confirmados propagados, e o `smtp:check` a autenticar e a entregar — a mensagem chega à **Caixa de entrada** do Gmail com `spf=pass` e `dkim=pass`, ou seja o DNS está completo e o domínio assina. Descoberto de passagem que o domínio já tinha correio da Amen na raiz — não conflitua, e dá a caixa de suporte que a App Store vai exigir
- ⚠️ **Duas coisas ficam por confirmar no painel** e estão assinaladas no guia: o `cadence://` no campo *Site URL*, e o motor de templates a aceitar a condição do idioma — não há Go nesta máquina para a correr
- 392 testes, 30 suites, `tsc --noEmit` limpo

**19 ago 2026 (11.ª sessão)**
- ❤️ **FC máxima editável no perfil** — campo em Editar perfil → Treino, ao lado do peso (mesma categoria: dado fisiológico para calcular, não para descrever). O marcador mostra **o valor que a app usa agora**, e por baixo aparecem as cinco zonas em bpm, que atualizam ao escrever — sem elas "187 bpm" não diz nada a ninguém
- `zoneColors` movido para `lib/theme` — estava só no detalhe da atividade e ia ser duplicado, que é o erro que acabámos de corrigir nas calorias
- Validação 120–240 alinhada com a CHECK da 046, com erro no próprio campo em vez de um alerta ao guardar
- ✅ **Migrações 044, 045 e 046 aplicadas** — a base de dados está alinhada com o código. `VERIFICAR_MIGRACOES.sql` alargado para as cobrir: 8 verificações novas, incluindo a CHECK de 30-240 bpm (sem ela, um sensor com defeito grava 900 e as zonas ficam absurdas) e o estado do interruptor `premium_gating`, que deve ler **DESLIGADO**
- 🔧 **Uma só conta de calorias** — havia duas: a de `calculateCalories.ts` (por modalidade, e por batimento desde a 10.ª sessão) e uma no `WeeklyChartCard` com **MET fixo de 7** para tudo, que punha ioga e corrida a valer o mesmo. Dois números diferentes para a mesma semana. Agora `sumActivityCalories()` é o único sítio que soma, e o cartão semanal busca as atividades da semana em vez de usar só o agregado
- `startOfWeek()` extraído para `dateHelpers` — a definição de "início da semana" estava duplicada entre o plano de treino e o resumo, e discordar sobre onde a semana começa é o tipo de bug que ninguém vê
- 🐛 **3 falhas de i18n** encontradas por um teste novo: `label: 'Tempo'` no resumo semanal e `'Os meus clubes'`/`'Descobrir'` nos eventos. Escaparam à migração **e** ao teste do JSX — são strings dentro de objetos de propriedades, não conteúdo entre tags
- Teste novo `texto fixo em propriedades` cobre `label`, `title`, `placeholder`, `subtitle`, `accessibilityLabel` e `unit`
- +7 testes (339 no total)

**19 ago 2026 (10.ª sessão)**
- ❤️ **Frequência cardíaca** — migração **046** (`activities.avg_heart_rate`/`max_heart_rate` + `profiles.max_heart_rate`), leitura nas duas plataformas e nos ficheiros, zonas de treino e calorias por batimento
- **Zonas de treino** (`utils/heartRate.ts`) — cinco zonas percentuais, máximo estimado por **Tanaka (208 − 0,7 × idade)** e não pelo `220 − idade`, que subestima quem tem mais de 40 e empurra essas pessoas para zonas mais altas do que as reais. Quem souber o seu máximo indica-o no perfil
- **Calorias por batimento** (Keytel) quando há FC e idade; cai no MET quando não há. É o que distingue "quanto gasta alguém a este ritmo" de "quanto gastaste tu"
- **GPX e TCX passam a trazer batimento** — o TCX embrulha-o em `<HeartRateBpm><Value>`; o GPX não o prevê sequer e cada fabricante mete-o em `<extensions>` com o seu prefixo, por isso procura-se por qualquer chave que acabe em `hr`
- Detalhe da atividade mostra FC média, FC máxima, zona (com cor) e calorias — só quando existem
- +36 testes (332 no total)
- ✅ **Aplicada** a 19 ago, com a 044 e a 045

**18 ago 2026 (9.ª sessão)**
- 🐛 **`cadence://` nunca foi registado no iOS** — `ios.infoPlist.CFBundleURLTypes` definido à mão apagava o que o `scheme` geraria. Links de email (confirmação, recuperação de palavra-passe) não voltavam à app no iOS; o Android nunca foi afetado. Corrigido no `app.json`, **exige rebuild**. Ver secção 12
- **Paywall ligado às Definições** — a rota existia mas nada navegava para lá
- App antiga `com.cadence.app` removida do simulador (bundle id de outra era; eram os dois ícones)

**18 ago 2026 (8.ª sessão)**
- 🔌 **Canalização de monetização construída e desligada** — migração **045** (limites impostos no servidor + flag `premium_gating`), webhook do RevenueCat, `services/purchases/`, paywall `app/premium.tsx`, e o `can()` finalmente a ler o estado real. Liga-se com um `UPDATE`. Ver 4.6
- 4 testes novos sobre o interruptor, incluindo o que garante que falhar a ler a flag **deixa a app aberta**
- Eventos `paywall_viewed` e `premium_purchased` no analytics — dão a conversão, que é o que decide o preço
- ⚠️ **Por aplicar:** migração `045_premium_gating.sql`

**18 ago 2026 (7.ª sessão)**
- 🚧 **Importação de ficheiros, fase 1** — GPX + TCX, um ficheiro. Novo módulo `src/services/import/`, migração **044** (a CHECK de `activities.source` rejeitava qualquer importação), 29 testes novos. Ver 4.5
- `HealthSource` alargado para `ImportSource` e mapa `FILE_BY_NAME` acrescentado ao `mapping.ts`, para o pipeline de saúde servir também ficheiros
- ⚠️ **Por aplicar:** migração `044_import_sources.sql`. ⚠️ **Por fazer:** rebuild, porque o `expo-document-picker` é nativo

**18 ago 2026 (6.ª sessão)**
- 🐛 **Corrigido `hasPermissions()` no `adapters.ts`** — `Array.isArray()` sobre uma leitura devolvia `true` sempre, incluindo a quem nunca tinha sido perguntado nada. Substituído por `getRequestStatusForAuthorization`. Ver 4.1.1
- **Dica na interface** quando não se lê nada (`imported === 0 && skipped === 0`) → nova chave `health_sync_check_permissions` em PT e EN
- **Caso 2 do README reescrito** — pedia `isConnected === false` depois de recusar, que não é obtível em iOS. Agora pede o que é verificável ("nunca perguntado → `false`") e documenta a limitação da Apple
- Verificado: `tsc --noEmit` limpo, **263 testes verdes**
- 7 commits enviados para `origin/main` (o repositório estava parado desde 14 ago)

**18 ago 2026 (5.ª sessão)**
- 🎉 **Sincronização com a Saúde validada no simulador** — `devSeed` deu **3 importados, 2 descartados**, e a segunda sincronização deu **zero**. Era a maior pendência técnica do projeto: código escrito da documentação que nunca tinha corrido
- ✅ **Caso 7 (reinstalação) validado** — app desinstalada e reinstalada de raiz, com novo login e nova autorização do HealthKit: sincronizou **zero**. O estado vive no servidor; trocar de telemóvel não duplica o histórico. Fechados os casos 1, 3, 5, 6 e 7
- `src/services/health/README.md` e a secção 4.1 reescritos com o que ficou provado e o que falta

**18 ago 2026 (4.ª sessão)**
- `npx expo prebuild` corrido → **`ios/` regenerado**. Os entitlements voltaram, e agora com **três** capabilities que a Personal Team não suporta: `healthkit`, `healthkit.background-delivery`, `aps-environment` e `applesignin`. ⚠️ **O próximo build para o iPhone físico vai falhar na assinatura** até serem removidas outra vez
- **Processo zombie no simulador** a correr um binário de 28 jul enquanto o Metro lhe servia JS actual → módulos nativos "em falta". Resolvido com `kill -9` ao PID e remoção do container órfão. **Secção 10 criada** com o diagnóstico, as sondas que dão falsos negativos e a solução
- **Build limpo para o simulador: `Build Succeeded`**, instalado e aberto no iPhone Air. `ExpoImagePicker`, `NitroModules` e `ReactNativeHealthkit` compilados; Metro a servir em `:8081`
- Disco: de 4,5 GB para **13 GB livres** (ver 10.1)

**18 ago 2026 (3.ª sessão)**
- ✅ **Migrações 042 e 043 confirmadas aplicadas e completas** — `VERIFICAR_MIGRACOES.sql` deu `APLICADA` em todos os objetos. A base de dados está alinhada com o código; não há nada por aplicar
- `src/services/health/README.md` atualizado: a 043 deixou de estar "por aplicar", e o caminho relativo foi corrigido de `../../../../supabase/` para `../../../supabase/` (mudou com a passagem do `supabase/` para dentro de `apps/mobile`)
- **Rebuild Release compilada e instalada no iPhone** (02:18) com o Meta App ID. Confirmado por `strings` no `main.jsbundle`: `1895867934721207`. O Instagram Stories passa a ser testável no telemóvel; o prazo dos 7 dias reiniciou para **25 ago**

**18 ago 2026 (2.ª sessão)**
- `VERIFICAR_MIGRACOES.sql` **reescrito como uma só instrução** — o SQL Editor do Supabase só mostra o resultado da última query, por isso a versão com três instruções escondia o diagnóstico (via-se só as 22 colunas de `activities`). Agora devolve 12 linhas, uma por objeto
- **Secção 9 criada** — plano de teste no iPhone, com o que a build instalada consegue e não consegue provar. Confirmado por inspeção do bundle: contém `TODO_META_APP_ID`, sem entitlements de HealthKit nem push

**18 ago 2026**
- **Meta App ID metido** — `1895867934721207` em `useShareActivity.ts`. Já não há um único `TODO` em `src/`
- **`supabase/` mudou de sítio** — passou de `Saas/supabase/` para `apps/mobile/supabase/`. Consequência boa: agora está **dentro do repositório git**, logo as migrações passam a ser versionadas. Consequência má, já corrigida: a edge function `send-push` (Deno) ficou no alcance do `tsconfig` da app e partiu o typecheck com 5 erros falsos (`Cannot find name 'Deno'`, import por URL). **Resolvido** — `supabase` acrescentado ao `exclude` do `tsconfig.json`
- **Bug corrigido no `VERIFICAR_MIGRACOES.sql`** — a query da frequência cardíaca não tinha parênteses à volta do `OR`; o `AND` liga mais forte e devolvia colunas do sistema (`pg_inherits.inhrelid` contém "hr"). Acrescentada também uma query que lista todas as colunas de `activities`
- Migrações 042/043: recolhida evidência de que já estão aplicadas (ver 4.3)
- Verificado depois de tudo: `tsc --noEmit` limpo, **263 testes verdes**

**17 ago 2026**
- Documento criado
- Build iOS Release compilada e instalada no iPhone 15 (secção 5)
- `src/services/healthSync.ts` apagado — código morto; typecheck e 263 testes verdes depois de remover
- Migração `025` investigada — salto na numeração, nada em falta
- `supabase/VERIFICAR_MIGRACOES.sql` criado para confirmar as migrações 042/043
- **Correção:** testar HealthKit **não** exige conta Apple paga — o simulador não impõe provisioning. Secção 4.1 reescrita com o procedimento via `devSeed`
- Regra de manutenção deste documento acrescentada ao `AGENTS.md`

---

## 12. Armadilha: `infoPlist` manual apaga o `scheme`

**Encontrado a 18 ago 2026.** O `app.json` tinha `scheme: "cadence"` **e**, ao mesmo tempo, um `ios.infoPlist.CFBundleURLTypes` definido à mão só com o esquema do Google Sign-In.

Quando se define `CFBundleURLTypes` à mão, esse valor **substitui** o que o `scheme` geraria. Resultado: o `cadence://` nunca chegou ao `Info.plist` do iOS. O Android não foi afetado — o `AndroidManifest.xml` tinha `android:scheme="cadence"` na mesma.

**Sintoma:** `xcrun simctl openurl booted "cadence://..."` falha com `LSApplicationWorkspaceErrorDomain error 115`.

**Impacto real, medido:**
- ❌ **Links de email não voltam à app no iOS** — confirmação de conta e recuperação de palavra-passe. O handler em `_layout.tsx:307` lê o `access_token` do fragmento e cria a sessão, mas nunca é chamado porque o sistema não sabe abrir `cadence://`
- ✅ **Google Sign-In escapa** — o `WebBrowser.openAuthSessionAsync` usa o `ASWebAuthenticationSession`, que intercepta o retorno internamente, sem depender do esquema registado
- ✅ Android sempre funcionou

**Corrigido** acrescentando `cadence` ao array em `app.json`, à frente do esquema do Google. ⚠️ **Exige rebuild** para ter efeito.

**Regra:** ao definir `ios.infoPlist.CFBundleURLTypes` à mão, incluir sempre o esquema próprio da app. O campo `scheme` sozinho deixa de bastar.
