# Especificação: Menu Social (Feed · Clubs · Mensagens)

Substitui a tab "Feed" por "Social" na bottom bar. Um único ecrã com 3 sub-abas deslizáveis horizontalmente (swipe) e indicador que acompanha o gesto.

## Estrutura de navegação

```
(tabs)/social/
├── _layout.tsx        # header "Social" + tab bar superior + pager
├── feed.tsx           # aba 1 — estilo Instagram
├── clubs.tsx          # aba 2 — estilo WhatsApp
└── messages.tsx       # aba 3 — estilo Instagram Direct
```

Implementação do swipe: `react-native-pager-view` + tab bar própria, ou `react-native-tab-view` (usa pager-view por baixo). O indicador ativo interpola a posição com o scroll do pager (`position + offset`), não salta por onTabPress.

Ícone da tab bar inferior: `users` ou `message-circle`; label "Social".

## Tokens

| Token | Valor | Uso |
|-------|-------|-----|
| accent | coral #D85A30 (ajustar à tua cor de marca) | indicador de aba, FAB, boost ativo, anel de story |
| unread | verde #1D9E75 | badge de não lidas, dot online |
| título de ecrã | Barlow Condensed 600, 24 | "Social" |
| aba | Barlow 500, 14 | ativa: texto primário + indicador 2px; inativa: cinza 40% |
| nome/título de linha | Barlow 600, 15 | posts, clubes, conversas |
| texto secundário | Barlow 400, 13 | previews, timestamps |
| métricas de corrida | DM Mono 400, 13 | 8,2 km · 5'12"/km · 42:38 |
| avatar lista | 44 px círculo | clubs e mensagens |
| avatar story | 56 px + anel 2px | anel accent = por ver; cinza = visto |
| espaçamento base | 4/8/12/16 | padding de linha: 12 vertical, 16 horizontal |

## Aba 1 — Feed (estilo Instagram)

Scroll vertical de cartões de atividade, largura total, separados por hairline (sem cards flutuantes).

Anatomia do post: (1) linha de autor — avatar 36, nome, tempo + local, menu "…"; (2) mapa da corrida edge-to-edge (Mapbox static image, rácio 4:3 máx 320px altura) com chip do tipo de atividade; (3) linha de métricas em DM Mono; (4) ações — boost (raio, accent quando ativo), comentar, partilhar, contagem à direita; (5) primeiros 2 comentários + "ver todos".

Topo: fila de stories horizontais (opcional na v1 — pode ser "atividades de hoje dos que segues"). Pull-to-refresh. Double-tap no mapa = boost (com animação do raio).

## Aba 2 — Clubs (estilo WhatsApp)

Lista vertical de linhas de clube, hairline entre linhas, sem cards.

Anatomia da linha: avatar 44 (foto do clube ou iniciais em fundo tint) · coluna nome + última atividade ("Rita: sábado às 9h?", "Desafio de agosto publicado") · coluna direita com timestamp (verde se não lido, cinza caso contrário) + badge circular verde com contagem.

Ordenação: última atividade desc. Estados de linha: normal, não lido (nome + timestamp reforçados), silenciado (ícone bell-off, sem badge).

Extras: FAB accent (+) canto inferior direito = criar clube; célula "Descobrir clubes perto de ti" no fim da lista (ícone bússola); tocar numa linha abre a página do clube (feed do clube, sessões, membros — ver ADR-001).

Empty state: "Ainda sem clubes" + ilustração + botões "Descobrir clubes" e "Criar clube".

## Aba 3 — Mensagens (estilo Instagram Direct)

Barra de pesquisa no topo (campo arredondado, fundo surface). Lista de conversas: avatar 44 com dot online verde (borda 2px do fundo), nome, preview + timestamp na mesma linha secundária, ícone de câmara à direita. Não lido: nome e preview a peso 600 + dot accent à esquerda do ícone.

Header da aba muda a ação direita: Feed = notificações (sino), Clubs = pesquisa, Mensagens = nova mensagem (lápis). Swipe em linha: silenciar / apagar. Conversa aberta: bolhas — enviadas em accent com texto branco, recebidas em surface; partilha de atividade renderiza mini-card com mapa + métricas.

## Comportamento das abas

Indicador: 2px, cor accent, largura do label, interpola com o gesto. Badges nas abas: "Mensagens (2)" e dot no label Clubs quando há não lidos. Estado inicial: Feed. A aba ativa persiste durante a sessão (Zustand), não entre sessões. Conflito de gestos: no Feed, o swipe horizontal do pager convive com scroll vertical; nos mapas dos posts desativar gestos do Mapbox (imagem estática) para não roubar o swipe.

## Acessibilidade

Tab bar superior: `accessibilityRole="tablist"`; cada aba `role="tab"` + `accessibilityState={{selected}}`. Swipe é atalho, não único caminho — as abas são sempre tocáveis. Contraste: verificar coral sobre branco para texto pequeno (usar para elementos gráficos e texto ≥18px; timestamps accent em verde escuro). Badges anunciam "3 mensagens não lidas".

## Levar para o Figma

1. Frames 390×844 (iPhone 15) — um por aba + variantes (empty states, não lido, conversa aberta).
2. Criar os tokens acima como variables (color/typography) antes de desenhar.
3. Componentes: TabBar (3 variantes de aba ativa), PostCard, ClubRow, ConversationRow, FAB, Badge, StoryAvatar.
4. Protótipo: ligar as 3 frames com trigger "on drag" horizontal para simular o swipe.
5. Alternativa rápida: importar o mockup HTML desta conversa com o plugin gratuito "html.to.design" e refinar.
