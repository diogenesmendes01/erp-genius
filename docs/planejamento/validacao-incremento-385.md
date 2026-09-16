# Incremento 385 — nova solicitação após rejeição

Data: 14/09/2026.

A consulta de origens passou a permitir nova solicitação quando os pedidos anteriores foram rejeitados. Os pedidos anteriores e suas decisões permanecem no histórico. Pedido pendente ou autorizado continua retirando a origem dessa lista. A consulta também confere o vínculo da matrícula ao aplicar o cursor de ausências.

O teste de integração exercita a sequência completa: pedido pendente, rejeição independente, origem novamente disponível, nova solicitação pela ação do servidor e preservação dos dois pedidos. A suíte `src/server/diario/reposicao-permissoes.int.test.ts` teve oito testes aprovados. Evidência: `../validacao-consulta-reposicoes-385-2026-09-14.json`.

Limites: o novo pedido após falta/cancelamento tardio depende do estado terminal da agenda ainda em desenvolvimento. A proteção contra solicitações/reservas concorrentes da mesma ausência também precisa ser integrada no servidor e banco; ocultar uma opção na interface não comprova essa proteção. Não houve validação integral da SPEC ou operação em produção.

Na revisão da identidade do portal em rascunho, foram encaminhados para correção o bloqueio SQL no lado opcional de uma junção, o incremento ausente do limite de recuperação e o limite de bytes de senha do bcrypt. Essas observações não equivalem a correções verificadas; a integração deverá testá-las.
