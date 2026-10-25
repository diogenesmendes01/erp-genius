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
