# #330 — candidata DEV A (ainda sem homologação)

Base:26c4da69f4785ea57d4393a4069a871fa2597915. Branch codex/inbox-e2-330-tarefas. SPEC docs/specs/inbox-tarefas-oportunidade.md. Produção329 permanece congelada em26c; este relatório é só da frente330.

## Execução própria observada

Todos os comandos abaixo usam Node local C:/Users/Mendes/AppData/Local/hermes/node/node.exe; UTC; heap1024; maxWorkers1, config original. São arquivos completos selecionados, sem -t/testNamePattern/skips; não é UNITglobal. Integrações usam vitest.integration.config.ts original/perfildev-email492, uma suíte por vez e leaseRoot exclusiva. External7 blank nos comandos de mutação/concorrência; consulta pura isolada3a4587 não declarou novamente todos os env externos, não invocou provider. Sem alterar profile/client/schema/config/deps/cache/cluster.

| Recorte | Sessão / terminal | Exit | Resultado |
|---|---|---|---|
| Núcleos +4ações iniciais, crm/tarefas.int completo |29779/509ad6|0|2arquivos19 (15CRM+4Inbox)|
| 14ações SQL ampliadas |78979/4083c4|0|1arquivo14|
| Consulta tarefas + painel oportunidades existente |99553/d77b3f|0|2arquivos11|
| Ações18 + pool1real1 + consulta2 |61008/901d01|0|3arquivos21|
| Regressões322 + criar idempotente + painel pool1 existente |38708/d05145|0|3arquivos20|
| Guardas/UI e Confirmar completo, rodada intermediária |55564/7aa6b0|0|10arquivos389|
| Focais atalhos/regras/dispatcher/Aba/UI/executor |64119b|0|6arquivos84|
| Stale-fuso na UI RED→GREEN |b6f2c4→4181bb|1→0|1falha8pass→9pass|
| UNIT final16 completo do recorte |87731/bba26c|0|16arquivos474,60.19s; log output/inbox-330-unit-freeze-private.log|
| Lint whitelist24 final |b0d3c0|0|0avisos/erros; após ajuste stale-fuso|
| git diff --check src/docs |f28d7e|0|sem whitespaceerrors|

Logs privados output/inbox-330-*.log; nenhum deles é novo teste de produção nem arquivo a commitar.

## O que os testes provam e o que não provam

RED inicial de atalhos/consulta/UI é módulo ausente; RED4ações é exportausente. Não chamar isso de prova causal das corridas. Os cenários SQL nativos e negativos ampliados foram adicionados após a primeira implementação e passaram como regressão. RED funcionais próprios observados: Aba perdia tarefas por earlyreturn semlead (5b076d), dois modais versus fluxo curto (ac49c7), podeConfirmar não bloqueava disabled/handler (952e13), atravessar meia-noite enviava dia antigo (4507e9), stale-fuso não disparava atualização (b6f2c4).

Concorrência real: transação bloqueadora em outro PrismaClient trava Atendimento ou Tarefa; worker chama action real e teste observa espera Lock em pg_stat_activity antes de alterar lead/papel/ativo/escopo/convite/equipe e liberar. Não são doubles de SQL. Promise.all com ações reais de concluir/cancelar usa clientes SQL da action; uma conclusão vence, cancelamento natural repetido produz1transição. A observação de espera não afirma ausência global de deadlocks ou serialização global de ACL.

Pool1 real: arquivo próprio altera somente process.env.DATABASE_URL do worker antes do import para connection_limit1/pool_timeout3; profile/env persistentes intactos. Quatro actions públicas reais e leitura do painel terminam usando tx, sem solicitar conexão global interna. Replay de cancelamento mantém quatro Eventos de tarefa das quatro transições.

Aviso nativo: Client pg usa LISTEN; sentinela finita confirma drain. Cancelamento publica1, replay0; falha injetada DEPOIS do UPDATE SQL do aviso reverte tarefa/Evento e publica0. A falha é injeção controlada, não erro PostgreSQL espontâneo. Falha de Evento no330 ainda não tem injeção específica; atomicidade é coberta via falha pósEvento/aviso, sem atribuir àquele cenário uma execução que não ocorreu.

UI: ReactDOM real/Modal/useDialogo/ConfirmarAcao/useAcaoCliente reais; doubles somente de serveractions e SVG (DOM mínimo não implementa namespace). Motivo inválido não chama action, clique duplo único, foco/cancelamento, falha rede sem retry automático, A→B→A antigo sem efeito, alterar motivo durante request não muda argumentos da chamada original nem produz outra, versão/fuso obsoleto exibem mensagem e atualizam. Isso não substitui browser/teclado/aceite visual independente.

## Gates restantes

