# Inbox #347 — relatório DEV

Base252b177a05ce718e87584bd0992ff3f21153b72b (#346), branch codex/inbox-e3-347-faixa-aria. Componente FaixaAriaAtiva e import/slot no InboxNovo; resumo fresco346 reutilizado literalmente. Sem mudança no produtor344, atualização346, SSE345, servidor, ACL ou configuração. D4/switch/ação global reservados à359. Gerenciar é navegação /aria somente pela capacidade recebida. Textos status em role=status, link fora dessa região e foco preservado.

## Evidências terminais

- Histórico consumidores sessão81813/chunk0689f9 EXIT1: dois arquivos completos39 casos (5 falhas novas/34 controles). Primeiro setup de teste isolado falhou por pasta ausente, sem teste executado.
- Retomada: d536fe EXIT1 opção minWorkers incompatível, administrativo; 6db2ea EXIT1 módulo Faixa ausente, zero casos. Scaffold null f085d8 EXIT1:10 casos,7 falhas comportamentais/3 controles. Não confundir com12 casos.
- Primeiro GREEN6a81cb EXIT1:47/49, dois consumidores identificaram ausência do aria-label; corrigido na faixa, sem relaxar testes.
- GREEN dirigido2df9c5 EXIT0: três arquivos completos49/49, log inbox-347-green-dirigido-private.log.
- GREEN consumidores ea851c EXIT0: seis arquivos completos69/69 (Faixa, InboxNovo SSR/eventos/foco, Coluna SSR/interação), log inbox-347-green-consumidores-private.log.
- Lint69d8d8 EXIT0: cinco arquivos alterados de código/testes, log inbox-347-lint-private.log.

Executores separados, Node local, heap512, um worker; nenhum filtro de caso/skip novo. Sem session_id porque concluíram sincronamente com exit_code terminal. Vitest emite aviso preexistente vite-tsconfig-paths; não alterado. Recortes não são suíte global. Ajuste final hover usa token existente highlight e whitespace EOF foi normalizado; repetição final registrada abaixo.

## Limites e pendências

Visual finito em três larguras/dois temas, QA independente no commit exato, TSC/global/CI e homologação aguardam ROOT. Sem DB/INT, migração, instalação/generate/package/env/cache/provider, servidor/preview/navegador/captura ou mensagem real. Não houve push/deploy. Fonte346 protegida; output350 e evidências anteriores preservados. SPEC docs/specs/inbox-faixa-aria-ativa.md; quadro único atualizado sem concluir a issue.

Verificação final c80b0f EXIT0: seis arquivos69/69 completos, lint dos cinco arquivos com --max-warnings0 e git diff --check, todos terminados. Logs inbox-347-green-final-private.log/inbox-347-lint-final-private.log; nenhuma aprovação visual/TSC/global implícita.

## Correção de integração — Gerenciar canônico

O TESTER aprovou sete arquivos completos/153 testes no commit716, terminal6f6f19 EXIT0. O recorte não incluía a guarda global de botões. A primeira suíte completa ROOT identificou em `botoes.test.ts` o link Gerenciar montado com classes próprias; foi interrompida na mesma sessão31757/168b60 EXIT1 para corrigir o defeito, sem alegar conclusão global. Diagnóstico independente confirmou a causa.

RED próprio df9b56 EXIT1: um teste novo falha e dez controles passam, exigindo a superfície canônica no link. A correção mantém link real e cor AI com a variante opt-in `iaFantasma`, registra sua combinação no mapa declarativo e não altera guardas ou variantes existentes. GREEN5bef7c EXIT0: três arquivos completos/105 testes, incluindo a guarda integral de botões; lint dos cinco arquivos dc8c34 EXIT0. Nenhuma captura visual anterior é atribuída ao novo estilo.

TypeScript original final, sem exclusões ou mudança de configuração, heap8192/incrementalfalse: sessão47511/c27643 EXIT0. A tentativa inicial heap4096 terminou OOM1f61b0 e foi preservada; nova medição mostrou43GB livres antes da repetição. Lint integral anterior terminou0efcbe EXIT0 com47 avisos (40 no código rastreado e sete em executores privados existentes); o lint dos cinco arquivos corrigidos não teve avisos. A suíte global final foi iniciada na sessão92937 e ainda não é declarada aprovada neste registro. Visual e CI continuam pendentes.


Fechamento posterior ROOT: a mesma suíte global final92937 terminou655010 EXIT0,950 arquivos/7597 testes UTC,227,32s,w2heap1536,sem filtros/skips. TESTER repetiu no287 nove arquivos248 testes incluindo guarda85, sessão19598/495e17 EXIT0. Parecer público e hashes em output/inbox-347-qa. Runtime287 preservado nesta curadoria documental; visual/CI/build ainda pendentes.
