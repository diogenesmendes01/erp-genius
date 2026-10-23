# Inbox E1 — base dos produtores #306/#307/#309/#310

As quatro entregas têm PRs separados, revisão independente e gates observados. A base agregada é para desenvolver as dependentes; os PRs permanecem abertos e não houve merge remoto ou deploy. O restante da E1 e das etapas E2–E4 continua pendente.

| Issue | PR | Cabeça publicada | Base do PR |
|---|---|---|---|
| #306 tokens/fonte | [391](https://github.com/diogenesmendes01/erp-genius/pull/391) | `237bf3e601de904d5a6f1f693cbd650b1ebc0975` | `codex/inbox-e0-integracao` |
| #307 harness | [392](https://github.com/diogenesmendes01/erp-genius/pull/392) | `ff2a048303c645733f2e6b1b7d6cfc1903cb2bfd` | `codex/inbox-e0-integracao` |
| #309 avatares/estados | [393](https://github.com/diogenesmendes01/erp-genius/pull/393) | `0720227c180dc9cfc78401dbc978ad32ed898fc4` | `codex/inbox-e1-base` |
| #310 contagens/saúde | [394](https://github.com/diogenesmendes01/erp-genius/pull/394) | `eb68e31423333222a6bbe96284dfba9c45246ab8` | `codex/inbox-e0-integracao` |

`codex/inbox-e1-base` fica fixada em `3a7ff6ae5d8f21cc3143b5d6815520a066bfd76d`, pois é base do PR393. A nova base com as quatro entregas chama-se `codex/inbox-e1-base-310`. A fonte de código dela é igual a `103a507d8a8fda7a6758a4eee46177d4c3ce7a67`; os commits seguintes consolidam somente documentação, pareceres e logs. Conflitos de integração ocorreram apenas no quadro, preservando as quatro seções.

## Evidência

Global final Node22.23.2, fonte103a507d, sessão15987 acompanhada até **exit0**: **850 arquivos/6.634 testes**, sem filtros ou ignorados, maxWorkers2; TypeScript com heap8192 e lint global também **exit0**, com0erros/40avisos herdados. Logs em `output/inbox-309-qa/` e `output/inbox-310-qa/`. Não se atribui aprovação ao global anterior15860, que falhou na guarda AST de Avatar; a expressão foi simplificada e revista sem afrouxar a guarda.

TESTER309: fontebcda5a04,83testes dirigidos0. TESTER310: fonte67014764,86unitários0 e26integração0 no banco tester; DEV26integração0 no dev-email e complemento3testes0/21fora dofiltro. A integração é dirigida, não suíte completa de banco. #309 e #310 entregam produtores; o plano reserva a comparação visual dos consumidores às Tasks7/8.

#306/#307 têm prova visual conjunta: integrador51505 e TESTER76466, cada34PNGs/0falhas/14diagnósticos/exit0, nos três tamanhos e dois temas; fonte mono400/500 e Roboto confirmadas6/6. Imagens e limites estão em `output/inbox-306-comparacao/`, `output/inbox-307-combinado/` e `output/inbox-307-qa/`. Referência offline usa fonte de reserva, Nextdev tem toast semissues ocultado sónafoto, e abrir conversas altera contadores pessoais. Não se alega paridade pixel a pixel desses contadores.

## Continuidade

#308 casca e #311 selo/SSE avançam em worktrees isolados a partir da fonte103a507d revisada. O integrador coordena o pequeno delta no callback de leitura de InboxNovo; casca/harness ficam com308 e transporte/loja/selo com311. Sidebar mantém largura224; os breakpoints locais da308 serão medidos com compositor humano. A fila restante segue a matriz de dependências e as decisões de produto do usuário.

CI está filtrada para PRs cuja base émain; a ausência de execução nestes PRs empilhados não significa aprovação de CI. Após os predecessores, retarget e aguardar os checks. Nenhuma integração externa, mensagem real ou banco de produção foi ativado nesta etapa.