No checkpoint anterior não havia TSC330/UNITglobal/QA independente; esses três gates agora estão aprovados sobre5e0 conforme seção final. Build330/browser/fixture/aceite APP+PROTO ainda não foram fornecidos como aprovados. Nenhum PR/CI/push/merge330 foi feito pelo DEV. Criar/editar reais permanecem #331, e os extrasD10#338. Root controla baseline492 e restauração; leaseDB A foi liberada explicitamente após terminal38708. Nenhuma issue deve ser marcada concluída a partir deste relatório.
Freeze: fontes acima passam nos recortes declarados; revisão local de equivalência CRM e ordem de locks não encontrou novo conflito concreto. Revisão técnica independente, TSC original/global/build/visual continuam pendentes. O commit que contém este relatório é candidato, não conclusão da issue. Node/DB próprios liberados; caches históricos00b1299a/fc831bc6/v6r3-ac82c9d0 permanecem intactos para arquivamento controlado Root. Inventário read-only de processos não encontrou Next; nenhuma instância foi iniciada pelo DEV330.
## Revisão da fonte697 e correção de formulário

Root TSC54920/2754c9 EXIT2 (TS2739 fixture), FullUNIT46010/7ca0b4 EXIT1 (969arquivos967pass2fail,8246pass2fail8248). Não atribuir os verdes focais anteriores a esses gates. TESTER confirmou risco de remount. Correção filha só3src (TarefasOportunidade.tsx, interação DOM e fixture AbaOportunidades.test.ts) mais SPEC/este relatório/quadro. Backend697 literal, sem nova INT/DB/provider.

RED49350/5944c6 EXIT1,3arquivos42,5fail37pass. GREEN97005/713e5c EXIT0,42. DOM acrescenta refresh irrelevante com outro DTO/versão e MESMO campo/valor, alvo atualizado com ACK obsoleto, alvo removido, remoção/reapresentação, ACK válido após atualização irrelevante e conclusão em versão superada. Todos os negativos anteriores permanecem. A sessão usa identidade estável do atendimento; snapshot de cancelamento invalidado não remonta o formulário, e os callbacks dependem do token/identidade/versão só do alvo. CampoTexto real substitui o campo nativo; tipagem canônica, fixtureTS completa. Nenhum matcher/exceção alterado.

Lint57fefb EXIT1 encontrou ref acessada no render; fonte corrigida com invalidada explícita no estado de snapshot. Lint final3 whitelist4213dd EXIT0,0warnings. UNIT18 intermediária58803/a03e90 EXIT0,509. UNIT final60159/5058f8 EXIT0,18arquivos510,80.13s, sem filtros por nome/skips/todo;15 casos DOM reais do componente. Freeze candidato autorizado pelos recortes próprios, não homologação. TSC/global original/QA independente devem ser reexecutados sobre a filha; source SQL697 mantém os8INT66 já validados pelo TESTER, sem reatribuir SQL a UI modificada.
## Gates originais e revisão independente — fonte5e0f117b

PR [#436](https://github.com/diogenesmendes01/erp-genius/pull/436), draft aberta pelo integrador, branch `codex/inbox-e2-330-publicacao`, head `5e0f117beabc6fa59c3419564c8d7b063850424a`, base real #435. Este filho altera só documentação; fontes de produção/teste permanecem literais5e0.

- ROOT TypeScript ORIGINAL `tsc --noEmit --incremental false`: sessão53463/terminal03fd29, EXIT0, config inalterada e sem exclusões novas; prova privada `output/inbox-330-final-tsc-terminal-root-private.json`.
- ROOT UNIT completa ORIGINAL UTC: sessão19816/terminal1287ab, EXIT0,969arquivos8254testes,234.20s, sem filtros/skips solicitados; provas `output/inbox-330-final-global-terminal-root-private.json` e raw/log correspondentes. Não somar à rodada DEV18/510.
- ROOT lint ORIGINAL `eslint .`: sessão97309/terminalf24d9c, EXIT0,0erros/50warnings, configuração inalterada; provas `output/inbox-330-final-lint2-terminal-root-private.json` e log. A primeira rodada global de lint5e0 havia saído1; é negativa histórica separada. Arquivos privados e caches foram arquivados pelo integrador preservando hashes, sem install/config/ignore novo; o DEV não os moveu.
- TESTER independente no head5e0: parecer favorável informado pelo ROOT (identificador e3c7c1e…),34arquivos completos/749testes mais17controles adversariais, EXIT0. Backend continua literal697; integração independente8arquivos66testes foi concluída e o banco restaurado. Não agregar essas contagens às unitárias nem tratar testes instrumentados de falha como SQL concorrente.

Os negativos originais TS2739/CampoTexto/remount da fonte697 e o lint intermediário permanecem no histórico acima. A aprovação técnica sobre5e0 os substitui como estado atual; não transforma a execução697 em green. Ainda pendem aceite visual APP/PROTO e demais gates de publicação/CI/merge coordenados pelo integrador. PR draft e feature não marcada concluída; nenhuma publicação foi feita pelo DEV. #331 criar/editar e #338 extras seguem reservadas. Sem nova execução de Node/SQL/DB nesta atualização documental.