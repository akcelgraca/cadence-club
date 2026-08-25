# Páginas públicas do Cadence Club

Três ficheiros estáticos, sem dependências nem build. Servem-se de qualquer sítio.

```
index.html         entrada, com os links e os contactos
privacidade.html   Política de Privacidade — exigida pela App Store
termos.html        Termos de Utilização
estilo.css         partilhado
idioma.js          alterna PT/EN e guarda a escolha
```

Cada documento traz os dois idiomas na **mesma página**, com um botão a alternar.
É de propósito: as lojas pedem **um** URL, e dois URLs por documento era mais
uma coisa para ficar dessincronizada.

## Antes de publicar — três espaços por preencher

Estão marcados com `[MAIÚSCULAS ENTRE PARÊNTESES]` e uma política de privacidade
com espaços por preencher é pior do que nenhuma:

| Onde | O quê |
|---|---|
| `privacidade.html` §1 | `[NOME OU EMPRESA]` e `[MORADA]` — quem é o responsável pelo tratamento |
| `privacidade.html` §5 | `[REGIÃO]` do Supabase — está em *Project Settings → General → Region*. Não dá para descobrir a partir da app: o Cloudflare à frente só mostra o ponto de presença |

## Os endereços de email têm de existir

O `suporte@` e o `privacidade@` estão nos dois documentos e na ficha da loja.
Um endereço numa política de privacidade que devolve erro é o mesmo problema
que um link morto. O domínio já tem correio da Amen — basta criar as caixas ou
reencaminhá-las.

## Publicar

Qualquer um serve. Por ordem de esforço:

1. **Alojamento da Amen**, que já tem o domínio — enviar os cinco ficheiros por FTP
2. **Cloudflare Pages** ou **Netlify** — arrastar a pasta, apontar o DNS
3. **GitHub Pages** — a partir deste repositório

Os URLs finais têm de ser:

```
https://cadenceclub.pt/privacidade.html
https://cadenceclub.pt/termos.html
```

São os que a app abre (`src/app/profile/settings.tsx`) e os que vão para a ficha
da App Store e da Google Play. Se mudares os nomes dos ficheiros, muda os dois
sítios.

## Rever antes de lançar

Isto foi escrito a partir do que o código **realmente** faz — as permissões
declaradas, os oito eventos do PostHog, as colunas da base de dados, os
fornecedores em uso. Não é um modelo genérico, e por isso está mais certo do que
a maioria.

**Não é aconselhamento jurídico.** Antes de publicar na loja, vale a pena a
revisão de alguém que faça isto — o RGPD tem exigências de forma que um texto
correto no conteúdo pode na mesma falhar.
