# Evidências #306 — fonte e tokens

Fonte UI/testes congelada: `b8d5128a9e18541d24cc5f0e0e0c2e9654102604`. Servidor local preparado/encerrado pelo integrador, Node 22.23.2, perfil dev-email, transportes externos desativados. Nenhuma ação de negócio.

18 PNGs, 3 tamanhos × 2 temas × 3 tipos:

- `app-*`: aplicativo real atual /inbox, antes da injeção de qualquer amostra.
- `mono-local-*`: trechos JSX reais extraídos por AST e renderizados isoladamente com CSS/config reais, fontes Next reais e dados fictícios. Inclui 8 avatares/balões/pontos e 6 trechos de certificado, hashes, input de conferência, código de pareamento e dt de variável contratual.
- `anterior-reconstituida-*`: mesmos trechos com a pilha mono anterior do defaultTheme Tailwind3, explicitamente reconstituída; não é foto de checkout anterior nem referência do protótipo.

`metricas.json` registra origem dos trechos (arquivo/linha/hash/JSX), famílias/weights carregados, tokens computados, geometria, pageerrors e recursos externos. document.fonts.load 400/500 retorna face local; Roboto permanece sans. dt solicita 600 pelo CSS base; face registrada 400–500, síntese permitida pelo navegador. Não declarar face 600 nativa. Hashes no celular passam de 2 para 3 linhas, contidos com break-all; input mantém scroll próprio.

`capturar-mono.mjs`: manual, apenas servidor DEV A local 3110. Precisa INBOX_VISUAL_EMAIL/PASSWORD de fixture local via ambiente, PW_CHROMIUM opcional (Chrome local padrão). Não publicar valores nem seed. Usa dependências já preparadas; não instala nem baixa nada. Código não importa módulos/ações de negócio ao renderizar fragmentos. Capturas formais app×protótipo aguardam harness 307 e ficam separadas destas evidências.

Execução final sessão 31018/chunk c18045 exit0. Zero pageerrors/recurso externo e sem overflow horizontal nas amostras. Sintaxe e ESLint dirigido do harness exit0. Gates globais anteriores à consolidação:845 arquivos/6533 testes, TSC e lint 0/40, Node 22, na fonte b8d5128a. Parecer TESTER de código em `qa/inbox-306-review.md`, sem homologação visual presumida.
