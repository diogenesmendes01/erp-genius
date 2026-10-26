# Inbox — composição e publicação R24

Fonte executada: `fa1c9fb5d92bb18e7b9ccab430c2d33682633721`. A última branch publicada preserva literalmente SRC, Prisma e configurações dessa fonte. As branches intermediárias contêm somente os respectivos recortes e correções; os gates globais abaixo pertencem à composição, não são reatribuídos aos heads intermediários.

## Verificação executada

- UNIT global original: 1.068 arquivos e 9.454 testes, sem filtros de casos, dois workers; EXIT 0.
- TypeScript original: `tsc --noEmit --incremental false`, EXIT 0.
- ESLint global: EXIT 0, zero erros e 66 avisos.
- Build Next original: EXIT 0; BUILD_ID `zzNiq243Cbv28yyJ1Jd13`.
- TZ=UTC; integrações externas desativadas; banco local descartável coordenado. Dependências e configurações preservadas.

- unit: 2026-10-26T04:25:43.210Z → 2026-10-26T04:32:26.272Z, EXIT 0.
- tsc: 2026-10-26T04:16:51.654Z → 2026-10-26T04:23:41.186Z, EXIT 0.
- lint: 2026-10-26T04:39:22.702Z → 2026-10-26T04:41:17.368Z, EXIT 0.
- build: 2026-10-26T05:00:00.751Z → 2026-10-26T05:14:05.856Z, EXIT 0.

## Revisões e proveniência

- PR #448: pessoas carregam independentemente do resumo opcional; resposta antiga descartada. RED preservado; nove arquivos completos/90 casos e lint focal passaram. Índice D5 alinhado.
- PR #449: sugestão do agendamento somente quando Insights se aplica; perda de permissão invalida resposta/confirmacão pendente sem perder texto manual. Dez arquivos/227 casos e lint focal passaram; reservas e D12 alinhadas.
- PR #450: carga explicitamente “neste setor”; transferência testada com contexto vazio e preenchido. O fixture SECRETARIA já existia no head revisado. Oito arquivos/85 casos e lint focal passaram.
- PR #451: escopo de edição no Inbox documentado; comentário Prisma reposicionado sem mudança de declarações, migração ou geração. O formulário do Funil não é declarado entregue nesta issue.
- #376: delta isolado de presença, 27 nativos ROOT em execuções completas e sequenciais, com restauração do banco. Duas fixtures useId e a tabela de cabeçalhos foram corrigidas; as falhas anteriores permanecem registradas no QA próprio. QA independente do novo head e visual pendentes.
- #361: seleção e busca de conversas existentes; 123 arquivos/1.583 casos na composição focal ROOT, incluindo API de presença e guardas, mais lint focal. A tipagem de uma fixture foi corrigida e os quatro arquivos/50 casos correspondentes passaram. Sem criação por telefone nesta entrega. QA independente e visual pendentes.

## Diagnóstico do build

As tentativas negativas foram preservadas: primeiro erro EPERM ao ler dependência; depois falha do worker PostCSS antes da conexão. O worker gerado foi executado isoladamente: não conectou dentro do sandbox e conectou fora, tanto no Node 22 quanto no 24. A hipótese de diferença de versão não explicou o problema. O cache incompleto foi arquivado sem exclusão; o gate aprovado usou o comando original, fora do sandbox, com cache limpo.

## Limites de aceite

PRs em rascunho. Permanecem o QA independente indicado nos SPECs, aceite visual e CI conforme integração das bases. Nenhum merge em main, fechamento de issue, provedor real ou deploy é declarado por esta publicação. A extensão de acesso #370 não foi incorporada; ancestrais privados de Grant continuam ausentes.
