# #304 — fechamento de QA

Parecer independente: `qa/inbox-304-review.md`. Baseline E0 `797994aa` em `qa-antes/`:20estados/40PNGs com rolagem externa. Fonte304 `98c76bd4` em `qa-depois/`:20estados/40PNGs com documento igual à viewport, controles alcançáveis e rolagem interna nas regiões visíveis; três tamanhos contratuais mais700×844 e390×500, ambos temas/com e sem seleção. Sessão47165 exit0, sem pageerror/falha/diagnóstico. Probes criam/removem overflow temporário para fixture curta, sem mutar banco. As duas primeiras tentativas falharam por seleção/destino de scroll do harness e foram preservadas como manifestos; fonte não mudou.

O warning de keys duplicadas preexistente apareceu nos10 estados selecionados; tratado em PR técnico separado, sem atribuir correção à304. Inspeção visual TESTER:desktop,700px e390×500. Inspeção DEV24cenários e27PNGs oficiais/extras em antes/depois permanece preservada.

Gates Node22 da combinação E0 `7657c528`: full sem filtro/maxWorkers2,845arquivos6526testes sessão99285 exit0; TSCNext40124 exit0; lint global5709 exit0 com40avisos herdados. Integrações dirigidas26+13testes sessões87157/56869 exit0, sem ignorados; não é suíte completa de integração. Os commits finais de publicação adicionam somente docs/PNG/JSON, sem alterar fonte revisada.

Sem mensagens reais, ativação de integração, merge ou deploy.
