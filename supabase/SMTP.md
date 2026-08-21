# SMTP próprio — do 500 no registo até emails que chegam à Caixa de entrada

**Porque é que isto é urgente.** A 20 de agosto o `POST /auth/v1/signup`
começou a devolver **500** (secção 3.2.7 do `ESTADO_DO_PROJETO.md`). Não é
código da app: o `signUp` são três linhas e não tem como devolver 500. É o
serviço de email **embutido** do Supabase, que tem um limite muito baixo de
envios por hora — a documentação fala em **2 por hora e por projeto** — e o
GoTrue devolve 500 quando não consegue enviar a confirmação. Criar duas contas
de teste seguidas chega para o disparar.

O embutido é explicitamente **só para desenvolvimento**: sem SLA, sem
entregabilidade garantida, com o remetente da Supabase. Não dá para lançar com
ele. Isto não tem nada a ver com a Apple nem com o IAP — é anterior a tudo isso.

Este guia vai do zero até "o registo funciona e o email chega à Caixa de
entrada". Cerca de **1 hora**, dividida entre uma tarde e o dia seguinte (o DNS
demora a propagar).

---

## Estado desta configuração (21 ago 2026)

| | |
|---|---|
| Domínio de envio | **`cadenceclub.pt`** (Amen), verificado no Resend |
| Região | Irlanda, `eu-west-1` |
| Remetente | `no-reply@cadenceclub.pt` |
| DNS | DKIM, SPF e MX em `send`, DMARC em `_dmarc` — os quatro propagados e confirmados |
| `npm run smtp:check` | ✅ autentica e entrega |
| Entregabilidade | ✅ Caixa de entrada do Gmail, `spf=pass` e `dkim=pass` |
| Painel do Supabase | ✅ SMTP, rate limit 100/h, três templates, `cadence://` + `cadence://*` |
| Registo a funcionar | ✅ cinco `signup` seguidos em HTTP 200 (21 ago) |
| Link do email a abrir a app | ⬜ por validar no emulador Android |

O `cadenceclub.site` também é nosso mas **não se envia de lá**: o `.site` é dos
TLDs baratos que os filtros olham de lado, e um domínio novo já parte sem
histórico nenhum.

⚠️ **A raiz do domínio já tinha correio da Amen** — `MX mail-pt.securemail.pro`
e `TXT v=spf1 include:spf.webapps.net ~all`. Não conflitua (o SPF do Resend
vive em `send.cadenceclub.pt` e o DKIM alinha pela raiz), **não mexer em
nenhum dos dois**. Duas consequências úteis: há caixa de correio no domínio,
que serve para o endereço de suporte que a App Store exige, e torna possíveis
os relatórios DMARC (`rua=mailto:dmarc@cadenceclub.pt`) quando fizer sentido.

---

## O que está feito e o que é preciso fazer à mão

| | |
|---|---|
| ✅ `npm run smtp:check` | prova as credenciais **antes** de as colares no painel |
| ✅ `supabase/email-templates/` | três templates PT/EN prontos a colar |
| ✅ `lang` no `user_metadata` | o `signUp` passa o idioma da app, e os templates seguem-no |
| ✅ bloco SMTP no `.env.example` | sem `EXPO_PUBLIC_`, para não ir no bundle |
| ❌ conta no fornecedor | tem de ser feita por ti |
| ❌ domínio + registos DNS | idem — é o passo que decide se cais no Spam |
| ❌ colar no painel do Supabase | o CLI daqui não tem access token |

---

## 1. Escolher o fornecedor

Todos fazem o mesmo: dão-te um host, uma porta, um utilizador e uma
palavra-passe. As diferenças que interessam são o preço, a entregabilidade e
onde ficam os dados.

| | Free | Notas |
|---|---|---|
| **Resend** ⭐ | ~3 000/mês, 100/dia | O mais rápido de pôr a andar; a verificação de domínio é guiada. Permite escolher a região de envio |
| **Brevo** | ~300/dia | Empresa francesa, dados na UE. Mais volume grátis por dia |
| **Postmark** | só teste | A melhor entregabilidade para email transacional. Pago desde o início |
| **AWS SES** | ~0,10 USD/1000 | O mais barato à escala. Começa em *sandbox* e é preciso pedir a saída |

**Recomendação: Resend.** Para o volume desta fase (dezenas de registos por
dia) o plano grátis chega e sobra, e é o que tem menos passos até funcionar.
O Brevo é a alternativa a considerar se a residência dos dados na UE for um
requisito duro — a app já escolheu o PostHog EU pela mesma razão.

> Os números do free tier mudam. Confirma na página de preços antes de decidir.

---

## 2. O domínio

