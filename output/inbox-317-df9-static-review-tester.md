# QA estática independente #317 — fonte final pré-browser

HEAD exato `df9aa83cec1f3c96e9cb1794db58bb3b14021b3b`. Parecer estático **favorável**, limitado ao código e à preparação do probe; aceite de navegador e #319 ainda pendentes.

`git diff --exit-code` confirmou identidade byte a byte de `ConversaAberta.tsx`, `RodapeConversa.tsx`, `Compositor.tsx` e `botoes-mapa.ts` com a fonte #317 `a86c9ade33606350c1551c6a5759ebecc9366d6b`. `useBuscaConversa.ts` e seu teste são idênticos ao fix C2 `7a82506297cdbb38f9146fd4d6528a6f49c4e44e`. Não houve delta em `scripts/visual` desde o harness `bf4ad547c86480f3676824830a7f416d34c3d560`; os demais deltas são testes/documentos. Os pareceres estáticos anteriores de #317 e C2 se estendem ao objeto produtivo desta composição, sem reatribuir browser/global alheios.

Recorte próprio Node 22.23.2: cinco arquivos dirigidos de Rodapé, Compositor, ligação real e hook C2, **66/66 testes e exit 0**, executor `070712`; sintaxe do probe privado `node --check` exit 0 na mesma execução. Não houve filtro por nome, integração DB, navegador, servidor ou instalação. O tracked status está limpo.

Probe independente preparado em `output/qa-317-tester-normal.mjs`, ainda **não executado**. Matriz 320×500, 390×844, 1024×768 e 1440×900, dois temas, sobre fixture fictícia Beatriz/Thiago. Confere abas/tabpanel e teclado Home/End, alvos 44 px e overflow, rascunhos locais Responder/Nota separados por contato e modo em A→B→A, identidade física da área da thread ao alternar abas, agenda real abrir/Escape sem submit, zero erros de página/acessos externos. Só preenche rascunhos de `localStorage`; não aciona Enviar, Nota, Agendar, Assumir ou qualquer comando de negócio. Capturas serão anonimizadas e acompanhadas de SHA256. O caso negado real Lucas/SECRETARIA/ENCERRADO e erro GET painel poderão ser feitos em complemento dirigido após comprovar o normal, sem fabricar resposta de domínio.

Os seletores/esperas serão conferidos no preview real antes de atribuir falha à UI. A prova C2 de lista longa/entrada SSE está separada e depende da fixture privada e coordenação do integrador. Nenhum banco ou preview TESTER foi tocado nesta etapa.
