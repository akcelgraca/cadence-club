# Cadence Club — Estado do Projeto

**Data:** 19 de agosto de 2026
**Commit:** `ddecc45` — `main`, sincronizado com `origin/main`, working tree limpo
**Objetivo do produto:** app de fitness social para rivalizar com o Strava, focada no mercado português e em atletas casuais.

> Sobre este documento: o que está marcado ✅ foi verificado a correr nesta máquina (testes, typecheck, build, inspeção do código). O que está marcado ⚠️ ou ❌ é pendência conhecida. A secção "Lacunas face ao Strava" é análise de produto, não facto verificado.

---

## 1. Resumo executivo

A app está **funcionalmente construída e tecnicamente saudável**. Não há trabalho de funcionalidades base por fazer — há trabalho de **validação em dispositivo**, **monetização** e **diferenciação competitiva**.

| Indicador | Estado |
|---|---|
| Testes | ✅ 339 testes, 24 suites, todos a passar |
| Typecheck (`tsc --noEmit`) | ✅ limpo |
| Ecrãs (expo-router) | 44 |
| Componentes | 67 |
| Serviços | 36 |
| Stores (Zustand) | 6 |
| Hooks | 17 |
| Linhas em `src/` | ~40 800 |
| Chaves i18n | 1188 PT + 1188 EN (equilibradas ✅) |
| Migrações Supabase | 45 ficheiros (`001` → `046`; não existe `025`) |
| Edge functions | 2 (`send-push`, `revenuecat-webhook`) |
| Build iOS em dispositivo | ✅ iPhone 15, 18 ago — ⏰ expira **25 ago 2026** |
| Build iOS em simulador | ✅ Debug, com Metro |

**O risco mudou de sítio.** A 17 de agosto, o maior risco era código nunca executado — a sincronização com a Saúde tinha sido escrita a partir da documentação e nunca corrida. Isso ficou validado a 18 de agosto, e o processo apanhou **três bugs reais** que nenhum teste automático teria encontrado:

- `hasPermissions()` devolvia `true` a quem nunca tinha sido perguntado nada (4.1.1)
- `readAsStringAsync` foi removido no SDK 57 e lançava em tempo de execução, partindo a importação de ficheiros **e** a partilha para Instagram Stories
- `cadence://` nunca chegou a ser registado no iOS, o que impedia os links de email de voltarem à app (secção 12)

**O risco de hoje é comercial, não técnico.** A canalização de monetização está construída e desligada (4.6), a importação de ficheiros está na fase 1 (4.5), e nada disto se pode testar a sério nem lançar sem **conta paga da Apple**. A app também não tem utilizadores, por isso não há dados de retenção para decidir preços.

✅ **Não há migrações por aplicar.** A `047` e a `048` foram aplicadas a 20 ago; a `044`, a `045` e a `046` a 19 ago 2026. A base de dados está alinhada com o código. Confirmar com `supabase/VERIFICAR_MIGRACOES.sql`, que passou a cobrir até à 046.

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

**Gap conhecido, por decidir:** as mensagens são construídas em SQL, em
português. A app é bilingue desde 19 de agosto, mas quem a tiver em inglês
recebe os *pushes* em português na mesma — e isto vale para os nove tipos, não
só os novos. A correção seria guardar uma chave de i18n e os parâmetros em vez
do texto, e traduzir no cliente. Não é pequena, e mudá-la só para três tipos
deixava a lista com dois comportamentos.

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

**Por fazer, e só tu podes:**
3. Project settings → Service accounts → **Generate new private key**
4. `eas credentials` → Android → Google Service Account → **FCM V1** → carregar
   essa chave
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

### 4.5 Importação de ficheiros — fase 1 feita (18 ago 2026) 🚧

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
11. **Criar o projeto PostHog (EU Cloud) e colar a chave no `.env` e no `eas.json`.** É o passo mais barato da lista e o que mais custa adiar: a retenção a 30 dias precisa de 30 dias de calendário, e o relógio só arranca no dia em que o primeiro evento chega. Confirmar com `npm run analytics:check`. Tudo o resto do lado do código já está feito (ver 3.11)
12. Recolher dados de retenção com o PostHog **antes** de decidir preços — a instrumentação já está lá, falta o tempo a correr

---

## 9. Plano de teste no iPhone físico

**Build instalada: 20 ago 2026, 14:41.** Acrescenta os meses do histórico e os
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
