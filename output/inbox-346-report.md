# Inbox #346 — entrega DEV em validação

Base: abb961625f57bf20d9eb4734df98e59dda362957; branch própria codex/inbox-e3-346-badges-chips. Implementação exclusivamente cliente: projeções de estado/selo/prévia, sete chips do resumo já existente e estado/reconciliação do resumo na coluna. Mantidos helpers/API cinco chips, fallback sem resumo, filtros pessoais eu/ID/naoLidas, SLA/atraso30 min e produtores343–345. D1/D2 não implementadas. SPEC: docs/specs/inbox-badges-chips-aria.md.

## TDD e evidências nominais

- RED projeções63831b EXIT1: sete falhas de asserção + módulo chips-inbox ainda ausente, 31 casos existentes passaram. GREEN e9b979 EXIT0: três arquivos completos, 41/41 (estado-visual, ItemConversa, chips-inbox).
- RED cliente232ad6 EXIT1: cinco falhas novas, 11passaram. GREEN sessão50471/f9b35b EXIT0: três arquivos completos, 16/16 (ChipsFiltro, ColunaConversas, InboxNovo.aria-eventos). ReactDOM/act e histórico reais no teste de SSE; fontes, ações e geometria simuladas. Não é prova visual/browser.
- Leitura/cursor: arquivo InboxNovo.interacao completo, sessão34521/aeefd6 EXIT0, 84/84. Novos casos: leitura pendente não aplica resumo, resultado sucesso/falha exige GET fresco e cursor não pede/substitui agregados. Esse harness simula hooks e examina props reais da coluna; os casos ReactDOM complementam a prova.
- Tentativa ampla58990/529fe6 EXIT1: 23 arquivos/347 casos passaram, worker terminou com FATAL heap512 (~509MB); sem falha de asserção funcional registrada. Negativo administrativo preservado. Não é24 arquivos verdes.
- Replay23 já havia iniciado quando ROOT orientou não repeti-lo; acompanhado até terminal na mesma sessão9198/f29dd2 EXIT0: 23 arquivos completos, 347/347, heap512/w1. Sem mudança de fonte entre executores. Não haverá repetição por rotina.
- Guarda AST restante: enums-rotulos completo, sessão64382/4833d9 EXIT0, 131/131, heap1024/w1/verbose/configuração e timeout originais, 74, 47s(import68, 66s). É um executor separado; não somar como um único comando24verde nem chamar recorte de global.

Os 23 arquivos do replay: estado-visual.test.ts; ItemConversa.test.ts; chips-inbox.test.ts; ChipsFiltro.test.ts; ColunaConversas.test.ts; ColunaConversas.interacao.test.ts; InboxNovo.test.ts; InboxNovo.interacao.test.ts; InboxNovo.foco.test.ts; InboxNovo.detalhes.test.ts; InboxNovo.aria-eventos.test.ts; ListaAtendimentos.test.ts; painel-inbox.test.ts; filtros-url.test.ts; prazo-vivo.test.ts; prazo-vivo.interacao.test.ts; prazo-visual.test.ts; prazo-hidratacao.test.ts; sem-polling.test.ts (todos em src/app/(app)/inbox); src/app/paleta.test.ts; src/app/botoes.test.ts; src/server/inbox/previa.test.ts; src/server/inbox/filtros.test.ts. Comando Node22 local node_modules/vitest/vitest.mjs run com esses paths e --maxWorkers 1; nenhum filtro de caso ou skip introduzido. Guarda131 casos em outro comando com apenas src/app/enums-rotulos.test.ts.

## TypeScript e lint

TSC original local: sessão 59652, heap8192, --noEmit --incremental false. Interrompido SOMENTE por coordenação do ROOT via Ctrl+C na MESMA sessão: 1aad6a EXIT1. Nenhum diagnóstico foi emitido (log 0 bytes); não é GREEN nem falha funcional atribuída. A leitura administrativa 14263/36c5f9 EXIT0 registrou Node PID3017880 com PrivateMemory5.187.887.104 B e apenas 3.452 KB de memória física livre. Após interrupção, 41018/99c0f4 EXIT0 confirmou PID ausente e 1.884.336 KB livres. Esses dados comprovam pressão física; não declaramos OOM do TSC. Configuração original preservada, nenhuma exclusão adicionada. TSC e global do commit exato deverão ser executados pela CI remota coordenada pelo integrador; gate de tipo permanece PENDENTE localmente.

Lint dirigido dos 12 SRC/testes alterados: 463176 EXIT0, heap512, --max-warnings 0. Nenhum teste, TSC, global, DB ou captura adicional foi iniciado após a liberação exclusiva desse lint.

## Limites e próximos gates

Não houve INT/DB/fixture, instalação/generate/DDL, troca de perfil, preview/browser/captura, provider ou mensagem externa nesta frente. Banco B492 restaurado pelo ROOT antes da entrega (937809) e sem lease DEV. Cliente próprio490 preservado; nenhum acesso para esta implementação. Os artefatos350 e seus negativos/corpus estão preservados em output privado; não entram nesta funcionalidade.

Visual ainda pendente: cinco estados aria-* e Handoff ativo, 1440x900/1024x768/390x844 claro/escuro, comparação honesta com o protótipo; fixture/harness/ownership/GO separados pelo ROOT. Sem alterar demo canônica ou scripts compartilhados. QA independente, união com328/350, global/CI integrada e publicação permanecem sob integrador; não chamar346concluída sem esses gates.

## Freeze para integração

O integrador autorizou o commit de fonte com TSC, visual e QA explicitamente pendentes, sem fechamento da issue. Somente cinco runtimes cliente e seus sete arquivos de teste mudam nesta frente. page.tsx, ItemConversa.tsx, Avatar, backend, schema, dependências, scripts, fonte SSE e histórico da thread foram conferidos idênticos à base abb96162 em b3cfef EXIT0. A SPEC e este report, junto do adendo ao quadro, completam a whitelist de 15 paths. Nenhum binário, executor/log privado, AGENTS ou artefato350 será incluído. CI/TSC remotos aprovados futuramente terão fonte e executor próprios; não serão reatribuídos a este TSC interrompido.

## ROOT — revisão R1 #431

Reproduções d8e18f EXIT1: dois arquivos, três casos novos falharam e 35 controles passaram (filtros invisíveis e prévia vazia). Primeiro recorte 93537/ca4a3b EXIT1: 146 passaram, duas guardas cobraram o registro nominal dos novos seletores. Nenhum negativo foi reclassificado. Após registrar exatamente os dois controles, execução 57597/4d17ae EXIT0: oito arquivos completos, 148 testes, UTC, heap1024, um worker, sem filtros de caso ou skips. Inclui ColunaConversas/interação, PopoverFiltros, ChipsFiltro, estado-visual/servidor, botoes e estados-vazios. Lint dos seis arquivos alterados 6ec062 EXIT0 e zero avisos. Config original, sem banco/HTTP/provedor/browser. QA independente, suíte integrada, CI e capturas continuam separados.