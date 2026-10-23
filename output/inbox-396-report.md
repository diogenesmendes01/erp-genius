# PR396/#311 — revisão B1 e nota C1

Base isolada:5ff849d152f34c81c19dffded5ad1193b42c4549, remoto confirmado via connector antes do checkout. Branch própria codex/inbox-311-b1. Revisão [R1](https://github.com/diogenesmendes01/erp-genius/pull/396#pullrequestreview-5622881207). Sem merge do agregado313 na311; porte será commit separado sobre a composição indicada pelo integrador.

Causa confirmada: onerror só notificava false, mantendo encerrar não nulo mesmo quando readyState=CLOSED. Sidebar preservada impedia criar fonte em nova montagem da Inbox. CONNECTING é diferente: o navegador ainda reconecta e não deve haver duplicação.

Correção localizada em eventos-inbox: CLOSED desativa callbacks/fecha recurso/libera ciclo; próxima assinatura cria uma fonte e preserva assinantes antigos. Token por ciclo é reservado ANTES da instalação para suportar fechamento e nova assinatura síncronos. O retorno antigo só atribui seu próprio token, nunca a referência nova. Primeira abertura da substituta emite resync coletivo; reconexão nativa e assinante tardio conectado conservam contratos. Nenhum timer/retry/polling, endpoint/SQL/store/Inbox alterado. O tipo readyState é readonly number; duas fixtures passaram a representar close como estado2. API de três argumentos continua válida, com callback opcional interno de encerramento.

## TDD e gates observados

- RED b5b345 terminou saída1: filtro B1,3falhas/1pass/3skip. Falhas causais: CLOSED não fecha recurso, nova assinatura não cria substituta e encerramento durante instalação não recupera. CONNECTING já passava sem duplicar. Log privado output/inbox-396-red.log preservado, não é suíte completa.
- GREEN inicial9ce4f1 terminou saída0:2arquivos10testes, sem filtro/skip. Casos cobrem Sidebar antiga+novo consumidor+resync/eventos/conexão, CONNECTING, callbacks velhos, instalação síncrona e regressões anteriores de StrictMode/cleanup/último unsubscribe/reconexão.
- Recorte5741 terminou saída0:31arquivos365testes, sem filtro por nome/skip, maxWorkers2. Inclui Inbox, sem-polling, helper/hook, selo/loja, Sidebar/BarraMobile, layout, route401/403 e guards AST de identificação/confirmações. Não é suíte global.
- Lint3fontes d631dd terminou saída0, sem avisos. Typegen gerou tipos atuais com sucesso; TSC19799 heap8192 terminou com saída0, observado na mesma sessão até saída terminal.

Comandos Node22 locais: vitest run src/lib/eventos-inbox.test.ts src/app/(app)/inbox src/components/SeloNaoLidasInbox src/components/Sidebar src/components/BarraMobile src/app/(app)/layout.test.ts src/app/api/inbox/nao-lidas/route.test.ts src/app/identificacao-registro.test.ts src/app/confirmacoes.test.ts --maxWorkers=2; next typegen; tsc --noEmit --pretty false com heap8192; eslint nas três fontes alteradas. Aviso do vite-tsconfig-paths preservado, sem mudar dependências. Logs locais privados foraGit.

C1 foi atendida somente com nota de capacidade na SPEC: uma SSE por aba, custo por múltiplas abas, limites HTTP/1.1 e recomendação de verificar HTTP/2 no proxy. Não afirma configuração existente nem altera infraestrutura/contagem. C2 segue integrador, LOWC3–C5 diferidos. Fontes3943a/e657 e artefatos313/676 continuam imutáveis.

Pendente: TESTER exato, porte mínimo no agregado autorizado, browser local coordenado e global/publicação pelo integrador. Queda controlada no browser será identificada como transporte privado, sem alegar deploy real. Sem suiteDB/seed/preview iniciado pelo DEV, instalação/package/lock/schema/servidorSSE/permissão/transportes reais. Nenhuma homologação presumida.
