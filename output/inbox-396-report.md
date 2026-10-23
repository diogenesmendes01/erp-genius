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

Pendente: porte mínimo no agregado autorizado, global e publicação pelo integrador. TESTER e prova browser do isolado constam abaixo. Sem suiteDB/seed/preview iniciado pelo DEV, instalação/package/lock/schema/servidorSSE/permissão/transportes reais. Nenhuma homologação presumida.

## Prova do isolado no navegador e revisão independente

Fonte produtiva babd1fe60c99483923b7c78411f639081acff486, Node22/Next16.3.5/Chrome155/Playwright1.56.1top, perfil dev-gravacoes. O integrador informou TESTER independente favorável no SHA exato: 7 arquivos/41 testes, sessão e784b60, saída0. Sem alteração produtiva após os gates DEV já observados.

Probe privado output/inbox-396-browser/probe-closed.mjs, SHA256 d46c98de5e77f20ded6c10947e19f7b0381b5703862a5dcc7464648f6c0fcecd. Sintaxe/check/help terminaram com saída0 antes de abrir o navegador. O primeiro preflight falhou por importar um predicado React ausente no harness histórico311, antes de iniciar browser. O negativo e hash403afc foram preservados. A correção foi exclusivamente privada: mesmo predicado da composição atual declarado no probe, sem mudar script compartilhado ou guard global.

Execução d56ad6 terminou saída0. Abertura autenticada em /home preservou a Sidebar; a interceptação respondeu503 em exatamente uma conexão /api/inbox/eventos e depois deixou o transporte passar ao servidor real. Um listener nativo de error, registrado antes do onerror produtivo, observou readyState=2 antes de a aplicação fechar a fonte. StrictMode havia criado/fechado a fonte1; fonte2 recebeu o503. Após CLOSED não havia fonte ativa nem nova fonte antes da próxima assinatura. O intervalo de observação250ms não é prova de carga prolongada; o código não cria timer/retry.

O clique real no Link Inbox navegou /home→/inbox e criou somente a fonte3. A SSE respondeu200 real, data-conectado ficou1, máximo de fontes ativas foi1 e houve um único documento/timeOrigin. A identidade DOM da navegação Sidebar permaneceu conectada e igual. A assinatura antiga recebeu o resync da primeira abertura da substituta: stack privado comprovou fonte.onopen→avisar→aoAviso→recontar→executar→fetch /api/inbox/nao-lidas. Não se fabricou evento, prop ou JSON de negócio para esse resultado. Nenhum PG, SQL, seleção de conversa, submit ou envio foi necessário.

Zero falhas; dois diagnósticos privados esperados (response503 e console503 do request exato). O classificador só reconhece essa injeção local; os guards globais permanecem intactos. Não é simulação de deploy real. As duas imagens home-closed/inbox-recuperada foram inspecionadas favoravelmente e ilustram a UI histórica311 do SHA babd, sem atribuição estética à composição313/315.

Allowlist explícita output/inbox-396-allowlist.json: 2 PNGs,177.044bytes, cada item com arquivo/bytes/SHA256/tipo/fonte/inspeção. SHA256 da allowlist:58f178e39520f280cdc10e6f328e47fda9306d82eedb60532e0df9c881b1bb57. Resumo sanitizado output/inbox-396-evidencias.json sem rawstack/corpos/traces. Scripts, manifestos brutos, logs e negativos ficam locais e privados, foraGit/ZIP. Nenhum binário novo no Git.

Browsers/contexto foram fechados no finally antes de o integrador encerrar o preview29353. Depois da confirmação do stop, removeu-se exclusivamente o bloco Next gerado emAGENTS. Fonte isolada permanece pronta para o porte mínimo coordenado; global, depósito remoto e publicação ficam com o integrador. Sem homologação presumida.
