# Inbox E0 — implementação, validação e PRs

22/10/2026. As oito issues E0 têm implementação, SPEC, evidências e PR individual. Nenhum merge remoto ou deploy foi realizado; as issues permanecem abertas até a integração. E1–E4 continuam pendentes.

| Issue | PR | Dependência de revisão |
|---|---|---|
| #298 cores/paleta | [381](https://github.com/diogenesmendes01/erp-genius/pull/381) | baseline Windows PR380 |
| #299 leitura | [382](https://github.com/diogenesmendes01/erp-genius/pull/382) | 381 |
| #300 notas servidor/SSE | [386](https://github.com/diogenesmendes01/erp-genius/pull/386) | 382 |
| #301 notas na thread | [388](https://github.com/diogenesmendes01/erp-genius/pull/388) | base agregada E0, inclui386 |
| #302 prazo vivo | [383](https://github.com/diogenesmendes01/erp-genius/pull/383) | 381 |
| #303 anexos sem ação | [384](https://github.com/diogenesmendes01/erp-genius/pull/384) | 383 |
| #304 rolagem | [389](https://github.com/diogenesmendes01/erp-genius/pull/389) | base agregada E0 |
| #305 menu mensagem | [385](https://github.com/diogenesmendes01/erp-genius/pull/385) | 384 |

Pré-requisitos técnicos separados: [380 Windows](https://github.com/diogenesmendes01/erp-genius/pull/380), [387 exports Next/SSE](https://github.com/diogenesmendes01/erp-genius/pull/387), [390 identidades React](https://github.com/diogenesmendes01/erp-genius/pull/390). A base agregada `codex/inbox-e0-base`797994aa contém381–387; a integração local reúne também388/389/390. Após integrar os predecessores, redirecionar cada PR restante para main e aguardar CI: o workflow só dispara com essa base. CI380 passou; ausência de execução nos PRs empilhados não significa aprovação de CI.

## Regressão integrada

Fonte final `99d045c40fce0a96ae3e9fc3e8e97b8ab81ef85d`, Node22.23.2: sessão86289 acompanhada até código0. Vitest sem filtro/maxWorkers2:845arquivos/6527testes, nenhum ignorado; TypeScript com heap8192 e tipos Next reais presentes; ESLint global0erros/40avisos herdados. Commits posteriores de publicação/fechamento são exclusivamente documentais/PNG/JSON.

Integrações dirigidas na fonte E0 imediatamente anterior7657c528: consultas-pagina/nota-interna26testes sessão87157 e preferencias/motor-presenca13testes56869, ambas código0, sem ignorados. A mudança posterior são duas keys React e seu teste; não altera servidor. Esses39 testes não são a suíte completa de integração.

Aceite visual individual e pareceres independentes estão em `output/inbox-{298,299,301,302,303,304,305}-visual/`; #300 tem revisão/integração de servidor em seu relatório. O fix390 foi confirmado em20entradas sem aviso/pageerror. Somente bancos descartáveis da lista fechada e fixtures fictícias, sem mensagens reais ou integrações externas. Cluster local permanece coordenado pelo integrador.