**Precisas de um domínio teu.** Não dá para enviar de `@gmail.com`: o Gmail
publica uma política DMARC que manda rejeitar quem envia em nome dele, e as
mensagens vão parar ao Spam ou são recusadas.

- **Se já tens o domínio** → passa ao ponto 3.
- **Se não tens** → um `.pt` ou `.com` custa 10–15 € por ano. Vale a pena
  registar já o do produto: vais precisar dele para o site, para a página de
  privacidade que a App Store exige, e para os emails.
- **Só queres desbloquear o teste hoje** → o Resend deixa enviar de
  `onboarding@resend.dev` sem domínio nenhum, mas **só para o teu próprio
  endereço**. Serve para destrancar o registo enquanto testas; não serve para
  utilizadores reais.

Endereço a usar: `no-reply@teu-dominio.pt`. Evita `noreply@` sem hífen ou
`admin@` — não muda nada tecnicamente, mas é a convenção que os filtros veem
com mais frequência.

---

## 3. DNS — o passo que decide entre Caixa de entrada e Spam

O fornecedor mostra os registos exatos depois de adicionares o domínio.
Copia-os **tal como estão**. São três:

| Registo | Onde | Para que serve |
|---|---|---|
| **SPF** (TXT) | no domínio | diz quais os servidores autorizados a enviar em teu nome |
| **DKIM** (TXT) | num seletor, ex. `resend._domainkey` | assina cada mensagem; é o que prova que não foi forjada |
| **DMARC** (TXT) | `_dmarc.teu-dominio.pt` | diz ao destinatário o que fazer quando SPF e DKIM falham |

Para o DMARC começa sempre por **`v=DMARC1; p=none; rua=mailto:o-teu@email`** —
`p=none` só reporta, não rejeita nada. Depois de umas semanas de relatórios
limpos, sobe para `p=quarantine`.

**Armadilhas.** A propagação leva de minutos a algumas horas — se o painel do
fornecedor disser *pending*, espera, não mexas. Alguns registradores acrescentam
o domínio sozinhos ao nome do registo: se te pedirem `resend._domainkey` e o
painel guardar `resend._domainkey.teu-dominio.pt.teu-dominio.pt`, é isso a
acontecer, e tens de pôr só a parte da esquerda.

---

## 4. Confirmar as credenciais **antes** de as colar no Supabase

Este é o passo que evita repetir a história do 500. O painel do Supabase aceita
as credenciais sem as testar: guarda-as, diz *Settings saved*, e só se descobre
que estão erradas quando o próximo registo falha.

No `.env` (que é gitignorado — as credenciais nunca entram no repositório):

```
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=re_a-tua-api-key
SMTP_FROM=no-reply@cadenceclub.pt
SMTP_TEST_TO=o-teu-email@gmail.com
```

**No `apps/mobile/.env`**, não no da raiz nem no `.env.example` — o script lê
o `.env` ao lado do `package.json`.

E depois:

```bash
npm run smtp:check
```

O script faz exatamente o que o GoTrue vai fazer — liga-se, negoceia TLS,
autentica-se e envia uma mensagem real. Quando falha, diz onde: credenciais
recusadas, domínio por verificar, porta bloqueada pela rede.

> **O `SMTP_USER` quase nunca é o teu email.** No Resend é literalmente a
> palavra `resend`; no Brevo é o email da conta; no SES é uma credencial
> gerada só para SMTP, diferente da chave da API. A palavra-passe é a chave
> inteira, prefixo incluído.

**Quando a mensagem chegar, abre-a e olha para o cabeçalho** (no Gmail:
⋮ → *Mostrar original*). Tem de dizer `spf=pass` e `dkim=pass`. Se chegou ao
Spam ou falta um dos dois, o DNS está incompleto — volta ao ponto 3. É agora
que isso se resolve, não depois de os utilizadores reais deixarem de receber.

---

## 5. Colar no Supabase

**Project Settings → Authentication → SMTP Settings → Enable Custom SMTP**

| Campo | Valor |
|---|---|
| Sender email | `no-reply@cadenceclub.pt` (o mesmo `SMTP_FROM`) |
| Sender name | `Cadence Club` |
| Host | `smtp.resend.com` |
| Port | `587` |
| Username | `resend` |
| Password | a API key |

Usa a **587**. É a porta que o Supabase documenta e a que menos redes bloqueiam.

---

## 6. Subir o rate limit

**Authentication → Rate Limits → Rate limit for sending emails**

Ligar o SMTP próprio **não sobe o limite sozinho** — continua no valor baixo do
serviço embutido, e o 500 voltaria na mesma. Põe um valor folgado (100/hora dá
para testar à vontade e continua a ser um travão contra abuso).

---

## 7. Os templates

**Authentication → Emails.** Para cada um, colar o conteúdo do ficheiro no
*Message body*:

