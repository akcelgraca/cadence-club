# Publicar as páginas com HTTPS — passo a passo

**Objetivo:** `https://cadenceclub.pt/privacidade.html` a responder 200, com
certificado válido. Sem isso a App Store rejeita a app.

**Porque não basta a Amen:** o alojamento serve as páginas em HTTP, mas em HTTPS
apresenta um certificado `*.dadapro.com` — que não é deste domínio. Qualquer
browser mostra aviso de segurança. Emitir um certificado à mão obrigava a
repetir tudo de 90 em 90 dias; a Cloudflare trata disso sozinha e para sempre,
de graça.

**O que a Cloudflare faz e não faz:** não aloja nada. O site continua na Amen, no
mesmo IP. Ela passa a responder pelo DNS e, nos registos marcados, a atender a
ligação, tratar do HTTPS e ir buscar o conteúdo à Amen por trás.

---

## Fase 0 — Enviar as páginas (independente da Cloudflare, faz já)

Não depende de nada do resto, e é melhor ficar feito primeiro: quando o HTTPS
entrar, já há o que servir.

1. Área de Cliente da amen.pt → `cadenceclub.pt` → **Alojamento** → dados de FTP
2. Com o **Cyberduck** ou o **FileZilla** (grátis), liga-te
3. Envia os **cinco** ficheiros desta pasta para a raiz do site
   (costuma chamar-se `htdocs`, `www` ou `public_html`):

   ```
   index.html   privacidade.html   termos.html   estilo.css   idioma.js
   ```

   Os cinco na **mesma pasta**, sem subpastas — o CSS e o JS são procurados por
   nome ao lado do HTML.

4. Confirma em `http://cadenceclub.pt/privacidade.html` (HTTP, ainda sem o S).
   Tem de abrir a página, não a página de estacionamento da Amen.

---

## Fase 1 — Adicionar o domínio na Cloudflare

1. Conta em cloudflare.com → **Add a site** → `cadenceclub.pt`
2. Plano **Free** — está no fim da lista e é fácil não o ver
3. Ela varre a zona e mostra o que encontrou

**Confere os doze, um a um.** É o passo que não se salta: a partir da Fase 3
quem responde por todo o domínio é a Cloudflare, e o que não estiver aqui deixa
de existir.

| Tipo | Nome | Valor | Serve para |
|---|---|---|---|
| A | `@` | `81.88.57.70` | site |
| CNAME | `www` | `onstatic-pt.setupdns.net` | site |
| MX | `@` | `mail-pt.securemail.pro` (prio 10) | **receber email** |
| TXT | `@` | `v=spf1 include:spf.webapps.net ~all` | **email** |
| CNAME | `mail` | `mail-pt.securemail.pro` | **email** |
| CNAME | `smtp` | `smtp-pt.securemail.pro` | **email** |
| CNAME | `webmail` | `webmail-pt.setupdns.net` | **email** |
| CNAME | `autoconfig` | `tb-pt.securemail.pro` | **email** |
| CNAME | `ftp` | `cadenceclub.pt` | **FTP** |
| MX | `send` | `feedback-smtp.eu-west-1.amazonses.com` (prio 10) | Resend |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | Resend |
| TXT | `resend._domainkey` | `p=MIGf…` (longo) | Resend — DKIM |
| TXT | `_dmarc` | `v=DMARC1; p=none;` | Resend |

**Não alteres valor nenhum.** Os IPs e os destinos ficam como estão. Acrescenta à
mão só o que faltar.

---

## Fase 2 — A nuvem laranja

Cada registo tem um ícone de nuvem. **Laranja** = passa pela Cloudflare.
**Cinzento** = só DNS, o tráfego vai direto.

| 🟠 Laranja | ⚪ Cinzento |
|---|---|
| `@` | `mail` |
| `www` | `smtp` |
| | `webmail` |
| | `autoconfig` |
| | **`ftp`** |

A regra: **a Cloudflare só sabe falar HTTP e HTTPS.** Correio e FTP não são HTTP
— em laranja, deixam de funcionar.

⚠️ **O `ftp` é o que mais escapa**, porque aponta para o apex e herda-lhe o
laranja sem avisar. Em laranja, deixas de conseguir enviar ficheiros.

Os `MX` e os `TXT` não têm nuvem — não se proxiam.

---

## Fase 3 — Trocar os nameservers na Amen

A Cloudflare mostra **dois nomes atribuídos à tua conta**, do género
`aria.ns.cloudflare.com`. Ninguém tos consegue adivinhar — só aparecem aqui.

Na Amen: `cadenceclub.pt` → **Servidores DNS** / **Nameservers** → escolhe
*servidores externos / personalizados* e substitui:

```
ns1.amenworld.com   →   o primeiro da Cloudflare
ns2.amenworld.com   →   o segundo
```

Campos para um terceiro e quarto, deixa vazios.

Leva de minutos a 24 horas. A Cloudflare avisa por email.

---

## Fase 4 — SSL

**Não há nada para comprar.** O *Universal SSL* é grátis, automático, e cobre
`cadenceclub.pt` e `*.cadenceclub.pt`. O *Advanced Certificate Manager* é pago e
serve para casos que não temos — se te pedir pagamento, estás no sítio errado.

1. **SSL/TLS → Overview → Flexible**

   Flexible e **não** Full: a origem da Amen devolve **503 em HTTPS**, só serve
   HTTP. Em Full a Cloudflare tentava HTTPS contra ela e o site dava erro.

   O troço Cloudflare↔Amen fica em claro. Para estas páginas é aceitável — são
   públicas, estáticas, sem formulários nem nada privado.

2. **SSL/TLS → Edge Certificates** → o *Universal SSL* deve dizer **Active**
   (aparece sozinho, pode levar até 24 h)
3. Liga **Always Use HTTPS**

---

## Fase 5 — Confirmar

```bash
npm run dns:check
```

Tem de dar **"Zona completa"** — os doze, um a um. Se algum de correio falhar, o
email para; corrige antes de seguir.

O apex e o `www` vão passar a dizer `(via Cloudflare)` em vez de
`(direto na Amen)`. **É o esperado** — a Cloudflare devolve os IPs dela, e é
isso que lhe permite apresentar o certificado. O painel dela continua a mostrar
o `81.88.57.70`, que é para onde ela vai buscar.

```bash
npm run web:check -- --online
```

Tem de dar 200 nas duas páginas, agora em HTTPS.

---

## Fase 6 — A app

Os links já apontam para `https://cadenceclub.pt/privacidade.html` e
`/termos.html`, mas **só funcionam numa build nova** — a que está no iPhone
ainda tem os antigos, que apontavam para um domínio que não existe.

---

## Ainda em falta, e não é DNS

As caixas **`suporte@cadenceclub.pt`** e **`privacidade@cadenceclub.pt`** têm de
existir. Estão nos dois documentos e vão para a ficha da loja — um endereço que
devolve erro é o mesmo problema que um link morto. O domínio já tem correio da
Amen: criar as caixas, ou reencaminhá-las.
