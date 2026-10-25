# Inbox #354 R2 — Desfazer usa neutro canônico

Base2af4c7d1fe1cff7d27077f09d950822fbf45cd1a. Correção real de frontend e seus registros/testes, filha isolada. Não modifica design system, backend, ACL/DTO, confirmação/foco/gerações, contrato obrigatório atendimentoId, schema ou futuras355–357.

## Negativo original preservado

ROOT autorizou os gates ORIGINAIS no freeze2af4, somente TSC e eslint em paralelo. Head antes7dd7d7/depois734505/ce12ed idêntico, árvore versionada limpa. Pins tsconfigE7193619FB59BBAEF13F2ED33209FAE597FEBD8A3D3B38098A3F49FB51BA2984, eslint6D5342000A0CCF25EC4E45D2AD1F8723159E31CD91E606773EE4838E66F9256B, perfilAE0F5496... e client647C2586... preservados.

- TSC84020/5d68c6 EXIT2: node --max-old-space-size=8192 node_modules/typescript/bin/tsc --noEmit --incremental false.6diagnósticos: TS2322REAL em CartaoSugestaoAria.tsx:80, variantecontorno não pertence a VarianteBotao; outros5TS2769 em3cópias privadas históricas faltando atendimentoId.
- eslint .55099/ae17b5 EXIT0: original sem filtros/exclusões adicionados,0erros/98avisos, classificados40src+58output em output/inbox-354-2af4-lint-avisos-private.json.
- Recibo privado: output/inbox-354-2af4-gates-original-private.json SHA256e157f3d50f5e938bc496fb62ec5c76b6e0358cd7a32f9da5330d3578b8286135. LogTSC SHA25635e3afbdb3eade6d8c5b62efba3e420f073a1258ca84ea034d0554bb401c1e01; loglint SHA2564c5833c7b4b2acaa3153120b510a48d45c65d636c55e0a8465c28b74e084ccf8.

As cópias antigas eram UNTRACKED/NÃOIGNORADAS: output/inbox-350-foco-red-tester-original-private.test.ts (3diagnósticos), output/inbox-434-cartao404-oraculo-preservado.test.ts e output/inbox-434-cartao404-oraculo-props.test.ts (1cada). ROOT arquivou fisicamente em a88569, preservando bytes/hashes84bc7e4b...,8bdd3efd...,08edc23f.... Destino informado: C:/Users/Mendes/.codex/visualizations/2026/10/22/01a1652c-733b-72b2-954c-2020bb1ca837/inbox-build-cache-root-20261025-r1/b354-private-oracles-20261025-1618/. Manifesto do integrador output/inbox-354-b-private-oracles-archive-root-private.json. DEV não moveu/editou/copiou de volta nem alterou configuração/cache. Não há TSCgreen dessa fonte antes do replay.

## TDD e correção

Botao já oferece neutro: bordergray200/bgtransparent/textgray800/hoverhighlight. Contorno não existe na API; usá-lo produzia classundefined no HTML além do erro de tipo. A correção troca SOMENTE a prop de Desfazer para neutro. Sem criar variante nova ou classes sobrepostas.

RED93c55e EXIT1:11casos,10passagens/1falha correta. Teste usa API pública botaoClasses({variante:neutro}) e exige a classe real do botão Desfazer, semundefined. Não espelha o mapa interno da implementação.

Mapa declarativo passa terceiro de contorno/md para neutro/md. Âncora AST mantém exatamente3Botao,import/projeção não mutada, dois filhos dinâmicos/variantes originais e terceiro JsxTextliteralDesfazer com neutro. Negativos existentes preservados (textovazio, projeção/origem/variante alteradas, botãoextra); recusa terceirosecundário e também terceirocontornoinexistente. Nenhum resolvedor/parser genérico alterado.

GREEN34172/a2537c EXIT0:24arquivos/510casos,46,19s, worker1/heap1024, configuração unit original, sem filtro de caso/skips no resumo. Recorte: pasta inbox/aria, consumidoresConversaAberta e InboxNovo.interacao, componenteBotao, guardas botoes/paleta/contraste/contraste-elementos/tipografia/confirmacoes completos. Handlers/identidade404/ACKvelho/foco e declaração canônica permanecem aprovados no recorte. Lint4 61127e EXIT0 --max-warnings=0 nos quatro arquivos tocados.

## Limites e próxima validação

Não repetida INT45 porque src/server é literal2af4. Também permanecem literais components/Botao/Modal/ConfirmarAcao, package/locks/schema/config/perfil/client. Todos Node desta rodada encerrados; banco semleaseB, nenhuma SQL/HTTP/Next/browser/build/install/env executada.

TSC original REPLAY aguarda GO ROOT e memória do compiladorA; não executar pesado por conta própria. QAfilha, gates globais e visual separados do integrador. Não atribuir gates21f/8b à354, não marcar issue concluída ou D3 implantado. SemPR/push e sem implementação355.
