# Cadence Club — Estado do Projeto

**Data:** 17 de agosto de 2026
**Commit:** `f8308a5` (14 ago 2026) — `main`, sincronizado com `origin/main`, working tree limpo
**Objetivo do produto:** app de fitness social para rivalizar com o Strava, focada no mercado português e em atletas casuais.

> Sobre este documento: o que está marcado ✅ foi verificado a correr nesta máquina (testes, typecheck, build, inspeção do código). O que está marcado ⚠️ ou ❌ é pendência conhecida. A secção "Lacunas face ao Strava" é análise de produto, não facto verificado.

---

## 1. Resumo executivo

A app está **funcionalmente construída e tecnicamente saudável**. Não há trabalho de funcionalidades base por fazer — há trabalho de **validação em dispositivo**, **monetização** e **diferenciação competitiva**.

| Indicador | Estado |
|---|---|
| Testes | ✅ 263 testes, 21 suites, todos a passar (3,2 s) |
| Typecheck (`tsc --noEmit`) | ✅ limpo |
| Ecrãs (expo-router) | 43 |
| Componentes | 67 |
| Serviços | 24 (+ módulo `health/`) |
| Stores (Zustand) | 6 |
| Hooks | 17 |
| Linhas em `src/` | ~39 000 |
| Chaves i18n | 1144 PT + 1144 EN (equilibradas ✅) |
| Migrações Supabase | 43 (`001` → `043`) |
| Build iOS em dispositivo | ✅ instalada no iPhone 15 a 17 ago 2026 |

**O maior risco não é código em falta — é código nunca executado em dispositivo real.** A sincronização com a Saúde é o exemplo central: está escrita e a lógica pura tem testes, mas os adaptadores nativos foram escritos a partir da documentação e nunca correram contra dados reais.

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
- Notificações in-app + push (edge function `send-push`)
- Pesquisa (utilizadores, rotas, clubes)
- Desafios (`challenges`)

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
- 1144 chaves em cada idioma
- ✅ Três testes protegem isto: dicionários com as mesmas chaves, mesmos marcadores `{{}}` nos dois idiomas, e todas as chamadas `t()` a apontar para chaves existentes (uma chave em falta não estoira — aparece em bruto ao utilizador)
- Padrão: constantes com texto visível guardam `i18n_key`, nunca o texto

### 3.10 Autenticação
- Email/password, Google Sign-In, Apple Sign-In

### 3.11 Analytics
- Wrapper PostHog com 15 eventos instrumentados: `app_opened`, `activity_recorded`, `premium_feature_used`, `activity_shared`, `signed_up`, `onboarding_completed`
- ✅ Coberto por testes (`analytics.test.ts`)

### 3.12 Infraestrutura de subscrição
- Migração `042_subscriptions.sql` cria a canalização (tabelas + `has_entitlement()` no servidor)
- `usePremium()` com a lista de funcionalidades premium num sítio só
- ✅ Coberto por testes (`subscription.test.ts`)
- ⚠️ **Não cobra nada** — ver secção 4.2

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
- **Frequência cardíaca** — o `ExternalWorkout` já a transporta, mas não há coluna em `activities` para a guardar
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
| PostHog montado mas sem uma única chamada a `capture()` | ✅ **Resolvido** — 15 eventos instrumentados |
| O premium acordado é quase todo funcionalidade que já existe e já é grátis | ⚠️ **Continua** |

O que falta concretamente:
- ❌ **Nenhuma biblioteca de compras instalada.** Sem IAP (ou RevenueCat) não há forma de cobrar. É o trabalho real que falta.
- ⚠️ `usePremium().can()` devolve **sempre `true`** (`src/hooks/usePremium.ts:52`). Trocar por `state.isPremium` é o interruptor que liga a monetização
- ❌ Migração de *gating* ainda por escrever — a `042` só cria a canalização, não fecha nada

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

### Curto prazo (validação)
4. **Testar a app instalada no iPhone** — tudo o que foi construído desde 1 de agosto (segments, zonas de privacidade, fila offline, fotos, analytics, partilha) está pela primeira vez num telemóvel
5. **Testar a sincronização de saúde no simulador iOS** — repor o entitlement, `npx expo run:ios` (Debug), e usar o `devSeed` pelas Definições. Cobre os casos 1, 2, 3, 5 e 6 do README do módulo, sem custar nada (ver secção 4.1)
6. **Build Android via EAS** e correr os mesmos casos no Health Connect, num telemóvel real
7. Decidir sobre a **conta Apple Developer paga** (99 USD/ano). Obrigatória apenas para: HealthKit **no iPhone físico**, push remoto, TestFlight, e builds que não expiram em 7 dias. **Não** é precisa para validar a lógica de saúde — o simulador chega

### Médio prazo (produto)
8. **Importação de ficheiros** — 🚧 **fase 1 feita (GPX + TCX, um ficheiro)**, ver 4.5. Falta FIT e importação em lote do `.zip` do Strava, que é o que cumpre mesmo a migração
9. Coluna de **frequência cardíaca** em `activities` + distância no Health Connect
10. Ligar a **monetização**: escolher IAP/RevenueCat, escrever a migração de gating, trocar o `can()` por `state.isPremium`

### Antes de qualquer lançamento
11. Recolher dados de retenção com o PostHog **antes** de decidir preços — a instrumentação já está lá, falta o tempo a correr

---

## 9. Plano de teste no iPhone físico

**Build instalada: 18 ago 2026, ~16h.** Inclui a importação de ficheiros, a correção das permissões de saúde e a correção do `File.text()`. Verificado por inspeção do bundle (`import_file_label`, `1895867934721207` presentes).
- É Release com JS embutido → **não fala com o Metro**. Alterações de código só chegam cá com novo build; o simulador é que recarrega na hora
- **Sem HealthKit, sem push remoto e sem Sign in with Apple** — os quatro entitlements foram removidos para poder assinar com Personal Team. **Entrar só por email ou Google**
- É Release → **o `devSeed` não existe** (só corre em `__DEV__`)
- ⏰ **Expira a 25 ago 2026** (7 dias do free provisioning)

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
