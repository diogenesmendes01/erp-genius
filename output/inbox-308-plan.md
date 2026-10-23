# Plano de execução — Inbox #308

Plano de origem: docs/superpowers/plans/2026-10-22-inbox-prototipo-02-design.md, Task3; ruling integrador output/inbox-308-coordenacao.md e mensagens.
Base:103a507d8a8fda7a6758a4eee46177d4c3ce7a67, branch codex/inbox-e1-308. Aprovação explícita da concepção e implementação recebida. Sem subagentes; TESTER independente coordenado pelo integrador.

1. TDD SSR/page/InboxNovo: casca limitada sem moldura, uma montagem do painel e ponte sino/Novo; contratos/estado efetivo de painel e viewport.
2. Implementar somente casca e semântica/foco, preservando exatamente leitura/count/SSE310. Candidato uniforme duas colunas960, lista300 no tablet/372desktop, painel348; limiar três colunas provisório1400, a substituir por medida real se necessário.
3. TDD e atualizar CLI/espera-app para painel-fechado, novo gatilho e conteúdo por estado. Preservar negativos e isolamento de rede307.
4. Solicitar integrador preview3110; medir compositor humano preenchido/controles antes de fixar limiares. Sem suíte truncante no dev-email reservado à UI.
5. Recortes pertinentes, TSCheap8192/lintNode22, SPEC/quadro/report e capturas reais inspecionadas. Global sob janela do integrador. CongelarSHA paraTESTER sem declarar aceite independente.

Ruling:Sidebar224 e compositor intactos. Duas colunas precisam de limiar uniforme que também caiba depois de md;700..767 não terá faixa transitória de duas colunas. Ajustes de700/1100/1200 documentados com dados. Painel automático só quando três colunas couberem; abaixo manual sobreposto. Sem schema/pacote/lock/transportes externos.
Estado: implementação congelando para revisão independente; recortes e provas DEV concluídos. Global combinado será executado pelo integrador.

Ruling final: isolamento modal local sem véu, após capturar/focar e com limpeza de layout antes de devolver foco; preservar inert preexistente. OptOut/Modal global não mudam; retorno BODY da confirmação é limitação anterior documentada. Limiares medidos mantidos960/1400.
