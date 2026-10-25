Cópia pública sanitizada somente nos caminhos locais; fonte e resultados históricos preservados.

# Parecer próprio TESTER #347 — fonte716

Fonte exata 716a6261f1bb920bbd4d5c9013535c2acf2ed058, base252b177a05ce718e87584bd0992ff3f21153b72b. Worktree exclusivo worktree exclusivo do TESTER preparado pelo ROOT. HEAD e trackedclean confirmados antes da execução. Perfil SHA256 5b0926e5b01feb50b0c9ede29cdd69eb124c2f563ce20937409d34991722bfcc e client/schema.prisma SHA256 647c2586589198b10c9345265e0cce7a43819d5cb44633dbad5e0e0b611fae2b preservados. Não houve checkout próprio, DB/lease, servidor, navegador, instalação, generate, alteração de configuração, TSC/global ou edição de produção.

Lidos SPEC docs/specs/inbox-faixa-aria-ativa.md, report output/inbox-347-report.md e diff completo dos oito paths entre252 e716. Mudança funcional limitada ao novo componente e import/slot no InboxNovo; resumo/frescura346 reutilizados. Fonte exata inspecionada sem depender da aprovação do DEV.

## Resultado próprio

2026-10-25, início local07:45:51: node --max-old-space-size=1024 node_modules/vitest/vitest.mjs run, --maxWorkers 1. Config vitest.config.ts original, sem filtro de caso, skip novo ou alteração de timeout/exclusões.

Sete argumentos completos sob src/app/(app)/inbox/: aria/FaixaAriaAtiva.test.ts; InboxNovo.test.ts; InboxNovo.aria-eventos.test.ts; InboxNovo.foco.test.ts; ColunaConversas.test.ts; ColunaConversas.interacao.test.ts; InboxNovo.interacao.test.ts. São os seis arquivos DEV69 mais InboxNovo.interacao84: este consumidor adicional é necessário para verificar as barreiras de leitura/cursor/resumo compartilhado que a faixa agora consome.

Executor chunk6f6f19, exit_code0, conclusão síncrona sem session_id emitido. Sem processo desacoplado. Node em primeiro plano, saída 2>&1 via Tee-Object e exit $LASTEXITCODE. Vitest4.1.11:7 arquivos passaram(7),153 testes passaram(153),5.31s(transform1.32s,import2.24s,tests1.99s). Nenhum skip reportado. Aviso existente vite-tsconfig-paths sem alteração. Log privado output/inbox-347-716-functional-tester.log. O componente principal possui10 casos, não12.

## Parecer

Favorável no recorte funcional e na leitura estática, sem bloqueador concreto identificado. Estados ATIVA/pausa/SHADOW/DESLIGADA e agregados recebidos são respeitados; SHADOW prevalece sobre pausa e DESLIGADA remove faixa. Gerenciar depende exclusivamente de podeGerenciar e aponta /aria. role=status contém os textos; link fica fora da região, sem switch/ação global D4, reservada#359. O SSE testa atualização conjunta de faixa/chips, manutenção de identidade e foco do link e preservação do resumo conhecido em falha. As fronteiras antigas de navegação/leitura/cursor também passaram no consumidor adicional. Ícone decorativo permanece aria-hidden.

Esta é prova funcional de7 arquivos completos, não suíte global, TSC, DB/INT ou aceite visual. Não houve medição visual de contraste/wrap/três larguras/dois temas ou homologação de leitor de tela real. Visual e CI/global/tipos continuam gates próprios; a issue não foi marcada concluída. Nenhum comentário de severidade baixa concreto foi omitido: não foi identificado achado acionável nessa leitura.

Janela Node explicitamente liberada ao ROOT após terminal0. QA432 e inspeção350 não iniciados; aguardam preparo/aviso ROOT.