| Template no painel | Ficheiro | Quem o dispara |
|---|---|---|
| Confirm signup | `email-templates/confirm-signup.html` | registo |
| Reset Password | `email-templates/reset-password.html` | Definições → mudar palavra-passe |
| Change Email Address | `email-templates/change-email.html` | Definições → mudar email |

Assuntos (campo *Subject*):

```
{{ if eq (printf "%v" .Data.lang) "en" }}Confirm your email{{ else }}Confirma o teu email{{ end }}
{{ if eq (printf "%v" .Data.lang) "en" }}Reset your password{{ else }}Repor a palavra-passe{{ end }}
{{ if eq (printf "%v" .Data.lang) "en" }}Confirm the email change{{ else }}Confirma a mudança de email{{ end }}
```

**Como é que ficam bilingues.** O Supabase só tem um template por tipo de
mensagem. O que ele deixa ler é o `user_metadata`, e o `signUp` passou a
guardar lá o idioma da app (`services/auth.ts`); mudar o idioma nas Definições
atualiza-o. O template escolhe o ramo a partir daí. Quem não tiver `lang` — as
contas criadas antes desta alteração — recebe português.

> **Isto tem de ser testado, não assumido.** O `printf "%v"` está lá para o
> template não rebentar quando o `lang` não existe, mas nada disto foi corrido
> contra o motor de templates do Supabase a partir daqui. **Um template que
> rebenta é um email que não sai — ou seja, o 500 outra vez.** Regista uma
> conta de teste logo a seguir a colar.
>
> **Plano B se der problemas:** apaga de cada ficheiro a linha
> `{{ if eq ... }}`, o bloco inglês e a linha `{{ else }}`, ficando só o
> português entre o `{{ else }}` e o `{{ end }}` (e apaga também o `{{ end }}`).
> Sem condições não há nada que possa falhar.

---

## 8. Para onde é que os links voltam

**Authentication → URL Configuration.** Nenhum email serve de nada se o link
não trouxer a pessoa de volta à app.

- **Site URL:** `cadence://` — é para aqui que o link volta quando o código não
  diz outra coisa, e é este o esquema que a app regista.
- **Redirect URLs:** acrescenta `cadence://*`.

⚠️ **Duas coisas a saber antes de testar:**

1. **No iOS ainda não funciona.** O `cadence://` só passou a estar registado no
   `app.json` a 20 de agosto e **exige um rebuild** (secção 12 do
   `ESTADO_DO_PROJETO.md`). A build que está no iPhone não sabe abrir o
   esquema: o email chega, o link abre o browser e fica por ali. **No Android
   funciona.** Testa no emulador Android primeiro.
2. ✅ **O campo Site URL aceita `cadence://`** — confirmado a 21 ago. Era a
   dúvida que podia obrigar a passar `emailRedirectTo` no código; não é
   preciso, o esquema da app serve tal e qual.

---

## 9. Ligar a confirmação e testar

Só agora. **Authentication → Providers → Email → Confirm email: ligado.**

1. Regista uma conta com um email a sério, do emulador Android
2. O email chega em segundos — vê o remetente, o idioma e o aspeto
3. Toca no botão → a app abre e a sessão fica criada
4. Repete com a app em inglês, para ver o outro ramo do template
5. Regista **cinco** contas seguidas — é o que fazia o 500 aparecer

---

## 10. Quando correr mal

O sítio certo para olhar é sempre **Logs → Auth**. A mensagem do GoTrue
distingue os casos:

| No log | O que é |
|---|---|
| `Error sending confirmation email` | SMTP: credenciais, rate limit, ou template a rebentar |
| `Database error saving new user` | outra coisa — gatilho ou restrição na base de dados |

| Sintoma | Causa provável |
|---|---|
| 500 no signup, `Error sending confirmation email` | rate limit (ponto 6) ou template com erro (ponto 7) |
| Email não chega e o log está limpo | está no Spam. Ponto 3 |
| `npm run smtp:check` dá 535 | utilizador errado — no Resend é `resend`, não o teu email |
| `smtp:check` falha no `MAIL FROM` | domínio por verificar, ou conta em modo de teste |
| `smtp:check` fica sem resposta | a rede bloqueia a porta. Tenta 465 |
| O link abre o browser em vez da app | iOS sem rebuild (ponto 8), ou o `cadence://*` fora da lista |

---

## 11. Depois disto

- Ao fim de umas semanas de relatórios DMARC limpos, subir de `p=none` para
  `p=quarantine`
- Vigiar a taxa de bounces no painel do fornecedor — endereços inválidos a
  acumular estragam a reputação do domínio
- O mesmo domínio e os mesmos registos servem para os emails de produto
  (resumos semanais, notificações) quando existirem
